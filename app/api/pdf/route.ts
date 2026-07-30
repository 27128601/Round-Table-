import { createClient, getAuthedUser } from '@/lib/supabase/server';
import { AGENTS, AgentId } from '@/lib/prompts';
import { parseAlignment, type Confidence } from '@/lib/parseAlignment';
import { parseAgentText, renderBullets } from '@/lib/parseAgentText';
import { type Lang } from '@/lib/i18n';
import type { PlanRow } from '@/lib/types';
import {
  renderToBuffer, Document, Page, Text, View, StyleSheet, Font, Svg, Path, Rect, Line, Image,
} from '@react-pdf/renderer';
import React from 'react';
import path from 'path';

// Server-generated branded PDF export (§11). Uncounted against the 15-message
// rate limit per §10.1 (the "final output" carve-out). Rebuilt to mirror the
// live webpage's rec-card / advisor-card / plan-card hierarchy exactly,
// instead of running everything back through an LLM summarizer first —
// same colors, same POINT structure, same bell-curve gauge, no re-flattening.
//
// Kept in sync with the live webpage's current visual identity (paper tone,
// Fredoka display font, agent mascot icons, the round-table logo lockup) —
// this drifted out of sync once during the mascot/logo/paper-texture
// redesign since the PDF re-uses none of the CSS, only hand-mirrored values.
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

// Same chunky display face as --font-display / next/font's Fredoka on the
// webpage (app/layout.tsx) — used for the logo wordmark and the recommendation
// headline so the PDF's typography matches the page instead of falling back
// to plain Helvetica everywhere.
Font.register({
  family: 'Fredoka',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OLyXMFg.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OFiXMFg.ttf', fontWeight: 700 },
  ],
});

// Local asset paths — react-pdf's Image reads these directly off disk in this
// server context (not through Next's /public URL route).
const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-e5876259.png');
const AGENT_MASCOTS: Record<AgentId, string> = {
  visionary: path.join(process.cwd(), 'public', 'agents', 'visionary-pdf.png'),
  builder: path.join(process.cwd(), 'public', 'agents', 'builder-pdf.png'),
  market: path.join(process.cwd(), 'public', 'agents', 'market-pdf.png'),
  operator: path.join(process.cwd(), 'public', 'agents', 'operator-pdf.png'),
  storyteller: path.join(process.cwd(), 'public', 'agents', 'storyteller-pdf.png'),
};

