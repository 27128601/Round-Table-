import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CLARIFY_SYSTEM } from '@/lib/prompts';
import { callWithRetry, HAIKU_MODEL } from '@/lib/anthropic';

function parseClarify(text: string): string[] {
  if (/SUFFICIENT/i.test(text)) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^Q:/i.test(l))
    .map((l) => l.replace(/^Q:\s*/i, ''))
    .slice(0, 3);
}

// Runs the clarify screen (§12, carried over unchanged). This is a system
// check, not a user-initiated action, so it does NOT consume a rate-limit
// message — only the user's subsequent answer/skip does (see
// app/api/clarify/answer/route.ts), per §10.1.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId } = (await request.json()) as { sessionId: string };
  const { data: session } = await supabase
    .from('sessions')
    .select('idea_text, attachments')
    .eq('id', sessionId)
    .single();
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const attachmentsText = (session.attachments as { name: string; markdown: string }[] | null || [])
    .map((a) => `Attached notes (${a.name}):\n${a.markdown}`)
    .join('\n\n');
  const fullBrief = [session.idea_text, attachmentsText].filter(Boolean).join('\n\n');

  try {
    const { text } = await callWithRetry({
      model: HAIKU_MODEL,
      system: CLARIFY_SYSTEM,
      userContent: `The founder's brief:\n\n"${fullBrief}"`,
      maxTokens: 220,
    });
    return NextResponse.json({ questions: parseClarify(text) });
  } catch {
    // If the clarify check itself fails, don't block the flow — run as-is.
    return NextResponse.json({ questions: [] });
  }
}
