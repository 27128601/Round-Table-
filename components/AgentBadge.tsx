import { AGENTS, type AgentId } from '@/lib/prompts';
import type { Lang } from '@/lib/i18n';

export function agentLabel(agentId: AgentId | string, lang: Lang) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return agentId;
  return lang === 'zh' ? agent.labelZh : agent.label;
}

export default function AgentBadge({ agentId }: { agentId: AgentId | string }) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return <span className="msg-badge">{agentId}</span>;
  return (
    <span className="msg-badge" style={{ background: agent.bgVar, color: agent.colorVar, borderColor: agent.borderVar }}>
      {agent.label}
    </span>
  );
}