// Same palette as app/globals.css §"Agent accent colors" — kept as a plain
// hex map here since CSS custom properties don't reach react-pdf.
const AGENT_COLORS: Record<AgentId, { bg: string; color: string; border: string; solid: string }> = {
  visionary: { bg: '#EEEDFE', color: '#3C3489', border: '#AFA9EC', solid: '#6A5BD4' },
  market: { bg: '#FAEEDA', color: '#633806', border: '#EF9F27', solid: '#D98412' },
  builder: { bg: '#E1F5EE', color: '#085041', border: '#5DCAA5', solid: '#1F9B78' },
  operator: { bg: '#FAECE7', color: '#712B13', border: '#F0997B', solid: '#D85F3C' },
  storyteller: { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB', solid: '#2B7BD4' },
};

const PAPER = '#E7E4DD'; // matches --bg/--paper in app/globals.css (cool-toned paper, post-redesign)
const SURFACE = '#ffffff';
const INK = '#16151a';
const INK_SOFT = '#5a5862';
const INK_FAINT = '#9b99a3';

// @react-pdf/renderer's color resolver (used for both StyleSheet colors and
// SVG fill/stroke) doesn't reliably parse rgba(...) strings — instead of
// the intended translucent tint it was silently falling back to solid red
// everywhere an rgba() value was used (every card border, the restate
// divider, and the whole bell-curve background all rendered pure red).
// Precomputing the equivalent flat hex color against the surface it sits on
// sidesteps the parser entirely.
function blend(hex: string, alpha: number, bg = '#ffffff') {
  const h = hex.replace('#', '');
  const b = bg.replace('#', '');
  const [r1, g1, b1] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r2, g2, b2] = [0, 2, 4].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = (a: number, c: number) => Math.round(a * alpha + c * (1 - alpha));
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const LINE_STRONG = blend(INK, 0.18); // was rgba(20,18,28,0.18) over white
const LINE_SOFT = blend(INK, 0.1); // was rgba(20,18,28,0.1) over white

const COPY = {
  eyebrow: { en: 'THE ROUND TABLE — SESSION REPORT', zh: '圆桌会议 — 会话报告' },
  recTag: { en: 'Shared recommendation', zh: '共同建议' },
  recHint: { en: "Each advisor's full argument follows below", zh: '下方为各顾问完整论述' },
  advisorsTitle: { en: 'The advisors', zh: '顾问意见' },
  planTag: { en: 'Wrap-up · execution plan', zh: '收尾 · 执行计划' },
  planRisk: { en: 'Biggest risk', zh: '最大风险' },
  planValidate: { en: 'Validate first', zh: '优先验证' },
  zoneLow: { en: 'Below most ideas', zh: '低于多数想法' },
  zoneMid: { en: 'Middle of the pack', zh: '处于中游' },
  zoneHigh: { en: 'Above most ideas', zh: '优于多数想法' },
  confLow: { en: 'low confidence', zh: '置信度：低' },
  confMed: { en: 'medium confidence', zh: '置信度：中' },
  confHigh: { en: 'high confidence', zh: '置信度：高' },
  footer: { en: 'Generated by The Round Table', zh: '由 The Round Table 生成' },
} as const;
function c(key: keyof typeof COPY, lang: Lang) { return COPY[key][lang]; }

function zoneKey(score: number): keyof typeof COPY {
  return score >= 70 ? 'zoneHigh' : score >= 40 ? 'zoneMid' : 'zoneLow';
}
function confKey(confidence: Confidence): keyof typeof COPY {
  return confidence === 'HIGH' ? 'confHigh' : confidence === 'LOW' ? 'confLow' : 'confMed';
}
function zoneColor(score: number) {
  return score >= 70 ? '#3f9e6a' : score >= 40 ? '#d98412' : '#d8503c';
}

function pdfStyles(lang: Lang) {
  const fontFamily = lang === 'zh' ? 'NotoSansSC' : 'Helvetica';
  // Fredoka has no CJK glyphs (same reason app/layout.tsx swaps to
  // ZCOOL Kuaile for :lang(zh) h1) — fall back to the CJK-capable face
  // instead of rendering tofu boxes in Chinese mode.
  const headlineFont = lang === 'zh' ? 'NotoSansSC' : 'Fredoka';
  return StyleSheet.create({
    page: { padding: 36, paddingBottom: 48, fontSize: 10.5, fontFamily, color: INK, backgroundColor: PAPER },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    brandLogoTile: {
      width: 30, height: 30, borderRadius: 8, backgroundColor: SURFACE,
      borderWidth: 1, borderColor: LINE_STRONG, alignItems: 'center', justifyContent: 'center', padding: 3,
    },
    brandLogo: { width: '100%', height: '100%', objectFit: 'contain' },
    brandName: { fontSize: 13, fontFamily: headlineFont, fontWeight: 700, color: INK },
    eyebrow: { fontSize: 8.5, letterSpacing: 1, color: INK_FAINT, marginBottom: 4 },
    ideaBox: {
      backgroundColor: PAPER, borderWidth: 1, borderColor: LINE_STRONG, borderRadius: 10,
      padding: '10 13', marginBottom: 14, fontSize: 10.5, lineHeight: 1.5, color: INK_SOFT,
    },

    card: { backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE_STRONG, borderRadius: 10, padding: 16, marginBottom: 8 },
    recTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    tag: { fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8, color: INK_FAINT, textTransform: 'uppercase' },
    curveWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    curveLabZone: { fontSize: 9, fontWeight: 700 },
    curveLabConf: { fontSize: 8, color: INK_FAINT },
    recText: { fontSize: 14.5, fontFamily: headlineFont, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 },
    recPoint: { flexDirection: 'row', fontSize: 10, lineHeight: 1.4, color: INK_SOFT, marginBottom: 4 },
    recPointNum: { fontSize: 9, fontWeight: 700, color: INK_FAINT, width: 16 },
    recRestate: { fontSize: 10, lineHeight: 1.4, color: INK, fontStyle: 'italic', paddingTop: 6, borderTopWidth: 1, borderTopColor: LINE_SOFT, marginTop: 2 },
    recHint: { fontSize: 8.5, color: INK_FAINT, marginTop: 6, textAlign: 'center' },

    sectionTitle: { fontSize: 10.5, fontWeight: 700, color: INK, marginBottom: 5, marginTop: 2 },
    agentCard: { backgroundColor: SURFACE, borderWidth: 1, borderColor: LINE_STRONG, borderLeftWidth: 3, borderRadius: 8, padding: '12 14', marginBottom: 6 },
    agentHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    agentIcon: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
    agentBadge: { fontSize: 9, fontWeight: 700, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8, marginRight: 8 },
    agentSummary: { fontSize: 9.5, color: INK_SOFT, flex: 1 },
    pointBlock: { marginTop: 3 },
    pointLabel: { fontSize: 9.5, fontWeight: 700, color: INK, marginBottom: 1 },
    pointBody: { fontSize: 9.5, lineHeight: 1.4, color: INK },

    planTitle: { fontSize: 13.5, fontFamily: headlineFont, fontWeight: 700, marginBottom: 7 },
    planStep: { flexDirection: 'row', fontSize: 10, lineHeight: 1.4, color: INK, marginBottom: 4 },
    planStepNum: { fontSize: 9, fontWeight: 700, color: INK_FAINT, width: 16 },
    planFoot: { fontSize: 9.5, lineHeight: 1.4, color: INK_SOFT, marginTop: 4 },
    planFootLabel: { fontWeight: 700, color: INK },

    footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: INK_FAINT, textAlign: 'center' },
  });
}

