import Anthropic from '@anthropic-ai/sdk';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { ZH_INSTRUCTION, NO_MD_INSTRUCTION, type Lang } from './i18n';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const HAIKU_MODEL = 'claude-haiku-4-5';
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
