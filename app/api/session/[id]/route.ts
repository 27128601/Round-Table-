import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (sessionErr || !session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [{ data: rounds }, { data: humanTurns }, { data: agentThreads }, { data: plans }] = await Promise.all([
    supabase.from('rounds').select('*').eq('session_id', id).order('round_index'),
    supabase.from('human_turns').select('*').eq('session_id', id).order('created_at'),
    supabase.from('agent_threads').select('*').eq('session_id', id).order('created_at'),
    supabase.from('plans').select('*').eq('session_id', id).order('created_at'),
  ]);

  return NextResponse.json({
    session,
    rounds: rounds ?? [],
    humanTurns: humanTurns ?? [],
    agentThreads: agentThreads ?? [],
    plans: plans ?? [],
  });
}

interface PatchBody {
  lang?: 'en' | 'zh';
  status?: 'active' | 'wrapped_up';
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as PatchBody;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.lang) patch.lang = body.lang;
  if (body.status) patch.status = body.status;

  const { error } = await supabase.from('sessions').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
