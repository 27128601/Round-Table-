'use client';

import { t, type Lang } from '@/lib/i18n';
import type { PlanRow } from '@/lib/types';

export default function PlanCard({ plan, lang }: { plan: PlanRow; lang: Lang }) {
  return (
    <div className="plan-card">
      <div className="rec-tag" style={{ marginBottom: 10 }}>{t(lang, 'planTag')}</div>
      <div className="plan-title">{plan.title}</div>
      {plan.steps.map((s, i) => (
        <div className="plan-step" key={i}><span className="num">{i + 1}</span><span>{s}</span></div>
      ))}
      {plan.risk && <div className="plan-foot"><b>{t(lang, 'planRisk')}</b> {plan.risk}</div>}
      {plan.validate && <div className="plan-foot"><b>{t(lang, 'planValidate')}</b> {plan.validate}</div>}
    </div>
  );
}
