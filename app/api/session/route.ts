import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('sessions')
    .select('id, title, idea_text, lang, message_count, status, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

interface CreateBody {
  ideaText: string;
  attachments?: { name: string; markdown: string }[];
  lang?: 'en' | 'zh';
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as CreateBody;
  const ideaText = (body.ideaText || '').trim();
  if (!ideaText) return NextResponse.json({ error: 'idea_required' }, { status: 400 });

  const title = ideaText.slice(0, 80) + (ideaText.length > 80 ? '…' : '');

  // Submitting the initial idea (+ attachments) is the first charged action
  // per §10.1 — the session doesn't exist yet, so there's no concurrent-write
  // race to guard against; charge it directly on insert.
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      title,
      idea_text: ideaText,
      attachments: body.attachments ?? [],
      lang: body.lang ?? 'en',
      message_count: 1,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
