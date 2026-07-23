import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AGENTS, humanQuestionInstruction } from '@/lib/prompts';
import { callWithRetry, hasNonChineseScript, translateBackstop, HAIKU_MODEL } from '@/lib/anthropic';
import type { Lang } from '@/lib/i18n';

function normQ(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}
function tooSimilar(a: string, b: string) {
  const na = normQ(a), nb = normQ(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  if (longer.includes(shorter) && shorter.length > 12) return true;
  const toks = (x: string) => (x.length > 40 ? x.match(/.{1,2}/g) || [] : x.split(/\s+/));
  const sa = new Set(toks(na)), sb = new Set(toks(nb));
  let inter = 0;
  sa.forEach((tk) => { if (sb.has(tk)) inter++; });
  const ratio = inter / Math.max(1, Math.min(sa.size, sb.size));
  return ratio > 0.7;
}

// Generates the mandatory human-turn questions (§12, carried over unchanged,
// adapted to the 3-agent roster). This is a system-generated prompt, not a
// user-initiated action — no rate-limit charge here (only the founder's
// answer, in app/api/human-turn/answer/route.ts, is charged per §10.1).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId } = (await request.json()) as { sessionId: string };
  const { data: session } = await supabase.from('sessions').select('idea_text, lang').eq('id', sessionId).single();
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const lang: Lang = session.lang === 'zh' ? 'zh' : 'en';

  const { data: rounds } = await supabase
    .from('rounds').select('initial_takes, alignment_result').eq('session_id', sessionId).order('round_index');
  const { count: humanTurnCount } = await supabase
    .from('human_turns').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
  const humanRound = (humanTurnCount ?? 0) + 1;

  const debateContext = (rounds || [])
    .map((r) => r.alignment_result ? `Shared recommendation: ${r.alignment_result}` : '')
    .filter(Boolean)
    .join('\n\n');

  const ramp = humanRound <= 1
    ? 'This is the FIRST round of questions: challenge the founder\'s thinking, but the question MUST be answerable by an early-stage founder from reasoning alone — do NOT demand real metrics, revenue figures or research they cannot have yet.'
    : `This is round ${humanRound} of questions: go one level deeper and more specific than earlier rounds, building on what the founder has already answered.`;

  const asked: string[] = [];
  const results: { agentId: string; question: string | null }[] = [];

  for (const agent of AGENTS) {
    try {
      let { text: q } = await callWithRetry({
        model: HAIKU_MODEL,
        system: humanQuestionInstruction(agent, ramp, asked),
        userContent: `Idea: "${session.idea_text}"\n\nDebate:\n${debateContext}`,
        maxTokens: 130,
      });
      q = q.replace(/^Q:\s*/i, '').trim();
      if (asked.some((a) => tooSimilar(a, q))) {
        const retry = await callWithRetry({
          model: HAIKU_MODEL,
          system: humanQuestionInstruction(agent, ramp, asked),
          userContent: `Idea: "${session.idea_text}"\n\nDebate:\n${debateContext}`,
          maxTokens: 130,
        });
        q = retry.text.replace(/^Q:\s*/i, '').trim();
      }
      if (asked.some((a) => tooSimilar(a, q))) {
        results.push({ agentId: agent.id, question: null });
        continue;
      }
      if (lang === 'zh' && hasNonChineseScript(q)) q = await translateBackstop(q);
      results.push({ agentId: agent.id, question: q });
      asked.push(q);
    } catch {
      results.push({ agentId: agent.id, question: null });
    }
  }

  return NextResponse.json({ questions: results.filter((r) => r.question) });
}
