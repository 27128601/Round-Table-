import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import { chargeMessage, rateLimitResponseBody } from '@/lib/rateLimit';

interface AnswerBody {
  sessionId: string;
  questions: { agentId: string; question: string }[];
  answers: { agentId: string; answer: string }[];
  generalNote?: string;
}

// Answering the human-turn questions is a charged action per §10.1. The
// mandatory "agents react" round that follows is triggered separately by the
// client calling POST /api/round { kind: 'reaction', humanTurnId } — that
// round has its own independent charge/no-charge outcome per §10.3.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as AnswerBody;
  if (!body.answers?.length && !body.generalNote?.trim()) {
    return NextResponse.json({ error: 'answer_required' }, { status: 400 });
  }

  const charge = await chargeMessage(supabase, body.sessionId);
  if (!charge.ok) return NextResponse.json(rateLimitResponseBody(), { status: 429 });

  const { data, error } = await supabase
    .from('human_turns')
    .insert({
      session_id: body.sessionId,
      questions: body.questions,
      answers: body.answers,
      general_note: body.generalNote || null,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ humanTurnId: data.id, messageCount: charge.messageCount });
}
