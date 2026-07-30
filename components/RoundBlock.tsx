'use client';

import { useState } from 'react';
import AgentMessage from './AgentMessage';
import RecommendationCard from './RecommendationCard';
import { t, type Lang } from '@/lib/i18n';
import type { RoundRow } from '@/lib/types';

interface Props {
  round: RoundRow;
  lang: Lang;
  onReply?: (agentId: string, message: string, recentText: string) => Promise<string | null>;
}

// Mark/Return-here/Copy for a round now live in the round divider itself
// (SessionView.tsx's RoundDivider), matching the original prototype where
// those controls sit inline in the divider row, not as a separate bar.
export default function RoundBlock({ round, lang, onReply }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="round-block">
      {round.alignment_status === 'complete' && round.alignment_result && (
        <RecommendationCard text={round.alignment_result} lang={lang} />
      )}

      {round.alignment_status === 'failed' && (
        <div className="error-msg">{t(lang, 'totalFailure')}</div>
      )}

      {round.alignment_status === 'complete' && (
        <div className="tactics-list">
          {round.tactics.map((tac) => (
            <AgentMessage
              key={tac.agentId}
              agentId={tac.agentId}
              text={tac.text}
              sources={tac.sources}
              error={tac.error}
              lang={lang}
              onReply={onReply ? (msg) => onReply(tac.agentId, msg, tac.text || '') : undefined}
            />
          ))}
        </div>
      )}

      {round.initial_takes.length > 0 && (
        <div className="raw-disclosure">
          <button className="raw-toggle" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? '▴' : '▾'} {t(lang, 'seeHow')}
          </button>
          <div className={`raw-body${showRaw ? ' show' : ''}`}>
            {round.initial_takes.map((it) => (
              <AgentMessage
                key={it.agentId}
                agentId={it.agentId}
                text={it.text}
                sources={it.sources}
                error={it.error}
                lang={lang}
                onReply={onReply ? (msg) => onReply(it.agentId, msg, it.text || '') : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
