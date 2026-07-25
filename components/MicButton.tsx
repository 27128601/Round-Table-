'use client';

import { useVoiceInput } from '@/lib/useVoiceInput';
import type { Lang } from '@/lib/i18n';

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5.5A3.5 3.5 0 0 0 12 15Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 16.5V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SoundWave() {
  return (
    <span className="wave-bars" aria-hidden>
      <span className="wave-bar" />
      <span className="wave-bar" />
      <span className="wave-bar" />
      <span className="wave-bar" />
      <span className="wave-bar" />
    </span>
  );
}

export default function MicButton({ lang, onResult }: { lang: Lang; onResult: (text: string) => void }) {
  const { supported, recording, toggle } = useVoiceInput(lang, onResult);

  if (!supported) {
    return (
      <button className="mic-btn" disabled title="Voice input isn't supported in this browser">
        <MicIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`mic-btn${recording ? ' recording' : ''}`}
      onClick={toggle}
      title={recording ? 'Stop recording' : 'Start voice input'}
    >
      {recording ? <SoundWave /> : <MicIcon />}
    </button>
  );
}
