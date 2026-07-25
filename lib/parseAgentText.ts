// Parses the agent output format ("SUMMARY: ...\n• Label: body...") into a
// summary line + bullet list, ported from the original single-file build.

function stripAsterisks(t: string) {
  return t
    .replace(/\*+/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-–—]{2,}\s*$/gm, '');
}

export interface ParsedAgentText {
  summary: string;
  bulletLines: string[];
}

export function parseAgentText(text: string): ParsedAgentText {
  let cleaned = stripAsterisks(text || '');

  // Defense-in-depth: if the model narrated ("I'll search for...") before
  // "SUMMARY:" on the SAME line instead of starting fresh with it, cut
  // everything before "SUMMARY:" so the preamble never reaches the UI.
  const midLineMatch = cleaned.match(/SUMMARY:/i);
  if (midLineMatch && midLineMatch.index !== undefined && midLineMatch.index > 0) {
    const before = cleaned.slice(0, midLineMatch.index);
    // Only cut if this doesn't already look like a clean line start (i.e. the
    // stuff before it isn't just whitespace/newlines — a real preamble).
    if (before.trim().length > 0 && !/\n\s*$/.test(before)) {
      cleaned = cleaned.slice(midLineMatch.index);
    }
  }

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  let summary = '';
  const bodyLines: string[] = [];
  for (const line of lines) {
    if (/^SUMMARY:/i.test(line)) {
      if (!summary) summary = line.replace(/^SUMMARY:/i, '').trim();
    } else {
      bodyLines.push(line);
    }
  }
  if (!summary && bodyLines.length) summary = bodyLines.shift()!.replace(/^[•-]\s*/, '');
  return { summary, bulletLines: bodyLines };
}

export interface RenderedBullet {
  label: string | null;
  body: string;
}

export function renderBullets(bulletLines: string[]): RenderedBullet[] {
  return bulletLines.map((line) => {
    if (line.startsWith('•') || line.startsWith('-')) {
      const content = line.slice(1).trim();
      const ca = content.indexOf(':');
      const cb = content.indexOf('：');
      const ci = ca === -1 ? cb : cb === -1 ? ca : Math.min(ca, cb);
      if (ci > -1 && ci < 32) {
        return { label: content.slice(0, ci).trim(), body: content.slice(ci + 1).trim() };
      }
      return { label: null, body: content };
    }
    return { label: null, body: line };
  });
}
