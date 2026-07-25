import { AGENTS, type AgentId } from '@/lib/prompts';
import { t, type Lang } from '@/lib/i18n';

// Triangle formation for the 3-agent roster — the "trinity" restyle of the
// original 5-node round-table seating diagram. The dark stage backdrop is a
// deliberate spotlight-panel accent inside the otherwise light-mode app,
// carried over from the original build.
const POS: Record<AgentId, { x: number; y: number }> = {
  investor: { x: 50, y: 20 },
  market: { x: 22, y: 72 },
  builder: { x: 78, y: 72 },
};

export default function TrinityStage({ lang, activeAgentId }: { lang: Lang; activeAgentId?: AgentId | null }) {
  return (
    <div className="stage-shell">
      <div className="stage">
        <div className="stage-beam" />
        <svg className="trinity-lines" width="100%" height="100%">
          <line x1={`${POS.investor.x}%`} y1={`${POS.investor.y}%`} x2={`${POS.market.x}%`} y2={`${POS.market.y}%`} />
          <line x1={`${POS.investor.x}%`} y1={`${POS.investor.y}%`} x2={`${POS.builder.x}%`} y2={`${POS.builder.y}%`} />
          <line x1={`${POS.market.x}%`} y1={`${POS.market.y}%`} x2={`${POS.builder.x}%`} y2={`${POS.builder.y}%`} />
        </svg>
        <div className="trinity-glow" />
        {AGENTS.map((a) => {
          const pos = POS[a.id];
          const role = lang === 'zh' ? a.roleShortZh : a.roleShort;
          return (
            <div
              key={a.id}
              className={`node${activeAgentId === a.id ? ' active' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              title={role}
            >
              <div className="node-avatar" style={{ background: a.solidVar }}>
                <span className="pulse-ring" />
                {a.initial}
              </div>
              <div className="node-label">{lang === 'zh' ? a.labelZh : a.label}</div>
            </div>
          );
        })}
        <div className="node node-human" style={{ left: '50%', top: '90%' }}>
          <div className="node-avatar">{t(lang, 'you')}</div>
          <div className="node-label">{t(lang, 'you')}</div>
        </div>
      </div>
    </div>
  );
}
