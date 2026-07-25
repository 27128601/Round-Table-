import { t, type Lang, type StrKey } from '@/lib/i18n';

const STEPS: { id: string; key: StrKey }[] = [
  { id: 'describe', key: 'sDescribe' },
  { id: 'debate', key: 'sDebate' },
  { id: 'turn', key: 'sTurn' },
  { id: 'react', key: 'sReact' },
  { id: 'wrap', key: 'sWrap' },
];

export default function StepTracker({ lang, currentStepId }: { lang: Lang; currentStepId: string }) {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStepId);

  return (
    <div className="side">
      <div className="side-title">{t(lang, 'sideTitle')}</div>
      {STEPS.map((s, i) => (
        <div key={s.id}>
          <div className={`side-step${i === currentIdx ? ' active' : ''}${i < currentIdx ? ' complete' : ''}`}>
            <span className="sdot">{i < currentIdx ? '✓' : i + 1}</span>
            <span>{t(lang, s.key)}</span>
          </div>
          {i < STEPS.length - 1 && <div className="side-line" />}
        </div>
      ))}
    </div>
  );
}
