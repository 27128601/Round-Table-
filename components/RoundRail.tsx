import { t, type Lang } from '@/lib/i18n';

// Inline horizontal 3-step progress rail — restored from the original
// prototype's #rail (Debate / Your turn / They react). Complements
// StepTracker's vertical 5-step sidebar, which only shows on wide screens;
// this rail is always visible right under the stage, matching the original.
const RAIL_STEPS: { n: 1 | 2 | 3; key: 'rail1' | 'rail2' | 'rail3' }[] = [
  { n: 1, key: 'rail1' },
  { n: 2, key: 'rail2' },
  { n: 3, key: 'rail3' },
];

export default function RoundRail({ lang, currentStepId }: { lang: Lang; currentStepId: string }) {
  const step = currentStepId === 'debate' ? 1
    : currentStepId === 'turn' ? 2
    : currentStepId === 'react' ? 3
    : currentStepId === 'wrap' ? 4
    : 0;
  if (step === 0) return null;

  return (
    <div className="rail">
      {RAIL_STEPS.map((s, i) => (
        <div key={s.n} style={{ display: 'contents' }}>
          <div className={`rail-step${s.n === step ? ' active' : ''}${s.n < step ? ' complete' : ''}`}>
            <span className="rail-dot">{s.n < step ? '✓' : s.n}</span>
            <span>{t(lang, s.key)}</span>
          </div>
          {i < RAIL_STEPS.length - 1 && <div className={`rail-line${s.n < step ? ' complete' : ''}`} />}
        </div>
      ))}
    </div>
  );
}
