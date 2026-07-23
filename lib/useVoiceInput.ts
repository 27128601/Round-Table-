'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Lang } from './i18n';

// Browser-native Web Speech API voice input (§7). No transcription service —
// purely client-side. Support is inconsistent across browsers (notably
// Firefox), so callers must check `supported` and hide/disable the mic button
// rather than showing a silently-dead one.

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

export function useVoiceInput(lang: Lang, onResult: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSupported(!!getRecognitionCtor()));
  }, []);

  const toggle = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event: unknown) => {
      const e = event as { results: { transcript: string }[][] };
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ');
      onResult(transcript);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }, [recording, lang, onResult]);

  return { supported, recording, toggle };
}
