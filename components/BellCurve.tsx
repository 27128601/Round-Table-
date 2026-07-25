import { t, type Lang } from '@/lib/i18n';
import type { Confidence } from '@/lib/parseAlignment';

interface Props {
  score: number;
  confidence: Confidence;
  lang: Lang;
}

function zoneKey(score: number) {
  return score >= 70 ? 'zoneHigh' : score >= 40 ? 'zoneMid' : 'zoneLow';
}
function confKey(confidence: Confidence) {
  return confidence === 'HIGH' ? 'confHigh' : confidence === 'LOW' ? 'confLow' : 'confMed';
}
function zoneColor(score: number) {
  return score >= 70 ? '#3f9e6a' : score >= 40 ? '#d98412' : '#d8503c';
}

export default function BellCurve({ score, confidence, lang }: Props) {
  const W = 150, H = 42, pad = 8;
  const clamped = Math.max(1, Math.min(99, score));
  const x = pad + (clamped / 100) * (W - 2 * pad);
  const bandW = confidence === 'HIGH' ? 8 : confidence === 'LOW' ? 26 : 15;
  const color = zoneColor(clamped);

  const pts: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const px = pad + (i * (W - 2 * pad)) / 30;
    const tt = (i / 30 - 0.5) * 3;
    const py = H - 7 - (H - 16) * Math.exp(-tt * tt * 2);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const path = `M${pad},${H - 7} L${pts.join(' L ')} L${W - pad},${H - 7} Z`;

  return (
    <div className="curve" title={t(lang, 'curveTip')}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={path} fill="rgba(20,18,28,0.07)" stroke="rgba(20,18,28,0.28)" strokeWidth={1} />
        <rect x={(x - bandW).toFixed(1)} y={7} width={bandW * 2} height={H - 14} fill={color} opacity={0.16} rx={3} />
        <line x1={x.toFixed(1)} y1={6} x2={x.toFixed(1)} y2={H - 7} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <div className="curve-lab">
        <span style={{ color, fontWeight: 650 }}>{t(lang, zoneKey(clamped))}</span>
        <span className="curve-conf">{t(lang, confKey(confidence))}</span>
      </div>
    </div>
  );
}
