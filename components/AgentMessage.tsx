'use client';

import { useState } from 'react';
import AgentBadge, { agentLabel } from './AgentBadge';
import { parseAgentText, renderBullets } from '@/lib/parseAgentText';
import type { Source } from '@/lib/anthropic';
import type { Lang } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface Props {
  agentId: string;
  text?: string;
  sources?: Source[];
  error?: string;
  lang: Lang;
  onReply?: (message: string) => Promise<string | null>;
}

export default function AgentMessage({ agentId, text, sources, error, lang, onReply }: Props) {
  const [open, setOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<{ who: string; text: string }[]>([]);
  const [sending, setSending] = useState(false);

  if (error || !text) {
    return (
      <div className="msg">
        <div className="msg-head">
          <AgentBadge agentId={agentId} />
          <span className="msg-summary">{t(lang, 'stepFailed', { n: agentLabel(agentId, lang) })}</span>
        </div>
      </div>
    );
  }

  const { summary, bulletLines } = parseAgentText(text);
  const bullets = renderBullets(bulletLines);

  async function send() {
    const val = draft.trim();
    if (!val || !onReply || sending) return;
    setSending(true);
    setDraft('');
    setThread((prev) => [...prev, { who: t(lang, 'you'), text: val }]);
    const reply = await onReply(val);
    setSending(false);
    if (reply) setThread((prev) => [...prev, { who: agentLabel(agentId, lang), text: reply }]);
  }

  return (
    <div className={`msg${open ? ' open' : ''}${threadOpen ? ' thread-open' : ''}`}>
      <div className="msg-head" onClick={() => setOpen((v) => !v)}>
        <AgentBadge agentId={agentId} />
        <span className="msg-summary">{summary}</span>
        {onReply && (
          <button
            className="reply-btn"
            title={t(lang, 'replyTitle', { n: agentLabel(agentId, lang) })}
            onClick={(e) => { e.stopPropagation(); setThreadOpen((v) => !v); }}
          >
            {t(lang, 'reply')}
          </button>
        )}
        <span className="msg-chevron">▾</span>
      </div>
      <div className="msg-body">
        <div className="msg-body-inner">
          {bullets.map((b, i) => (
            <div className="bullet" key={i}>
              {b.label ? <span className="bullet-label">{b.label}</span> : null}
              <span className={b.label ? 'bullet-body' : 'bullet-full'}>{b.body}</span>
            </div>
          ))}
          {sources && sources.length > 0 && (
            <div className="bullet">
              <span className="bullet-full">
                {sources.map((s, i) => (
                  <a key={i} className="source-link" href={s.url} target="_blank" rel="noreferrer">[{s.title || s.url}]</a>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
      {onReply && (
        <div className="thread">
          {thread.map((m, i) => (
            <div className="t-msg" key={i}><span className="t-who">{m.who}</span>{m.text}</div>
          ))}
          <div className="t-input-row">
            <textarea
              className="t-input"
              placeholder={t(lang, 'threadPh', { n: agentLabel(agentId, lang) })}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn btn-sm" disabled={sending} onClick={send}>{t(lang, 'send')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
