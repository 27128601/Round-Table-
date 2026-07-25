import { AGENTS } from './prompts';
import { parseAlignment } from './parseAlignment';
import type { SessionDetail } from './types';

// Plain-text transcript of the whole session, for the "copy full
// conversation" button — ported from the original single-file build's
// buildTranscript().
export function buildTranscript(detail: SessionDetail): string {
  const lines: string[] = [];
  lines.push(`THE ROUND TABLE — ${detail.session.title}`);
  lines.push('');
  lines.push(detail.session.idea_text);
  lines.push('');

  for (const round of detail.rounds) {
    lines.push(`--- Round ${round.round_index} (${round.kind}) ---`);
    for (const it of round.initial_takes) {
      const agent = AGENTS.find((a) => a.id === it.agentId);
      lines.push(`[${agent?.label || it.agentId}] ${it.text || it.error || ''}`);
    }
    if (round.alignment_result) {
      const { displayText } = parseAlignment(round.alignment_result);
      lines.push(`[Shared recommendation] ${displayText}`);
    }
    for (const tac of round.tactics) {
      const agent = AGENTS.find((a) => a.id === tac.agentId);
      lines.push(`[${agent?.label || tac.agentId} — tactics] ${tac.text || tac.error || ''}`);
    }
    lines.push('');
  }

  for (const ht of detail.humanTurns) {
    lines.push('--- Your answers to the table ---');
    for (const a of ht.answers) {
      const agent = AGENTS.find((ag) => ag.id === a.agentId);
      lines.push(`(${agent?.label || a.agentId}) ${a.answer}`);
    }
    if (ht.general_note) lines.push(`(general notes) ${ht.general_note}`);
    lines.push('');
  }

  for (const plan of detail.plans) {
    lines.push('--- Wrap-up execution plan ---');
    if (plan.title) lines.push(plan.title);
    plan.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    if (plan.risk) lines.push(`Biggest risk: ${plan.risk}`);
    if (plan.validate) lines.push(`Validate first: ${plan.validate}`);
  }

  return lines.join('\n').trim();
}
