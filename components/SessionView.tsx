'use client';

import { useEffect, useRef, useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import type { AgentStep, SessionDetail, RoundRow } from '@/lib/types';
import type { AgentId } from '@/lib/prompts';
import type { Source } from '@/lib/anthropic';
import RoundBlock from './RoundBlock';
import AgentMessage from './AgentMessage';
import { agentLabel } from './AgentBadge';
import HumanTurnCard from './HumanTurnCard';
import ChoiceCard from './ChoiceCard';
import PlanCard from './PlanCard';
import RateLimitBanner from './RateLimitBanner';

type Stage = 'grounding' | 'initial' | 'alignment' | 'tactics' | 'done';

interface LiveRound {
  kind: 'initial' | 'reaction' | 'standalone';
  stage: Stage;
  groundingSources?: Source[];
  initialTakes: Partial<Record<AgentId, AgentStep>>;
  alignmentText?: string;
  tactics: Partial<Record<AgentId, AgentStep>>;
  totalFailure?: string;
}

interface NDJSONEvent {
  event: string;
  stage?: Stage;
  status?: string;
  sources?: Source[];
  agentId?: AgentId;
  text?: string;
  error?: string;
  message?: string;
  billed?: boolean;
  roundId?: string;
}

async function fetchJson<T>(url: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(url, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export default function SessionView({ initial, autoStart }: { initial: SessionDetail; autoStart: boolean }) {
  const [detail, setDetail] = useState(initial);
  const [lang, setLang] = useState<Lang>(initial.session.lang);
  const [liveRound, setLiveRound] = useState<LiveRound | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [humanQuestions, setHumanQuestions] = useState<{ agentId: string; question: string }[] | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const startedRef = useRef(false);
  const askedRef = useRef(false);

  const sessionId = detail.session.id;

  async function refetchDetail() {
    const { data } = await fetchJson<SessionDetail>(`/api/session/${sessionId}`);
    if (data.session) setDetail(data);
  }

  function changeLang(l: Lang) {
    setLang(l);
    fetch(`/api/session/${sessionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: l }),
    }).catch(() => {});
  }

  async function runRound(kind: 'initial' | 'reaction' | 'standalone', humanTurnId?: string) {
    setBusy(true);
    setRateLimited(false);
    setLiveRound({ kind, stage: 'grounding', initialTakes: {}, tactics: {} });

    const res = await fetch('/api/round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, kind, humanTurnId }),
    });

    if (res.status === 429) {
      setRateLimited(true);
      setLiveRound(null);
      setBusy(false);
      return;
    }
    if (!res.body) { setLiveRound(null); setBusy(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let evt: NDJSONEvent;
        try { evt = JSON.parse(line); } catch { continue; }
        setLiveRound((prev) => {
          if (!prev) return prev;
          const next: LiveRound = { ...prev, initialTakes: { ...prev.initialTakes }, tactics: { ...prev.tactics } };
          if (evt.event === 'status' && evt.stage) next.stage = evt.stage;
          else if (evt.event === 'grounding-done') next.groundingSources = evt.sources;
          else if (evt.event === 'initial-take' && evt.agentId) {
            next.initialTakes[evt.agentId] = { agentId: evt.agentId, status: evt.status === 'complete' ? 'complete' : 'failed', text: evt.text, sources: evt.sources, error: evt.error } as AgentStep;
          } else if (evt.event === 'alignment-done') next.alignmentText = evt.text;
          else if (evt.event === 'tactics' && evt.agentId) {
            next.tactics[evt.agentId] = { agentId: evt.agentId, status: evt.status === 'complete' ? 'complete' : 'failed', text: evt.text, sources: evt.sources, error: evt.error } as AgentStep;
          } else if (evt.event === 'total-failure') { next.totalFailure = evt.message; next.stage = 'done'; }
          else if (evt.event === 'round-complete') next.stage = 'done';
          return next;
        });
      }
    }

    await refetchDetail();
    setLiveRound(null);
    setBusy(false);

    if (kind === 'initial') {
      loadHumanQuestions();
    }
  }

  async function loadHumanQuestions() {
    setLoadingQuestions(true);
    const { data } = await fetchJson<{ questions: { agentId: string; question: string }[] }>('/api/human-turn', { sessionId });
    setHumanQuestions(data.questions || []);
    setLoadingQuestions(false);
  }

  async function submitHumanAnswers(answers: { agentId: string; answer: string }[], generalNote: string) {
    setBusy(true);
    const { status, data } = await fetchJson<{ humanTurnId?: string }>('/api/human-turn/answer', {
      sessionId, questions: humanQuestions, answers, generalNote,
    });
    if (status === 429) { setRateLimited(true); setBusy(false); return; }
    setHumanQuestions(null);
    setBusy(false);
    await refetchDetail();
    if (data.humanTurnId) runRound('reaction', data.humanTurnId);
  }

  async function handleReply(agentId: string, message: string, recentText: string): Promise<string | null> {
    const { status, data } = await fetchJson<{ reply?: string }>('/api/agent-reply', {
      sessionId, agentId, founderMessage: message, agentRecentText: recentText,
    });
    if (status === 429) { setRateLimited(true); return null; }
    await refetchDetail();
    return data.reply || null;
  }

  async function handleWrapUp() {
    setBusy(true);
    await fetchJson('/api/wrap-up', { sessionId });
    setBusy(false);
    await refetchDetail();
  }

  async function downloadPdf() {
    setGeneratingPdf(true);
    const res = await fetch('/api/pdf', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }),
    });
    setGeneratingPdf(false);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'round-table-report.pdf'; a.click();
    URL.revokeObjectURL(url);
  }

  // Auto-start round 1 for a brand-new session.
  useEffect(() => {
    if (startedRef.current) return;
    if (detail.rounds.length === 0 && autoStart) {
      startedRef.current = true;
      queueMicrotask(() => runRound('initial'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume rule: if the latest round is a completed 'initial' round and no
  // human turn has been recorded yet, the mandatory human-turn step is owed.
  useEffect(() => {
    if (liveRound || humanQuestions || loadingQuestions || askedRef.current) return;
    const rounds = detail.rounds;
    if (rounds.length === 0) return;
    const latest = rounds[rounds.length - 1];
    if (latest.kind === 'initial' && latest.alignment_status === 'complete' && detail.humanTurns.length === 0) {
      askedRef.current = true;
      queueMicrotask(() => loadHumanQuestions());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const rounds = detail.rounds;
  const latest = rounds[rounds.length - 1];
  const showChoice = !liveRound && !humanQuestions && !loadingQuestions && latest
    && (latest.kind === 'reaction' || latest.kind === 'standalone') && latest.alignment_status !== 'not_attempted';
  const showManualStart = !liveRound && !humanQuestions && !loadingQuestions && rounds.length === 0 && !autoStart;

  return (
    <div className="wrap">
      <header>
        <div className="lang-toggle">
          <button className={`lang-btn${lang === 'en' ? ' on' : ''}`} onClick={() => changeLang('en')}>EN</button>
          <button className={`lang-btn${lang === 'zh' ? ' on' : ''}`} onClick={() => changeLang('zh')}>中文</button>
        </div>
        <div className="eyebrow">{t(lang, 'eyebrow')}</div>
        <h1 style={{ fontSize: 20 }}>{detail.session.title}</h1>
        <p className="subtitle">{detail.session.idea_text}</p>
      </header>

      {rateLimited && <RateLimitBanner lang={lang} />}

      {showManualStart && (
        <div className="btn-row"><button className="btn" onClick={() => runRound('initial')}>{t(lang, 'seat')}</button></div>
      )}

      {rounds.map((r) => (
        <RoundDivider key={r.id} label={roundLabel(r, lang)}>
          <RoundBlock round={r} lang={lang} onReply={handleReply} />
        </RoundDivider>
      ))}

      {liveRound && (
        <RoundDivider label={liveRoundLabel(liveRound, lang)}>
          <LiveRoundView live={liveRound} lang={lang} />
        </RoundDivider>
      )}

      {loadingQuestions && (
        <div className="status-line"><div className="spinner" />{t(lang, 'forming')}</div>
      )}

      {humanQuestions && (
        <HumanTurnCard questions={humanQuestions} lang={lang} busy={busy} onSubmit={submitHumanAnswers} />
      )}

      {showChoice && (
        <ChoiceCard
          lang={lang}
          busy={busy}
          onAnswerAgain={loadHumanQuestions}
          onLetDebate={() => runRound('standalone')}
          onWrapUp={handleWrapUp}
        />
      )}

      {detail.plans.map((p) => <PlanCard key={p.id} plan={p} lang={lang} />)}

      {detail.plans.length > 0 && (
        <div className="export-bar">
          <button className="btn btn-ghost" disabled={generatingPdf} onClick={downloadPdf}>
            {generatingPdf ? t(lang, 'generatingPdf') : t(lang, 'downloadPdf')}
          </button>
        </div>
      )}
    </div>
  );
}

function roundLabel(r: RoundRow, lang: Lang) {
  if (r.kind === 'initial') return t(lang, 'r1');
  if (r.kind === 'reaction') return t(lang, 'r3');
  return t(lang, 'rSelf');
}
function liveRoundLabel(live: LiveRound, lang: Lang) {
  if (live.kind === 'initial') return t(lang, 'r1');
  if (live.kind === 'reaction') return t(lang, 'r3');
  return t(lang, 'rSelf');
}

function RoundDivider({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="round-divider"><span>{label}</span></div>
      {children}
    </>
  );
}

function LiveRoundView({ live, lang }: { live: LiveRound; lang: Lang }) {
  const agents: AgentId[] = ['market', 'builder', 'investor'];
  return (
    <div className="round-block">
      {live.stage === 'grounding' && <div className="status-line"><div className="spinner" />{t(lang, 'stGrounding')}</div>}

      {live.stage === 'initial' && (
        <div className="tactics-list">
          {agents.map((id) => live.initialTakes[id]
            ? <AgentMessage key={id} agentId={id} text={live.initialTakes[id]!.text} sources={live.initialTakes[id]!.sources} error={live.initialTakes[id]!.error} lang={lang} />
            : <div className="status-line" key={id}><div className="spinner" />{t(lang, 'stInitial', { n: agentLabel(id, lang) })}</div>)}
        </div>
      )}

      {(live.stage === 'alignment') && (
        <div className="status-line"><div className="spinner" />{t(lang, 'stAligning')}</div>
      )}

      {live.alignmentText && (
        <div className="rec-card">
          <div className="rec-top"><span className="rec-tag">{t(lang, 'recTag')}</span></div>
          <div className="rec-text">{live.alignmentText}</div>
        </div>
      )}

      {live.stage === 'tactics' && (
        <div className="tactics-list">
          {agents.map((id) => live.tactics[id]
            ? <AgentMessage key={id} agentId={id} text={live.tactics[id]!.text} sources={live.tactics[id]!.sources} error={live.tactics[id]!.error} lang={lang} />
            : <div className="status-line" key={id}><div className="spinner" />{t(lang, 'stTactics', { n: agentLabel(id, lang) })}</div>)}
        </div>
      )}

      {live.totalFailure && <div className="error-msg">{t(lang, 'totalFailure')}</div>}
    </div>
  );
}
