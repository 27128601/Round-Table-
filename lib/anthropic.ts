import Anthropic from '@anthropic-ai/sdk';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { ZH_INSTRUCTION, NO_MD_INSTRUCTION, type Lang } from './i18n';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const SONNET_MODEL = 'claude-sonnet-5';

// Native server-side web search tool (§5). Verify this dated tool-type string
// against platform.claude.com/docs if the Anthropic SDK is upgraded later —
// versioned tool types get superseded (checked against @anthropic-ai/sdk's
// shipped type defs as of this build: web_search_20260318).
export function webSearchTool(maxUses = 5) {
  return {
    type: 'web_search_20260318' as const,
    name: 'web_search' as const,
    max_uses: maxUses,
    allowed_callers: ['direct'] as ('direct' | 'code_execution_20250825' | 'code_execution_20260120' | 'code_execution_20260521')[],
  };
}

export interface Source {
  title: string;
  url: string;
}

// Builds the cache_control-annotated system block array (§4.5). sharedPrefix
// MUST be byte-identical across every call in a fan-out stage (the 3
// initial-takes calls, or separately the 3 tactics calls) for caching to hit —
// per-call-specific content (the agent's role instruction) goes in suffix,
// appended AFTER the cache breakpoint.
export function buildCachedSystemBlocks(sharedPrefix: string, suffix: string, lang: Lang): TextBlockParam[] {
  const blocks: TextBlockParam[] = [
    { type: 'text', text: sharedPrefix, cache_control: { type: 'ephemeral' } },
  ];
  let tail = suffix + NO_MD_INSTRUCTION;
  if (lang === 'zh') tail = ZH_INSTRUCTION + '\n\n' + tail + ZH_INSTRUCTION;
  blocks.push({ type: 'text', text: tail });
  return blocks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallResult {
  text: string;
  sources: Source[];
}

function extractResult(msg: Anthropic.Messages.Message): CallResult {
  let text = '';
  const sources: Source[] = [];
  for (const block of msg.content) {
    if (block.type === 'text') {
      text += block.text;
      for (const citation of block.citations ?? []) {
        if (citation.type === 'web_search_result_location' && citation.url) {
          const url = citation.url;
          if (!sources.some((s) => s.url === url)) {
            sources.push({ title: citation.title || url, url });
          }
        }
      }
    }
  }
  return { text: text.trim(), sources };
}

interface CallOptions {
  model: string;
  system: string | TextBlockParam[];
  userContent: string;
  maxTokens: number;
  withSearch?: boolean;
}

async function rawCall(opts: CallOptions): Promise<CallResult> {
  const msg = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: 'user', content: opts.userContent }],
    tools: opts.withSearch ? [webSearchTool()] : undefined,
  });
  return extractResult(msg);
}

// Single retry with backoff (§10.3) — a failed call is retried once, not the
// whole 8-call chain.
export async function callWithRetry(opts: CallOptions): Promise<CallResult> {
  try {
    return await rawCall(opts);
  } catch {
    await sleep(800);
    try {
      return await rawCall(opts);
    } catch (err2) {
      throw err2 instanceof Error ? err2 : new Error(String(err2));
    }
  }
}

// Backstop for bilingual mode: no Chinese-mode output may contain Korean or
// Japanese script (carried over from the original single-file build).
const NON_ZH_SCRIPT_RE = /[가-힯ᄀ-ᇿ㄰-㆏぀-ゟ゠-ヿ]/;
export function hasNonChineseScript(text: string) {
  return NON_ZH_SCRIPT_RE.test(text || '');
}

// Detects actual Han characters. hasNonChineseScript() alone only catches
// Korean/Japanese leakage — it does nothing if the model just answers in
// plain English, which passes that check with flying colors. Any zh-mode
// output must be checked against BOTH: no Korean/Japanese AND has real
// Chinese content.
const HAN_RE = /[一-鿿]/;
export function hasChineseScript(text: string) {
  return HAN_RE.test(text || '');
}

// The single check every zh-mode call site should use before deciding
// whether to run the translation backstop.
export function needsZhBackstop(text: string) {
  return hasNonChineseScript(text) || !hasChineseScript(text);
}

