import Image from 'next/image';
import { AGENTS, type AgentId } from '@/lib/prompts';
import type { Lang } from '@/lib/i18n';

export function agentLabel(agentId: AgentId | string, lang: Lang) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return agentId;
  return lang === 'zh' ? agent.labelZh : agent.label;
}

// Small mascot-icon badge, replacing the old text pill — see round-table
// feedback item 5 ("change the names into the icons for the response").
export default function AgentBadge({ agentId, lang = 'en' }: { agentId: AgentId | string; lang?: Lang }) {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return <span className="msg-badge">{agentId}</span>;
  const role = lang === 'zh' ? agent.roleShortZh : agent.roleShort;
  const name = lang === 'zh' ? agent.labelZh : agent.label;
  return (
    <span className="msg-badge-stack" title={`${name} — ${role}`}>
      <span className="msg-badge-icon">
        <Image src={agent.mascot} alt={name} fill sizes="85px" className="msg-badge-mascot" />
      </span>
      <span className="msg-badge-name">{name}</span>
    </span>
  );
}
