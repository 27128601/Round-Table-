import { createClient } from '@/lib/supabase/server';
import { chargeMessage, MAX_MESSAGES } from '@/lib/rateLimit';
import {
  AGENTS, AgentId, GROUNDING_SYSTEM, ALIGNMENT_SYSTEM, tacticsInstruction,
  agentReactionInstruction,
} from '@/lib/prompts';
import { buildCachedSystemBlocks, callWithRetry, needsZhBackstop, translateBackstop, HAIKU_MODEL, SONNET_MODEL, Source } from '@/lib/anthropic';
import type { Lang } from '@/lib/i18n';

export const maxDuration = 60; // Vercel function timeout — see plan §"Core pipeline" for why this needs raising

interface RoundBody {
  sessionId: string;
  kind: 'initial' | 'reaction' | 'standalone';
  humanTurnId?: string;
}

interface AgentStepResult {
  agentId: AgentId;
  status: 'complete' | 'failed';
  text?: string;
  sources?: Source[];
  error?: string;
}

function ndjson(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n');
}

async function localize(text: string, lang: Lang): Promise<string> {
  if (lang === 'zh' && needsZhBackstop(text)) {
    return translateBackstop(text);
  }
  return text;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const body = (await request.json()) as RoundBody;
  const { sessionId, kind, humanTurnId } = body;

  const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if (!session) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  if (session.message_count >= MAX_MESSAGES) {
    return new Response(JSON.stringify({ error: 'rate_limited', upgradeHint: true }), { status: 429 });
  }

  const lang: Lang = session.lang === 'zh' ? 'zh' : 'en';

  const { data: priorRounds } = await supabase
    .from('rounds')
    .select('round_index, alignment_result')
    .eq('session_id', sessionId)
    .eq('alignment_status', 'complete')
    .order('round_index');

  let humanContext = '';
  if (kind === 'reaction' && humanTurnId) {
    const { data: ht } = await supabase.from('human_turns').select('*').eq('id', humanTurnId).single();
    if (ht) {
      const answerLines = (ht.answers as { agentId: string; answer: string }[]).map((a) => `- (${a.agentId}) ${a.answer}`);
      humanContext = `\n\nThe founder just answered the table:\n${answerLines.join('\n')}${ht.general_note ? `\n- (general notes) ${ht.general_note}` : ''}`;
    }
  }

  const attachmentsText = (session.attachments as { name: string; markdown: string }[] | null || [])
    .map((a) => `Attached notes (${a.name}):\n${a.markdown}`)
    .join('\n\n');

  const historyText = (priorRounds || [])
    .map((r) => `Round ${r.round_index} shared recommendation: ${r.alignment_result}`)
    .join('\n\n');

  const { count: existingRoundCount } = await supabase
    .from('rounds').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
  const nextRoundIndex = (existingRoundCount ?? 0) + 1;

  const { data: roundRow } = await supabase
    .from('rounds')
    .insert({ session_id: sessionId, round_index: nextRoundIndex, kind })
    .select('id')
    .single();
  const roundId = roundRow!.id as string;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(ndjson(obj));

      try {
        // ---- Step 1: shared grounding search (Haiku + web search, §4.2/§5) ----
        send({ event: 'status', stage: 'grounding' });
        let groundingText = '';
        let groundingSources: Source[] = [];
        let groundingStatus: 'complete' | 'failed' = 'complete';
        try {
          const g = await callWithRetry({
            model: HAIKU_MODEL,
            system: GROUNDING_SYSTEM,
            userContent: `Idea:\n"${session.idea_text}"\n\n${attachmentsText}`,
            maxTokens: 500,
            withSearch: true,
          });
          groundingText = g.text;
          groundingSources = g.sources;
        } catch {
          groundingStatus = 'failed'; // non-fatal — proceed without grounding context
        }
        await supabase.from('rounds').update({
          grounding_status: groundingStatus,
          grounding_result: { text: groundingText, sources: groundingSources },
        }).eq('id', roundId);
        send({ event: 'grounding-done', status: groundingStatus, sources: groundingSources });

        // ---- Shared prefix for the 3 initial-takes calls (byte-identical, §4.5) ----
        const sharedPrefixParts = [
          `Idea:\n"${session.idea_text}"`,
          attachmentsText,
          groundingText ? `Research context:\n${groundingText}` : '',
          historyText ? `Prior rounds in this session:\n${historyText}` : '',
        ].filter(Boolean);
        const initialSharedPrefix = sharedPrefixParts.join('\n\n');

        const initialUserMessage = kind === 'reaction'
          ? `${humanContext}\n\nReact to the founder's answer above from your role's perspective, then give your first-pass take for this round.`
          : kind === 'standalone'
            ? 'This round continues the debate without new founder input — build on or challenge the prior round(s) above, then give your first-pass take for this round.'
            : 'Give your first-pass take on this idea.';

        // ---- Step 2: 3 initial takes in parallel (Haiku), streamed as they land ----
        send({ event: 'status', stage: 'initial' });
        const initialResults: AgentStepResult[] = new Array(AGENTS.length);
        await Promise.all(AGENTS.map(async (agent, idx) => {
          try {
            const system = buildCachedSystemBlocks(initialSharedPrefix, agent.system, lang);
            const { text, sources } = await callWithRetry({
              model: HAIKU_MODEL,
              system,
              userContent: kind === 'reaction' ? `${agentReactionInstruction(agent)} ${initialUserMessage}` : initialUserMessage,
              maxTokens: 500,
              withSearch: false,
            });
            const localized = await localize(text, lang);
            const result: AgentStepResult = { agentId: agent.id, status: 'complete', text: localized, sources };
            initialResults[idx] = result;
            send({ event: 'initial-take', ...result });
          } catch (err) {
            console.error('[initial-take failed]', agent.id, err);
            const result: AgentStepResult = { agentId: agent.id, status: 'failed', error: (err as Error).message };
            initialResults[idx] = result;
            send({ event: 'initial-take', ...result });
          }
        }));
        await supabase.from('rounds').update({ initial_takes: initialResults }).eq('id', roundId);

        const succeededInitial = initialResults.filter((r) => r.status === 'complete');
        if (succeededInitial.length === 0) {
          await supabase.from('rounds').update({ alignment_status: 'failed' }).eq('id', roundId);
          send({ event: 'total-failure', message: "The table couldn't produce any initial takes this round." });
          controller.close();
          return;
        }

        // ---- Step 3: alignment call (Sonnet) — the total-vs-partial billing boundary (§10.3) ----
        send({ event: 'status', stage: 'alignment' });
        const debateText = succeededInitial.map((r) => {
          const agent = AGENTS.find((a) => a.id === r.agentId)!;
          return `${agent.label}: ${r.text}`;
        }).join('\n\n');

        let alignmentText = '';
        let billed = false;
        try {
          const { text } = await callWithRetry({
            model: SONNET_MODEL,
            system: ALIGNMENT_SYSTEM,
            userContent: `Idea: "${session.idea_text}"\n\nDebate:\n${debateText}`,
            maxTokens: 400,
          });
          alignmentText = await localize(text, lang);
        } catch {
          await supabase.from('rounds').update({ alignment_status: 'failed' }).eq('id', roundId);
          send({ event: 'total-failure', message: 'The table could not reach a shared recommendation this round.' });
          controller.close();
          return;
        }

        // Alignment succeeded — charge locked in now, regardless of what happens to tactics below (§10.3).
        try {
          const charge = await chargeMessage(supabase, sessionId);
          billed = charge.ok;
        } catch {
          billed = false;
        }

        await supabase.from('rounds').update({
          alignment_status: 'complete',
          alignment_result: alignmentText,
          billed,
        }).eq('id', roundId);
        send({ event: 'alignment-done', text: alignmentText, billed });

        // ---- Step 4: 3 tactics calls in parallel (Haiku, optional search), streamed as they land ----
        send({ event: 'status', stage: 'tactics' });
        const tacticsSharedPrefix = [
          initialSharedPrefix,
          `Raw debate:\n${debateText}`,
          `Shared recommendation:\n${alignmentText}`,
        ].join('\n\n');

        const tacticsResults: AgentStepResult[] = new Array(AGENTS.length);
        await Promise.all(AGENTS.map(async (agent, idx) => {
          try {
            const system = buildCachedSystemBlocks(tacticsSharedPrefix, tacticsInstruction(agent), lang);
            const { text, sources } = await callWithRetry({
              model: HAIKU_MODEL,
              system,
              userContent: 'Give your role-specific tactics in support of the shared recommendation.',
              maxTokens: 450,
              withSearch: true,
            });
            const localized = await localize(text, lang);
            const result: AgentStepResult = { agentId: agent.id, status: 'complete', text: localized, sources };
            tacticsResults[idx] = result;
            send({ event: 'tactics', ...result });
          } catch (err) {
            console.error('[tactics failed]', agent.id, err);
            const result: AgentStepResult = { agentId: agent.id, status: 'failed', error: (err as Error).message };
            tacticsResults[idx] = result;
            send({ event: 'tactics', ...result });
          }
        }));
        await supabase.from('rounds').update({ tactics: tacticsResults }).eq('id', roundId);

        send({ event: 'round-complete', roundId, billed });
        controller.close();
      } catch (err) {
        send({ event: 'total-failure', message: (err as Error).message || 'Unexpected error.' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
  });
}
