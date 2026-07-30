import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import { chargeMessage, rateLimitResponseBody } from '@/lib/rateLimit';

// Answering (or explicitly skipping) the clarify-step questions is its own
// charged action per §10.1, distinct from the initial idea submission.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { sessionId, answers } = (await request.json()) as { sessionId: string; answers: string[] };

  const charge = await chargeMessage(supabase, sessionId);
  if (!charge.ok) return NextResponse.json(rateLimitResponseBody(), { status: 429 });

  const clean = (answers || []).map((a) => a.trim()).filter(Boolean);
  if (clean.length) {
    const { data: session } = await supabase.from('sessions').select('idea_text').eq('id', sessionId).single();
    if (session) {
      const updated = `${session.idea_text}\n\nClarifications from the founder:\n- ${clean.join('\n- ')}`;
      await supabase.from('sessions').update({ idea_text: updated }).eq('id', sessionId);
    }
  }

  return NextResponse.json({ ok: true, messageCount: charge.messageCount });
}
