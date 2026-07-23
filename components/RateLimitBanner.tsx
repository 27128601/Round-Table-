'use client';

import { t, type Lang } from '@/lib/i18n';

export default function RateLimitBanner({ lang }: { lang: Lang }) {
  return (
    <div className="rate-banner">
      <div className="rate-banner-title">{t(lang, 'rateTitle')}</div>
      <div className="rate-banner-text">{t(lang, 'rateText')}</div>
      <div className="btn-row">
        <button className="btn" disabled>{t(lang, 'upgrade')}</button>
      </div>
    </div>
  );
}
