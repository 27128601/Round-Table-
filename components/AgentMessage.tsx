'use client';

import { useEffect, useRef, useState } from 'react';
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

// Small hand-rolled highlighter-pen glyph — plain-stroke SVG rather than an
// emoji/dingbat character, so it renders identically (and stays monochrome)
// everywhere, and reads unambiguously as "highlight" rather than the ⚑
// "mark a round" glyph used elsewhere in the app.
function HighlighterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.5 3.5 6 6L9 21H3v-6L14.5 3.5z" />
      <path d="M3 21h6" />
    </svg>
  );
}

// One shared CSS Custom Highlight API registry for the whole page, matching
// the ::highlight(quote-mark) rule in globals.css. Ranges are inherently
// scoped to their own DOM position, so a single shared Highlight set works
// fine across every message — no per-instance bucket needed. (Previously
// each AgentMessage registered its own uniquely-named bucket, but the CSS
// rule only ever targeted the literal name "quote-mark", so nothing it
// registered ever actually painted — that was the highlighting bug.)
const quoteMarkHighlight = typeof Highlight !== 'undefined' ? new Highlight() : null;
if (quoteMarkHighlight && typeof CSS !== 'undefined' && CSS.highlights) {
  CSS.highlights.set('quote-mark', quoteMarkHighlight);
}

export default function AgentMessage({ agentId, text, sources, error, lang, onReply }: Props) {
  const [open, setOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<{ who: string; text: string }[]>([]);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [selectToolbar, setSelectToolbar] = useState<{ x: number; y: number; text: string; range: Range } | null>(null);

  // Dismiss the floating highlight button on any click outside it, and on scroll.
  useEffect(() => {
    if (!selectToolbar) return;
    const clear = () => setSelectToolbar(null);
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest('.select-toolbar')) clear();
    };
    window.addEventListener('scroll', clear, true);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('scroll', clear, true);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [selectToolbar]);

  if (error || !text) {
    return (
      <div className="msg">
        <div className="msg-head">
          <AgentBadge agentId={agentId} lang={lang} />
          <span className="msg-summary">{t(lang, 'stepFailed', { n: agentLabel(agentId, lang) })}</span>
        </div>
      </div>
    );
  }

  const { summary, bulletLines } = parseAgentText(text);
  const bullets = renderBullets(bulletLines);

  function quoteInReply(quoted: string) {
    if (!onReply) return;
    setThreadOpen(true);
    setDraft((prev) => {
      const prefix = `"${quoted}" — `;
      return prev.startsWith(prefix) ? prev : prefix + prev;
    });
  }

  // Native text-selection toolbar: highlight any span of body text
  // (drag-select, not click-per-sentence) and a small floating icon toolbar
  // appears right above the selection — highlight it, or quote exactly that
  // snippet — instead of a fixed button reserving layout space after every
  // sentence.
  function handleSelectionUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !bodyRef.current) { setSelectToolbar(null); return; }
    const selected = sel.toString().trim();
    if (!selected || !bodyRef.current.contains(sel.anchorNode)) { setSelectToolbar(null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = bodyRef.current.getBoundingClientRect();
    setSelectToolbar({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
      text: selected,
      range: range.cloneRange(),
    });
  }

  // Dedicated highlighter: leaves a persistent yellow highlight on the
  // selected text via the CSS Custom Highlight API (no DOM mutation, so it
  // survives re-renders) and does nothing else.
  function highlightSelection() {
    if (!selectToolbar) return;
    quoteMarkHighlight?.add(selectToolbar.range);
    setSelectToolbar(null);
    window.getSelection()?.removeAllRanges();
  }

  // Dedicated quote: quotes exactly the selected snippet into the reply
  // thread (distinct from the header's quote button, which always quotes
  // the whole summary line) and does nothing else — no highlight side effect.
  function quoteSelection() {
    if (!selectToolbar) return;
    quoteInReply(selectToolbar.text);
    setSelectToolbar(null);
    window.getSelection()?.removeAllRanges();
  }

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
        <AgentBadge agentId={agentId} lang={lang} />
        <span className="msg-summary">{summary}</span>
        {onReply && (
          <button
            className="quote-btn quote-btn-summary"
            title={t(lang, 'quoteThis')}
            onClick={(e) => { e.stopPropagation(); quoteInReply(summary); }}
          >
            &ldquo;
          </button>
        )}
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
        <div className="msg-body-inner" ref={bodyRef} onMouseUp={handleSelectionUp}>
          {selectToolbar && (
            <div className="select-toolbar" style={{ left: selectToolbar.x, top: selectToolbar.y }}>
              <button className="select-icon-btn" title={t(lang, 'markThis')} onClick={highlightSelection}>
                <HighlighterIcon />
              </button>
              {onReply && (
                <button className="select-icon-btn" title={t(lang, 'quoteThis')} onClick={quoteSelection}>
                  &ldquo;
                </button>
              )}
            </div>
          )}
          {bullets.map((b, i) => (
            <div className="bullet" key={i}>
              {b.label ? <div className="bullet-label">{b.label}</div> : null}
              <div className={b.label ? 'bullet-body' : 'bullet-full'}>{b.body}</div>
            </div>
          ))}
          {sources && sources.length > 0 && (
            <div className="bullet">
              <div className="bullet-full">
                {sources.map((s, i) => (
                  <a key={i} className="source-link" href={s.url} target="_blank" rel="noreferrer">[{s.title || s.url}]</a>
                ))}
              </div>
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
