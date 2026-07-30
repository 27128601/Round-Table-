'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Lang } from '@/lib/i18n';
import { convertFile, type FileConvertError } from '@/lib/fileConvert';
import MicButton from '@/components/MicButton';
import TrinityStage from '@/components/TrinityStage';
import StepTracker from '@/components/StepTracker';

const FILE_ERROR_KEY: Record<FileConvertError, Parameters<typeof t>[1]> = {
  too_large: 'errFile',
  legacy_doc: 'errDoc',
  lib_failed: 'errLib',
  parse_failed: 'errParse',
  empty_text: 'errEmpty',
};

export default function NewSessionPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const [idea, setIdea] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; markdown: string } | null>(null);
  const [attachStatus, setAttachStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clarifyQs, setClarifyQs] = useState<string[] | null>(null);
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([]);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem('rt-lang');
        if (stored === 'en' || stored === 'zh') setLang(stored);
      } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function changeLang(l: Lang) {
    setLang(l);
    try { localStorage.setItem('rt-lang', l); } catch { /* ignore */ }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachStatus(t(lang, 'parsing'));
    setError('');
    const result = await convertFile(file);
    setAttachStatus('');
    if (!result.ok) { setError(t(lang, FILE_ERROR_KEY[result.error])); return; }
    setAttachment({ name: result.name, markdown: result.markdown });
  }

  async function startFlow() {
    const trimmed = idea.trim();
    if (!trimmed) { setError(t(lang, 'errIdea')); return; }
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText: trimmed, attachments: attachment ? [attachment] : [], lang }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }
      const sessionId = data.id as string;

      const clarifyRes = await fetch('/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const clarifyData = await clarifyRes.json();
      if (clarifyData.questions?.length) {
        setPendingSessionId(sessionId);
        setClarifyQs(clarifyData.questions);
        setClarifyAnswers(new Array(clarifyData.questions.length).fill(''));
        setBusy(false);
        return;
      }

      await submitClarifyAnswers(sessionId, []);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function submitClarifyAnswers(sessionId: string, answers: string[]) {
    setBusy(true);
    await fetch('/api/clarify/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answers }),
    });
    router.push(`/session/${sessionId}?start=1`);
  }

  if (clarifyQs) {
    return (
      <div className="wrap">
        <header>
          <div className="eyebrow">{t(lang, 'eyebrow')}</div>
        </header>
        <div className="human-card">
          <div className="human-title">{t(lang, 'clarTitle')}</div>
          <div className="human-sub">{t(lang, 'clarSub')}</div>
          {clarifyQs.map((q, i) => (
            <div className="q-block" key={i}>
              <div className="q-label"><span className="q-text">{q}</span></div>
              <textarea
                className="q-input"
                placeholder={t(lang, 'yourAnswer')}
                value={clarifyAnswers[i]}
                onChange={(e) => setClarifyAnswers((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </div>
          ))}
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={() => pendingSessionId && submitClarifyAnswers(pendingSessionId, clarifyAnswers)}>
              {t(lang, 'clarGo')}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => pendingSessionId && submitClarifyAnswers(pendingSessionId, [])}>
              {t(lang, 'clarSkip')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header>
        <div className="brand-logo-tile">
          <img src="/logo-e5876259.png" alt="The Round Table" className="brand-logo" />
          <div className="brand-logo-text">
            <span className="brand-logo-name">The Round Table</span>
            <span className="brand-logo-slogan">Founding your founder dream</span>
          </div>
          <div className="lang-toggle">
            <button className={`lang-btn${lang === 'en' ? ' on' : ''}`} onClick={() => changeLang('en')}>EN</button>
            <button className={`lang-btn${lang === 'zh' ? ' on' : ''}`} onClick={() => changeLang('zh')}>中文</button>
          </div>
        </div>
        <h1>{t(lang, 'h1')}</h1>
        <p className="subtitle">{t(lang, 'subtitle')}</p>
      </header>

      <TrinityStage lang={lang} />
      <StepTracker lang={lang} currentStepId="describe" />

      <div className="panel">
        <div className="field-with-mic">
          <textarea
            placeholder={t(lang, 'ideaPh')}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <MicButton lang={lang} onResult={(text) => setIdea((prev) => (prev ? prev + ' ' : '') + text)} />
        </div>
        <div className="attach-row">
          <label className="rd-btn" style={{ cursor: 'pointer' }}>
            {t(lang, 'attach')}
            <input type="file" accept=".txt,.md,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleFileInput} />
          </label>
          {attachStatus && <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{attachStatus}</span>}
          {attachment && (
            <span className="attach-chip">
              📎 {attachment.name}
              <button onClick={() => setAttachment(null)}>✕</button>
            </span>
          )}
        </div>
        <p className="consent">{t(lang, 'consent1')}<br />{t(lang, 'consent2')}</p>
        {error && <div className="error-msg">{error}</div>}
        <div className="btn-row">
          <button className="btn" disabled={busy} onClick={startFlow}>{busy ? '…' : t(lang, 'seat')}</button>
        </div>
      </div>
    </div>
  );
}
