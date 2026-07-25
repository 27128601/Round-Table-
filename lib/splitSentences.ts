// Splits a bullet/summary body into sentences for click-to-highlight.
// Keeps trailing punctuation and whitespace attached to each sentence so
// re-joining the pieces reproduces the original text exactly.
const TERMINATORS = '.!?。！？';

export function splitSentences(text: string): string[] {
  if (!text) return [];
  const re = new RegExp(`[^${TERMINATORS}]+[${TERMINATORS}]+(\\s+|$)|[^${TERMINATORS}]+$`, 'g');
  const matches = text.match(re);
  return matches ? matches.filter((s) => s.trim().length > 0) : [text];
}
