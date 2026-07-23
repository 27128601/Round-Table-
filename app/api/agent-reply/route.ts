import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chargeMessage, rateLimitResponseBody } from '@/lib/rateLimit';
import { AGENTS, directReplySystem } from '@/lib/prompts';
import { callWithRetry, hasNonChineseScript, translateBackstop, HAIKU_MODEL } from '@/lib/anthropic';
import type { Lang } from '@/lib/i18n';

interface ReplyBody {
  sessionId: string;
  agentId: string;
  founderMessage: string;
  agentRecentText: string; // the agent's most recent statement the founder is replying to
}

// Direct-to-agent replies (§12, carried over unchanged) — each send is its
// own charged action per §10.1.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as ReplyBody;
  const agent = AGENTS.find((a) => a.id === body.agentId);
  if (!agent) return NextResponse.json({ error: 'unknown_agent' }, { status: 400 });
  if (!body.founderMessage?.trim()) return NextResponse.json({ error: 'message_required' }, { status: 400 });

  const { data: session } = await supabase.from('sessions').select('idea_text, lang').eq('id', body.sessionId).single();
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const lang: Lang = session.lang === 'zh' ? 'zh' : 'en';

  const charge = await chargeMessage(supabase, body.sessionId);
  if (!charge.ok) return NextResponse.json(rateLimitResponseBody(), { status: 429 });

  let replyText = '';
  try {
    const { text } = await callWithRetry({
      model: HAIKU_MODEL,
      system: directReplySystem(agent),
      userContent: `Idea: "${session.idea_text}"\n\nYour earlier statement:\n${body.agentRecentText}\n\nThe founder says to you:\n${body.founderMessage}`,
      maxTokens: 300,
    });
    replyText = text;
    if (lang === 'zh' && hasNonChineseScript(replyText)) replyText = await translateBackstop(replyText);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, messageCount: charge.messageCount }, { status: 502 });
  }

  await supabase.from('agent_threads').insert({
    session_id: body.sessionId,
    agent_id: agent.id,
    founder_message: body.founderMessage,
    agent_reply: replyText,
  });

  return NextResponse.json({ reply: replyText, messageCount: charge.messageCount });
}
