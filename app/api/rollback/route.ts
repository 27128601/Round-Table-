import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';

// Mark-and-rollback checkpoints (carried over from the original single-file
// build's rollbackTo()). Rolling back to a round deletes that round and
// everything created after it — human turns, agent-reply threads, and any
// wrap-up plan — so the founder can branch the debate differently from that
// point. Message charges already billed are NOT refunded; rollback discards
// state, not spend.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId, roundId } = (await request.json()) as { sessionId: string; roundId: string };
  if (!sessionId || !roundId) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  const { data: target } = await supabase
    .from('rounds')
    .select('round_index, created_at')
    .eq('id', roundId)
    .eq('session_id', sessionId)
    .single();
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // The human_turn that PRODUCED the target round (i.e. the founder's answers
  // that led to it, for any round after the first) is always created BEFORE
  // the target round itself — so a plain `created_at >= target.created_at`
  // cutoff never catches it. That left a "dangling" human_turn behind after
  // rollback: the client's resume logic only re-prompts "answer the table"
  // when humanTurns.length is 0, so with that stale row still present it
  // looked like the founder had already answered, no round existed to show
  // for it, and none of the "what's next" UI (ChoiceCard / manual-start)
  // conditions matched either — a real dead end, not just a rough edge.
  // Fix: use the created_at of the round immediately BEFORE the target
  // (the last one that survives) as the cutoff instead, so any human_turn
  // made in service of the target round or later is correctly discarded too.
  const { data: prevRound } = await supabase
    .from('rounds')
    .select('created_at')
    .eq('session_id', sessionId)
    .eq('round_index', target.round_index - 1)
    .maybeSingle();
  const humanTurnCutoff = prevRound?.created_at ?? target.created_at;

  await Promise.all([
    supabase.from('rounds').delete().eq('session_id', sessionId).gte('round_index', target.round_index),
    supabase.from('human_turns').delete().eq('session_id', sessionId).gte('created_at', humanTurnCutoff),
    supabase.from('agent_threads').delete().eq('session_id', sessionId).gte('created_at', target.created_at),
    supabase.from('plans').delete().eq('session_id', sessionId).gte('created_at', target.created_at),
  ]);

  await supabase.from('sessions').update({ status: 'active' }).eq('id', sessionId);

  return NextResponse.json({ ok: true });
}