const TRANSLATE_SYSTEM = `You are a translator. Translate the user's text into natural Simplified Chinese (简体中文). CRITICAL RULES: (1) Preserve EXACTLY, unchanged and in English, any structural label at the start of a line (e.g. SUMMARY:, RECOMMENDATION:, TACTIC:, TITLE:, STEP:, RISK:, VALIDATE:, Q:, SUFFICIENT). (2) Preserve all numbers, the "•" bullet character, and line breaks exactly. (3) Leave any SCORE: or CONFIDENCE: line completely untouched, label and value both, exactly as given (CONFIDENCE: stays LOW/MEDIUM/HIGH in English). (4) Translate everything else into Simplified Chinese. (5) Output ONLY the translated text, nothing else, no preamble.`;

export async function translateBackstop(text: string): Promise<string> {
  try {
    const { text: translated } = await callWithRetry({
      model: HAIKU_MODEL,
      system: TRANSLATE_SYSTEM,
      userContent: text,
      maxTokens: 700,
    });
    return translated || text;
  } catch {
    return text;
  }
}

// Backstop for the "SUMMARY: ... POINT N — Label: paragraph" structure every
// agent response is supposed to follow. Some roles (Storyteller especially —
// a narrative-voiced persona is more prone to slipping into flowing prose)
// occasionally drop the literal labels despite the instruction, which the UI
// then renders as an unlabeled paragraph dump. Detect that and run one
// cheap relabeling pass rather than shipping malformed output to the page.
const POINT_LINE_RE = /^POINT\s*\d+\s*[—–-]\s*.+[:：]/im;
export function needsFormatBackstop(text: string) {
  const body = text || '';
  return !/^SUMMARY:/im.test(body) || !POINT_LINE_RE.test(body);
}

// The alignment call was deliberately left WITHOUT the POINT-format backstop
// (its CONCLUSION/POINT/RESTATE structure is different from the per-agent
// SUMMARY/POINT one), which meant a response missing just SCORE:/CONFIDENCE:
// had no safety net at all — seen in production as a shared-recommendation
// card with a complete, well-formed conclusion/points/restate but no bell
// curve, because the model simply skipped those two lines this round despite
// the prompt requiring them. Rather than re-running the whole (Sonnet, not
// cheap) alignment call on a hunch, patch just the missing rating with one
// small Haiku call that reads the already-good text and appends it.
const SCORE_CONFIDENCE_SYSTEM = `You read a startup advisory panel's shared recommendation (its CONCLUSION/POINT/RESTATE lines) which is missing its SCORE and CONFIDENCE rating. Output EXACTLY these two lines and nothing else:
SCORE: [an integer 1-99 rating for where this idea sits versus typical early-stage startup ideas — below 40 means weak/unproven, 40-69 means plausible but unvalidated, 70+ means strong signal]
CONFIDENCE: [exactly one of LOW, MEDIUM, HIGH — how sure you are in that SCORE given the evidence in the text]`;

export function needsScoreConfidence(text: string) {
  const body = text || '';
  return !/^SCORE:/im.test(body) || !/^CONFIDENCE:/im.test(body);
}

export async function scoreConfidenceBackstop(alignmentText: string): Promise<string> {
  try {
    const { text } = await callWithRetry({
      model: HAIKU_MODEL,
      system: SCORE_CONFIDENCE_SYSTEM,
      userContent: alignmentText,
      maxTokens: 30,
    });
    // Only trust it if it actually produced both lines — otherwise leave the
    // curve absent rather than risk appending a garbled rating.
    if (/^SCORE:/im.test(text) && /^CONFIDENCE:/im.test(text)) {
      return `${alignmentText}\n${text.trim()}`;
    }
    return alignmentText;
  } catch {
    return alignmentText;
  }
}

