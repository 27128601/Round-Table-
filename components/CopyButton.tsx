'use client';

import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';

interface Props {
  getText: () => string;
  lang: Lang;
  labelKey?: 'copy' | 'copyPlan' | 'copyFull';
  className?: string;
}

export default function CopyButton({ getText, lang, labelKey = 'copy', className = 'btn btn-ghost' }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleClick() {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        setState('copied');
      } catch {
        setState('failed');
      }
    }
    setTimeout(() => setState('idle'), 1800);
  }

  const label = state === 'copied' ? t(lang, 'copied') : state === 'failed' ? t(lang, 'copyFail') : t(lang, labelKey);

  return (
    <button className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