// Same math as components/BellCurve.tsx, redrawn with react-pdf's SVG
// primitives so the PDF gauge is pixel-for-pixel the same shape as the one
// on the live webpage, not a text-only stand-in.
function PdfBellCurve({ score, confidence, lang }: { score: number; confidence: Confidence; lang: Lang }) {
  const W = 130, H = 38, pad = 7;
  const clamped = Math.max(1, Math.min(99, score));
  const x = pad + (clamped / 100) * (W - 2 * pad);
  const bandW = confidence === 'HIGH' ? 7 : confidence === 'LOW' ? 22 : 13;
  const color = zoneColor(clamped);

  const pts: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const px = pad + (i * (W - 2 * pad)) / 30;
    const tt = (i / 30 - 0.5) * 3;
    const py = H - 6 - (H - 14) * Math.exp(-tt * tt * 2);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const path = `M${pad},${H - 6} L${pts.join(' L ')} L${W - pad},${H - 6} Z`;

  return React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
    React.createElement(Svg, { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      React.createElement(Path, { d: path, fill: blend(INK, 0.07), stroke: blend(INK, 0.28), strokeWidth: 1 }),
      React.createElement(Rect, { x: (x - bandW).toFixed(1), y: 6, width: bandW * 2, height: H - 12, fill: blend(color, 0.16), rx: 3 }),
      React.createElement(Line, { x1: x.toFixed(1), y1: 5, x2: x.toFixed(1), y2: H - 6, stroke: color, strokeWidth: 2.2 })
    ),
    React.createElement(View, { style: { marginLeft: 8 } },
      React.createElement(Text, { style: { fontSize: 9, fontWeight: 700, color } }, c(zoneKey(clamped), lang)),
      React.createElement(Text, { style: { fontSize: 8, color: INK_FAINT } }, c(confKey(confidence), lang))
    )
  );
}

interface ReportProps {
  lang: Lang;
  ideaText: string;
  recommendation: ReturnType<typeof parseAlignment>;
  advisors: { agentId: AgentId; label: string; summary: string; bullets: { label: string | null; body: string }[] }[];
  plan: PlanRow | null;
}

