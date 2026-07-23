'use client';

import { useState } from 'react';
import { agentLabel } from './AgentBadge';
import { t, type Lang } from '@/lib/i18n';
import MicButton from './MicButton';

interface Question { agentId: string; question: string }

export default function HumanTurnCard({
  questions, lang, busy, onSubmit,
}: {
  questions: Question[];
  lang: Lang;
  busy: boolean;
  onSubmit: (answers: { agentId: string; answer: string }[], generalNote: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generalNote, setGeneralNote] = useState('');
  const [showAll, setShowAll] = useState(false);

  const top3 = questions.slice(0, 3);
  const rest = questions.slice(3);
  const canSend = Object.values(answers).some((v) => v.trim()) || generalNote.trim();

  function renderQ(q: Question) {
    return (
      <div className="q-block" key={q.agentId}>
        <div className="q-label">
          <span className="q-badge" style={{ background: 'var(--surface)', borderColor: 'var(--line-strong)', color: 'var(--ink-soft)' }}>
            {agentLabel(q.agentId, lang)}
          </span>
          <span className="q-text">{q.question}</span>
        </div>
        <div className="field-with-mic">
          <textarea
            className="q-input"
            placeholder={t(lang, 'yourAnswer')}
            value={answers[q.agentId] || ''}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.agentId]: e.target.value }))}
          />
          <MicButton lang={lang} onResult={(txt) => setAnswers((prev) => ({ ...prev, [q.agentId]: (prev[q.agentId] || '') + ' ' + txt }))} />
        </div>
      </div>
    );
  }

  return (
    <div className="human-card">
      <div className="human-title">{t(lang, 'humanTitle')}</div>
      <div className="human-sub">{t(lang, 'humanSub')}</div>
      {top3.map(renderQ)}
      {rest.length > 0 && (
        <>
          <button className="see-all" onClick={() => setShowAll((v) => !v)}>
            {t(lang, 'seeAll')} {showAll ? '▴' : '▾'}
          </button>
          {showAll && rest.map(renderQ)}
        </>
      )}
      <hr className="divider-line" />
      <div className="q-block">
        <div className="q-label"><span style={{ fontSize: 12, fontWeight: 650, color: 'var(--ink-soft)' }}>{t(lang, 'generalNotes')}</span></div>
        <div className="field-with-mic">
          <textarea className="q-input" placeholder={t(lang, 'generalPh')} value={generalNote} onChange={(e) => setGeneralNote(e.target.value)} />
          <MicButton lang={lang} onResult={(txt) => setGeneralNote((prev) => (prev ? prev + ' ' : '') + txt)} />
        </div>
      </div>
      <div className="btn-row">
        <button
          className="btn"
          disabled={!canSend || busy}
          onClick={() => onSubmit(
            Object.entries(answers).filter(([, v]) => v.trim()).map(([agentId, answer]) => ({ agentId, answer: answer.trim() })),
            generalNote.trim()
          )}
        >
          {busy ? '…' : t(lang, 'sendTable')}
        </button>
      </div>
    </div>
  );
}
