import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import { AGENTS, humanQuestionInstruction, type AgentId } from '@/lib/prompts';
import { callWithRetry, hasNonChineseScript, translateBackstop, HAIKU_MODEL } from '@/lib/anthropic';
import { NO_MD_INSTRUCTION, type Lang } from '@/lib/i18n';

// Priority order for surfacing questions to the founder — top 3 shown first.
const QUESTION_PRIORITY: AgentId[] = ['visionary', 'market', 'builder', 'operator', 'storyteller'];

function normQ(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}
// The model is instructed to stay under 16 words with no sub-clauses, but
// occasionally ignores that and writes a long conditional ("If you position
// X, how do you explain to Y instead of Z...") which then runs past the
// token cap and gets cut off mid-sentence — exactly the "BlankStreet's
// bottled version in" cutoff seen in production.
//
// A cut-off question (no closing punctuation) is genuinely broken and must
// never reach the founder — that alone is worth a retry (a real, paid extra
// API call). Mere length is NOT worth a retry: models routinely write
// 18-25 word questions despite the 16-word instruction, so gating retries on
// length as well was firing on most calls and roughly doubling API spend on
// every human-turn step for no benefit — the question still isn't broken,
// just a little long. Deliberately not checked here or in the final gate.
function isCutOff(q: string) {
  const trimmed = (q || '').trim();
  if (!trimmed) return true;
  return !/[?.!]$/.test(trimmed);
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

// Generates one question per agent (5 total), then returns them sorted by
// QUESTION_PRIORITY so the client can show the top 3 and hide the rest.
// System-generated prompt — no rate-limit charge here (only the founder's
// answer, in app/api/human-turn/answer/route.ts, is charged per §10.1).
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
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
      const askOnce = () => callWithRetry({
        model: HAIKU_MODEL,
        system: humanQuestionInstruction(agent, ramp, asked) + NO_MD_INSTRUCTION,
        userContent: `Idea: "${session.idea_text}"\n\nDebate:\n${debateContext}`,
        maxTokens: 70,
      });

      let { text: q } = await askOnce();
      q = q.replace(/^Q:\s*/i, '').trim();
      // Re-roll (an extra paid API call) only for a genuine problem: cut off,
      // or a near-duplicate of an earlier question. Mere length is a soft
      // style miss, not a defect — retrying for it was firing on most calls
      // (models routinely write 18-25 word questions despite the 16-word
      // instruction), roughly doubling API spend on every human-turn step
      // for no real benefit, since the final gate below never rejected on
      // length anyway. isTooLong is intentionally NOT checked here.
      if (isCutOff(q) || asked.some((a) => tooSimilar(a, q))) {
        const retry = await askOnce();
        const q2 = retry.text.replace(/^Q:\s*/i, '').trim();
        // Only take the retry if it's not itself cut off or a duplicate —
        // otherwise keep the original rather than trade one flaw for another.
        if (!isCutOff(q2) && !asked.some((a) => tooSimilar(a, q2))) q = q2;
      }
      // Final gate: only a genuine cutoff or an unresolved duplicate costs the
      // founder a question. Length alone never does — that would leave fewer
      // than the promised 3 questions on screen.
      if (isCutOff(q) || asked.some((a) => tooSimilar(a, q))) {
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

  const valid = results.filter((r) => r.question);
  // Sort by priority order so the client always receives them in display order.
  valid.sort((a, b) => {
    const ai = QUESTION_PRIORITY.indexOf(a.agentId as AgentId);
    const bi = QUESTION_PRIORITY.indexOf(b.agentId as AgentId);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return NextResponse.json({ questions: valid });
}
