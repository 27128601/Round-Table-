import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import { PLAN_SYSTEM, AGENTS } from '@/lib/prompts';
import { callWithRetry, needsZhBackstop, translateBackstop, needsPlanFormatBackstop, planFormatBackstop, SONNET_MODEL } from '@/lib/anthropic';
import { ZH_INSTRUCTION, NO_MD_INSTRUCTION, type Lang } from '@/lib/i18n';

// Wrap-up execution plan (§12, carried over unchanged). This is the "final
// output" of a session and does NOT count against the 15-message rate limit
// per §10.1/§11.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId } = (await request.json()) as { sessionId: string };
  const { data: session } = await supabase.from('sessions').select('idea_text, lang').eq('id', sessionId).single();
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const lang: Lang = session.lang === 'zh' ? 'zh' : 'en';

  const [{ data: rounds }, { data: humanTurns }] = await Promise.all([
    supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_index'),
    supabase.from('human_turns').select('*').eq('session_id', sessionId).order('created_at'),
  ]);

  const parts: string[] = [];
  for (const r of rounds || []) {
    if (r.alignment_result) parts.push(`Shared recommendation (round ${r.round_index}): ${r.alignment_result}`);
    for (const t of (r.tactics || []) as { agentId: string; status: string; text?: string }[]) {
      if (t.status === 'complete' && t.text) {
        const agent = AGENTS.find((a) => a.id === t.agentId);
        parts.push(`${agent?.label ?? t.agentId} tactics: ${t.text}`);
      }
    }
  }
  for (const ht of humanTurns || []) {
    for (const a of (ht.answers || []) as { agentId: string; answer: string }[]) {
      parts.push(`Founder answered ${a.agentId}: ${a.answer}`);
    }
    if (ht.general_note) parts.push(`Founder general notes: ${ht.general_note}`);
  }

  // A response that's missing RISK:/VALIDATE: entirely, or has fewer than 2
  // STEP lines, isn't "badly formatted" (needsPlanFormatBackstop's job) —
  // it's a response that got cut off mid-generation before it could finish
  // (seen in production: TITLE came through clean, then "STEP: Run a
  // three-day" and nothing else at all, no risk, no validate). The model
  // routinely ignores the "under 25 words" instruction and writes a much
  // longer first step, which then eats the token budget before it can reach
  // the rest of the structure. needsPlanFormatBackstop can't catch this
  // because TITLE: and one STEP: line genuinely are present — the labels
  // just stop appearing after that point, not because they're malformed.
  function looksTruncated(t: string) {
    const stepCount = (t.match(/^STEP:/img) || []).length;
    return stepCount < 2 || !/^RISK:/im.test(t) || !/^VALIDATE:/im.test(t);
  }

  try {
    const system = PLAN_SYSTEM + (lang === 'zh' ? ZH_INSTRUCTION : NO_MD_INSTRUCTION);
    const genPlan = () => callWithRetry({
      model: SONNET_MODEL,
      system,
      userContent: `Idea: "${session.idea_text}"\n\nFull discussion:\n${parts.join('\n\n')}`,
      maxTokens: 900,
    });
    const first = await genPlan();
    let planText = first.text;
    if (looksTruncated(planText)) {
      // One re-roll — a fresh sample has a real chance of finishing within
      // budget even if this one didn't. Only swap in the retry if it's
      // actually more complete than what we already have.
      const retry = await genPlan();
      if (!looksTruncated(retry.text) || (retry.text.match(/^STEP:/img) || []).length > (planText.match(/^STEP:/img) || []).length) {
        planText = retry.text;
      }
    }
    if (lang === 'zh' && needsZhBackstop(planText)) planText = await translateBackstop(planText);
    // If the model dropped the TITLE:/STEP:/RISK:/VALIDATE: structure
    // entirely, run one corrective relabeling pass rather than shipping the
    // hardcoded "Execution plan" / zero-steps default the naive parser below
    // would otherwise silently fall back to.
    if (needsPlanFormatBackstop(planText)) planText = await planFormatBackstop(planText);

    // State-machine parse, not "one field = one physical line": once a label
    // is seen, subsequent unlabeled lines are treated as a continuation of
    // that same field. This mirrors the parseAlignment fix — a model that
    // wraps TITLE or a STEP across two physical lines used to silently lose
    // everything after the first newline.
    const out = { title: '', steps: [] as string[], risk: '', validate: '' };
    type Field = 'title' | 'step' | 'risk' | 'validate' | null;
    let current: Field = null;
    let buf = '';
    const flush = () => {
      const val = buf.trim();
      if (val) {
        if (current === 'title' && !out.title) out.title = val;
        else if (current === 'step') out.steps.push(val);
        else if (current === 'risk') out.risk = val;
        else if (current === 'validate') out.validate = val;
      }
      buf = '';
    };
    for (const line of planText.split('\n')) {
      const trimmed = line.trim();
      if (/^TITLE:/i.test(trimmed)) { flush(); current = 'title'; buf = trimmed.replace(/^TITLE:/i, '').trim(); continue; }
      if (/^STEP:/i.test(trimmed)) { flush(); current = 'step'; buf = trimmed.replace(/^STEP:/i, '').trim(); continue; }
      if (/^RISK:/i.test(trimmed)) { flush(); current = 'risk'; buf = trimmed.replace(/^RISK:/i, '').trim(); continue; }
      if (/^VALIDATE:/i.test(trimmed)) { flush(); current = 'validate'; buf = trimmed.replace(/^VALIDATE:/i, '').trim(); continue; }
      if (trimmed && current) { buf += (buf ? ' ' : '') + trimmed; continue; }
    }
    flush();
    if (!out.title) out.title = 'Execution plan';

    const { data: plan } = await supabase.from('plans').insert({
      session_id: sessionId,
      title: out.title,
      steps: out.steps,
      risk: out.risk,
      validate: out.validate,
    }).select('*').single();

    return NextResponse.json({ plan });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