const FORMAT_BACKSTOP_SYSTEM = `You clean up a startup-advisor response that failed to follow its required output structure. Rewrite it into EXACTLY this structure, condensing the original's claims and reasoning down to one concise, complete sentence per line (do not invent new claims, do not add commentary, do not pad — compress, don't summarize away the substance):
SUMMARY: [one punchy sentence capturing the core take, taken or distilled from the original text]
POINT 1 — [short label]: [ONE concise, complete sentence distilled from the original text, under 25 words]
POINT 2 — [short label]: [ONE concise, complete sentence distilled from the original text, under 25 words]
POINT 3 — [short label]: [ONE concise, complete sentence distilled from the original text, under 25 words] (include this line only if the original text has a genuine third distinct point; otherwise stop at POINT 2)
Keep the original's language (English or Chinese) and tone exactly. No asterisks, no markdown, no preamble or sign-off, nothing except the structured lines above.`;

export async function formatBackstop(text: string): Promise<string> {
  try {
    const { text: fixed } = await callWithRetry({
      model: HAIKU_MODEL,
      system: FORMAT_BACKSTOP_SYSTEM,
      userContent: text,
      maxTokens: 500,
    });
    return needsFormatBackstop(fixed) ? text : fixed;
  } catch {
    return text;
  }
}

// Same class of backstop as above, for the wrap-up plan's TITLE:/STEP:/RISK:/
// VALIDATE: structure. Without this, a non-compliant response silently
// produced an empty plan card (title stuck on the hardcoded "Execution plan"
// default, zero steps, no risk, no validate line) with no recovery — seen in
// production on the wrap-up step.
const STEP_LINE_RE = /^STEP:/im;
export function needsPlanFormatBackstop(text: string) {
  const body = text || '';
  return !/^TITLE:/im.test(body) || !STEP_LINE_RE.test(body);
}

const PLAN_FORMAT_BACKSTOP_SYSTEM = `You clean up a startup execution-plan response that failed to follow its required output structure. Rewrite it into EXACTLY this structure, condensing the original's content down to concise, complete sentences per line (do not invent new steps, do not add commentary, do not pad — compress, don't lose the substance):
TITLE: [one short line naming the plan, under 10 words, distilled from the original text]
STEP: [ONE concise, complete sentence, under 25 words, distilled from the original text]
STEP: [next step, same length rule]
STEP: [3-6 STEP lines total, ordered — include as many as the original text genuinely supports]
RISK: [ONE concise sentence, under 25 words, the single biggest risk from the original text]
VALIDATE: [ONE concise sentence, under 25 words, the one thing to validate first, from the original text]
Keep the original's language (English or Chinese) exactly. No asterisks, no markdown, no preamble or sign-off, nothing except the structured lines above.`;

export async function planFormatBackstop(text: string): Promise<string> {
  try {
    const { text: fixed } = await callWithRetry({
      model: HAIKU_MODEL,
      system: PLAN_FORMAT_BACKSTOP_SYSTEM,
      userContent: text,
      maxTokens: 500,
    });
    return needsPlanFormatBackstop(fixed) ? text : fixed;
  } catch {
    return text;
  }
}

// Rare failure mode distinct from "dropped the format labels": the model
// breaks character entirely and asks a meta question about which persona to
// answer as (seen in production from the Market role: "I need to clarify
// which role you'd like me to respond from..."). Re-running the *original*
// call once is the right fix here, not the format backstop — there is no
// real substance to relabel, the response itself is void. Only re-roll once;
// if it still misfires, fall through and let the normal pipeline (including
// the format backstop) do what it can with whatever came back.
const CONFUSED_RESPONSE_RE = /which role (?:you'?d|would you) like|need to clarify which role|I'?m (?:not sure|unsure) (?:which|what) role|as an AI\b.*(?:role|persona)/i;
export function isConfusedResponse(text: string) {
  return CONFUSED_RESPONSE_RE.test(text || '');
}

// Drop-in replacement for callWithRetry at the per-agent call sites: adds one
// extra re-roll specifically when the model breaks character, on top of the
// network-failure retry callWithRetry already does.
export async function generateAgentText(opts: CallOptions): Promise<CallResult> {
  const first = await callWithRetry(opts);
  if (!isConfusedResponse(first.text)) return first;
  try {
    const retry = await callWithRetry(opts);
    return isConfusedResponse(retry.text) ? first : retry;
  } catch {
    return first;
  }
}
