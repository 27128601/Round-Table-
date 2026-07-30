import BellCurve from './BellCurve';
import { parseAlignment } from '@/lib/parseAlignment';
import { t, type Lang } from '@/lib/i18n';

// Restored to match the original single-file prototype's `.synth-card`
// hierarchy: tag+curve row, bold conclusion, numbered supporting points,
// an italic forward-looking restate line, then a small hint pointing at
// the full per-agent detail below. See round-table feedback item 3/15.
export default function RecommendationCard({ text, lang }: { text: string; lang: Lang }) {
  const { conclusion, points, restate, score, confidence } = parseAlignment(text);
  return (
    <div className="rec-card">
      <div className="rec-top">
        <span className="rec-tag">{t(lang, 'recTag')}</span>
        {score !== null && confidence !== null && <BellCurve score={score} confidence={confidence} lang={lang} />}
      </div>
      <div className="rec-text">{conclusion}</div>
      {points.length > 0 && (
        <div className="rec-points">
          {points.map((p, i) => (
            <div className="rec-point" key={i}>
              <span className="num">{i + 1}</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}
      {restate && <div className="rec-restate">{restate}</div>}
      <div className="rec-hint">{t(lang, 'recHint')}</div>
    </div>
  );
}
