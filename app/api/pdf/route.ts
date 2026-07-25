import { createClient } from '@/lib/supabase/server';
import { AGENTS, pdfSummarizeSystem } from '@/lib/prompts';
import { callWithRetry, needsZhBackstop, translateBackstop, HAIKU_MODEL } from '@/lib/anthropic';
import { parseAlignment } from '@/lib/parseAlignment';
import { ZH_INSTRUCTION, type Lang } from '@/lib/i18n';
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import React from 'react';

// Server-generated branded PDF export (§11). Uncounted against the 15-message
// rate limit per §10.1 (the "final output" carve-out).
export const maxDuration = 30;

// Helvetica (react-pdf's built-in default) has no CJK glyphs — Chinese-mode
// PDFs rendered garbage before this. Register a real CJK-capable typeface and
// pick it per session language.
Font.register({
  family: 'NotoSansSC',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaGzjCnYw.ttf', fontWeight: 700 },
  ],
});

function pdfStyles(lang: Lang) {
  const fontFamily = lang === 'zh' ? 'NotoSansSC' : 'Helvetica';
  return StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily, color: '#16151a' },
  logoBox: {
    borderWidth: 1, borderColor: '#c9c6bb', borderStyle: 'dashed', borderRadius: 4,
    padding: 8, marginBottom: 20, alignSelf: 'flex-start',
  },
  logoText: { fontSize: 9, color: '#9b99a3' },
  eyebrow: { fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#9b99a3', marginBottom: 6 },
  recTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16, lineHeight: 1.4 },
  agentBlock: { marginBottom: 16 },
  agentLabel: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  bullet: { fontSize: 10.5, marginBottom: 4, lineHeight: 1.5 },
  });
}

interface AgentSummary {
  label: string;
  bullets: string[];
}

function ReportDoc({ recommendation, summaries, lang }: { recommendation: string; summaries: AgentSummary[]; lang: Lang }) {
  const styles = pdfStyles(lang);
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(View, { style: styles.logoBox }, React.createElement(Text, { style: styles.logoText }, '[Your logo here]')),
      React.createElement(Text, { style: styles.eyebrow }, lang === 'zh' ? '圆桌会议 — 共同建议' : 'THE ROUND TABLE — SHARED RECOMMENDATION'),
      React.createElement(Text, { style: styles.recTitle }, recommendation),
      ...summaries.map((s, i) =>
        React.createElement(View, { style: styles.agentBlock, key: i },
          React.createElement(Text, { style: styles.agentLabel }, s.label),
          ...s.bullets.map((b, j) => React.createElement(Text, { style: styles.bullet, key: j }, `• ${b}`))
        )
      )
    )
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const { sessionId } = (await request.json()) as { sessionId: string };
  const { data: session } = await supabase.from('sessions').select('lang').eq('id', sessionId).single();
  const lang: Lang = session?.lang === 'zh' ? 'zh' : 'en';

  const { data: rounds } = await supabase
    .from('rounds').select('*').eq('session_id', sessionId)
    .eq('alignment_status', 'complete').order('round_index', { ascending: false }).limit(1);
  const latest = rounds?.[0];
  if (!latest) return new Response(JSON.stringify({ error: 'no_recommendation_yet' }), { status: 400 });

  const summaries: AgentSummary[] = [];
  for (const agent of AGENTS) {
    const tactic = (latest.tactics as { agentId: string; status: string; text?: string }[] || [])
      .find((t) => t.agentId === agent.id && t.status === 'complete');
    if (!tactic?.text) continue;
    try {
      const system = pdfSummarizeSystem(agent) + (lang === 'zh' ? ZH_INSTRUCTION : '');
      let { text } = await callWithRetry({
        model: HAIKU_MODEL,
        system,
        userContent: tactic.text,
        maxTokens: 250,
      });
      if (lang === 'zh' && needsZhBackstop(text)) text = await translateBackstop(text);
      const bullets = text.split('\n').map((l) => l.replace(/^[•\-]\s*/, '').trim()).filter(Boolean);
      summaries.push({ label: lang === 'zh' ? agent.labelZh : agent.label, bullets });
    } catch {
      summaries.push({ label: lang === 'zh' ? agent.labelZh : agent.label, bullets: [tactic.text.slice(0, 200)] });
    }
  }

  const { displayText: recommendation } = parseAlignment(latest.alignment_result || '');

  const buffer = await renderToBuffer(
    ReportDoc({ recommendation, summaries, lang }) as Parameters<typeof renderToBuffer>[0]
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="round-table-report.pdf"',
    },
  });
}
