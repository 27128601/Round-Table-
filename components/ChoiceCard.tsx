'use client';

import { t, type Lang } from '@/lib/i18n';

export default function ChoiceCard({
  lang, busy, onAnswerAgain, onLetDebate, onWrapUp,
}: {
  lang: Lang;
  busy: boolean;
  onAnswerAgain: () => void;
  onLetDebate: () => void;
  onWrapUp: () => void;
}) {
  return (
    <div className="choice-card">
      <div className="choice-q">{t(lang, 'whatNext')}</div>
      <div className="choice-opts">
        <button className="choice-opt" disabled={busy} onClick={onAnswerAgain}>
          <div className="opt-title">{t(lang, 'optAgain')}</div>
          <div className="opt-desc">{t(lang, 'optAgainD')}</div>
        </button>
        <button className="choice-opt" disabled={busy} onClick={onLetDebate}>
          <div className="opt-title">{t(lang, 'optDebate')}</div>
          <div className="opt-desc">{t(lang, 'optDebateD')}</div>
        </button>
        <button className="choice-opt" disabled={busy} onClick={onWrapUp}>
          <div className="opt-title">{t(lang, 'optWrap')}</div>
          <div className="opt-desc">{t(lang, 'optWrapD')}</div>
        </button>
      </div>
    </div>
  );
}
