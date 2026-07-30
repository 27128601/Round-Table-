import Image from 'next/image';
import type { AgentId } from '@/lib/prompts';
import type { Lang } from '@/lib/i18n';

// Static illustrated hero — all 5 advisors seated at the round table —
// replacing the earlier rough.js sketch diagram entirely, per explicit
// request. `activeAgentId`/`lang` are no longer used by the artwork itself
// (kept in the signature so call sites don't need to change) since the
// illustration doesn't highlight individual agents.
export default function TrinityStage({ lang, activeAgentId }: { lang: Lang; activeAgentId?: AgentId | null }) {
  void lang;
  void activeAgentId;
  return (
    <div className="hero-table-wrap">
      <Image
        src="/hero-table.webp"
        alt="The five advisors debating around the round table"
        width={1600}
        height={893}
        className="hero-table-img"
        priority
      />
    </div>
  );
}
