import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PLAN_SYSTEM, AGENTS } from '@/lib/prompts';
import { callWithRetry, hasNonChineseScript, translateBackstop, SONNET_MODEL } from '@/lib/anthropic';
import type { Lang } from '@/lib/i18n';

// Wrap-up execution plan (§12, carried over unchanged). This is the "final
// output" of a session and does NOT count against the 15-message rate limit
// per §10.1/§11.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  try {
    const { text } = await callWithRetry({
      model: SONNET_MODEL,
      system: PLAN_SYSTEM,
      userContent: `Idea: "${session.idea_text}"\n\nFull discussion:\n${parts.join('\n\n')}`,
      maxTokens: 600,
    });
    let planText = text;
    if (lang === 'zh' && hasNonChineseScript(planText)) planText = await translateBackstop(planText);

    const out = { title: 'Execution plan', steps: [] as string[], risk: '', validate: '' };
    planText.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
      if (/^TITLE:/i.test(l)) out.title = l.replace(/^TITLE:/i, '').trim();
      else if (/^STEP:/i.test(l)) out.steps.push(l.replace(/^STEP:/i, '').trim());
      else if (/^RISK:/i.test(l)) out.risk = l.replace(/^RISK:/i, '').trim();
      else if (/^VALIDATE:/i.test(l)) out.validate = l.replace(/^VALIDATE:/i, '').trim();
    });

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