function ReportDoc({ lang, ideaText, recommendation, advisors, plan }: ReportProps) {
  const styles = pdfStyles(lang);
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(View, { style: styles.brandRow },
        React.createElement(View, { style: styles.brandLogoTile },
          React.createElement(Image, { src: LOGO_PATH, style: styles.brandLogo })),
        React.createElement(Text, { style: styles.brandName }, 'The Round Table')),
      React.createElement(Text, { style: styles.eyebrow }, c('eyebrow', lang)),
      React.createElement(View, { style: styles.ideaBox }, React.createElement(Text, null, ideaText)),

      // ---- Shared recommendation (mirrors .rec-card on the webpage) ----
      // wrap: false keeps the whole card together on one page rather than
      // splitting its border/background awkwardly mid-paragraph.
      React.createElement(View, { style: styles.card, wrap: false },
        React.createElement(View, { style: styles.recTop },
          React.createElement(Text, { style: styles.tag }, c('recTag', lang)),
          recommendation.score !== null && recommendation.confidence !== null
            ? PdfBellCurve({ score: recommendation.score, confidence: recommendation.confidence, lang })
            : null
        ),
        React.createElement(Text, { style: styles.recText }, recommendation.conclusion),
        ...recommendation.points.map((p, i) =>
          React.createElement(View, { style: styles.recPoint, key: i },
            React.createElement(Text, { style: styles.recPointNum }, `${i + 1}`),
            React.createElement(Text, null, p)
          )
        ),
        recommendation.restate ? React.createElement(Text, { style: styles.recRestate }, recommendation.restate) : null,
        React.createElement(Text, { style: styles.recHint }, c('recHint', lang))
      ),

      // ---- Advisor detail (mirrors each .msg / tactics card) ----
      React.createElement(Text, { style: styles.sectionTitle }, c('advisorsTitle', lang)),
      ...advisors.map((a) => {
        const palette = AGENT_COLORS[a.agentId];
        // wrap:false — a headerless fragment (just a colored border resuming
        // mid-list with no icon/badge/summary) looks broken, worse than a
        // blank gap before it. Tried letting cards split across pages to kill
        // the gap; the orphaned continuation looked worse than the problem
        // it solved. Now that tactics responses are one concise sentence per
        // point (not multi-paragraph), each card is short enough that this
        // should rarely force a whole-card page jump in the first place.
        return React.createElement(View, { style: [styles.agentCard, { borderLeftColor: palette.solid }], wrap: false, key: a.agentId },
          React.createElement(View, { style: styles.agentHead },
            React.createElement(Image, { src: AGENT_MASCOTS[a.agentId], style: styles.agentIcon }),
            React.createElement(Text, { style: [styles.agentBadge, { backgroundColor: palette.bg, color: palette.color }] }, a.label),
            React.createElement(Text, { style: styles.agentSummary }, a.summary)
          ),
          ...a.bullets.map((b, i) =>
            React.createElement(View, { style: styles.pointBlock, key: i },
              b.label ? React.createElement(Text, { style: styles.pointLabel }, b.label) : null,
              React.createElement(Text, { style: styles.pointBody }, b.body)
            )
          )
        );
      }),

      // ---- Execution plan (mirrors .plan-card) ----
      plan ? React.createElement(View, { style: styles.card, wrap: false },
        React.createElement(Text, { style: styles.tag }, c('planTag', lang)),
        React.createElement(Text, { style: [styles.planTitle, { marginTop: 5 }] }, plan.title || ''),
        ...plan.steps.map((s, i) =>
          React.createElement(View, { style: styles.planStep, key: i },
            React.createElement(Text, { style: styles.planStepNum }, `${i + 1}`),
            React.createElement(Text, null, s)
          )
        ),
        plan.risk ? React.createElement(Text, { style: styles.planFoot },
          React.createElement(Text, { style: styles.planFootLabel }, `${c('planRisk', lang)}: `), plan.risk) : null,
        plan.validate ? React.createElement(Text, { style: styles.planFoot },
          React.createElement(Text, { style: styles.planFootLabel }, `${c('planValidate', lang)}: `), plan.validate) : null
      ) : null,

      React.createElement(Text, { style: styles.footer, fixed: true }, c('footer', lang))
    )
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await getAuthedUser(supabase);
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const { sessionId } = (await request.json()) as { sessionId: string };
  const { data: session } = await supabase.from('sessions').select('lang, title, idea_text').eq('id', sessionId).single();
  if (!session) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  const lang: Lang = session.lang === 'zh' ? 'zh' : 'en';

  const { data: rounds } = await supabase
    .from('rounds').select('*').eq('session_id', sessionId)
    .eq('alignment_status', 'complete').order('round_index', { ascending: false }).limit(1);
  const latest = rounds?.[0];
  if (!latest) return new Response(JSON.stringify({ error: 'no_recommendation_yet' }), { status: 400 });

  const { data: plans } = await supabase
    .from('plans').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(1);
  const plan = (plans?.[0] as PlanRow | undefined) || null;

  // Use the same stored, structured round data the webpage renders from —
  // no LLM re-summarization pass, so the PDF can't drift from what the
  // founder actually saw on screen.
  const advisors = AGENTS
    .map((agent) => {
      const tactic = (latest.tactics as { agentId: string; status: string; text?: string }[] || [])
        .find((tt) => tt.agentId === agent.id && tt.status === 'complete');
      if (!tactic?.text) return null;
      const { summary, bulletLines } = parseAgentText(tactic.text);
      return {
        agentId: agent.id,
        label: lang === 'zh' ? agent.labelZh : agent.label,
        summary,
        bullets: renderBullets(bulletLines),
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const recommendation = parseAlignment(latest.alignment_result || '');
  const ideaText = session.title || session.idea_text || '';

  const buffer = await renderToBuffer(
    ReportDoc({ lang, ideaText, recommendation, advisors, plan }) as Parameters<typeof renderToBuffer>[0]
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="round-table-report.pdf"',
    },
  });
}
