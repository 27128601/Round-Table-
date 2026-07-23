'use client';

import { useVoiceInput } from '@/lib/useVoiceInput';
import type { Lang } from '@/lib/i18n';

export default function MicButton({ lang, onResult }: { lang: Lang; onResult: (text: string) => void }) {
  const { supported, recording, toggle } = useVoiceInput(lang, onResult);

  if (!supported) {
    return (
      <button className="mic-btn" disabled title="Voice input isn't supported in this browser">
        🎤
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
      🎤
    </button>
  );
}
