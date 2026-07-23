import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SessionView from '@/components/SessionView';
import type { SessionDetail } from '@/lib/types';

export default async function SessionPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { id } = await params;
  const { start } = await searchParams;
  const supabase = await createClient();

  const { data: session } = await supabase.from('sessions').select('*').eq('id', id).single();
  if (!session) notFound();

  const [{ data: rounds }, { data: humanTurns }, { data: agentThreads }, { data: plans }] = await Promise.all([
    supabase.from('rounds').select('*').eq('session_id', id).order('round_index'),
    supabase.from('human_turns').select('*').eq('session_id', id).order('created_at'),
    supabase.from('agent_threads').select('*').eq('session_id', id).order('created_at'),
    supabase.from('plans').select('*').eq('session_id', id).order('created_at'),
  ]);

  const detail: SessionDetail = {
    session,
    rounds: rounds ?? [],
    humanTurns: humanTurns ?? [],
    agentThreads: agentThreads ?? [],
    plans: plans ?? [],
  };

  return <SessionView initial={detail} autoStart={start === '1' && (rounds ?? []).length === 0} />;
}
