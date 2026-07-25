import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mark-and-rollback checkpoints (carried over from the original single-file
// build's rollbackTo()). Rolling back to a round deletes that round and
// everything created after it — human turns, agent-reply threads, and any
// wrap-up plan — so the founder can branch the debate differently from that
// point. Message charges already billed are NOT refunded; rollback discards
// state, not spend.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  await Promise.all([
    supabase.from('rounds').delete().eq('session_id', sessionId).gte('round_index', target.round_index),
    supabase.from('human_turns').delete().eq('session_id', sessionId).gte('created_at', target.created_at),
    supabase.from('agent_threads').delete().eq('session_id', sessionId).gte('created_at', target.created_at),
    supabase.from('plans').delete().eq('session_id', sessionId).gte('created_at', target.created_at),
  ]);

  await supabase.from('sessions').update({ status: 'active' }).eq('id', sessionId);

  return NextResponse.json({ ok: true });
}
