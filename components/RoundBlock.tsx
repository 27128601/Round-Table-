'use client';

import { useState } from 'react';
import AgentMessage from './AgentMessage';
import BellCurve from './BellCurve';
import { parseAlignment } from '@/lib/parseAlignment';
import { t, type Lang } from '@/lib/i18n';
import type { RoundRow } from '@/lib/types';

interface Props {
  round: RoundRow;
  lang: Lang;
  onReply?: (agentId: string, message: string, recentText: string) => Promise<string | null>;
  marked?: boolean;
  checkpointDisabled?: boolean;
  onToggleMark?: () => void;
  onReturnHere?: () => void;
}

export default function RoundBlock({ round, lang, onReply, marked, checkpointDisabled, onToggleMark, onReturnHere }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="round-block">
      {(onToggleMark || onReturnHere) && (
        <div className={`checkpoint-bar${marked ? ' marked' : ''}`}>
          <button className="checkpoint-btn" disabled={checkpointDisabled} onClick={onToggleMark}>
            <span className="checkpoint-flag">⚑</span> {marked ? t(lang, 'marked') : t(lang, 'mark')}
          </button>
          {marked && (
            <button className="checkpoint-btn checkpoint-return" disabled={checkpointDisabled} onClick={onReturnHere}>
              ↩ {t(lang, 'returnHere')}
            </button>
          )}
        </div>
      )}

      {round.alignment_status === 'complete' && round.alignment_result && (() => {
        const { displayText, score, confidence } = parseAlignment(round.alignment_result);
        return (
          <div className="rec-card">
            <div className="rec-top">
              <span className="rec-tag">{t(lang, 'recTag')}</span>
              {score !== null && confidence !== null && <BellCurve score={score} confidence={confidence} lang={lang} />}
            </div>
            <div className="rec-text">{displayText}</div>
          </div>
        );
      })()}

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
