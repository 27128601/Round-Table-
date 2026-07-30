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

// A label separator colon must fall within roughly the first N characters
// after "POINT N — " to actually be the label/body divider — otherwise a
// plain sentence like "...that evidence does two things: it proves..."
// buried deep in the paragraph gets mistaken for one, turning the entire
// paragraph into a bold "label" with the tail sheared off as its own
// unlabeled bullet. (Bug seen in production: exactly this.)
const MAX_LABEL_LEN = 60;

export function renderBullets(bulletLines: string[]): RenderedBullet[] {
  // Rejoin first: the model sometimes wraps a single point's paragraph
  // across more than one physical line, and bulletLines is split strictly
  // on '\n' — splitting per-line would fragment that one point into a
  // mislabeled head + a stray unlabeled bullet. Segmenting the full text by
  // "POINT N —" markers keeps each point's paragraph intact regardless of
  // internal line breaks.
  const text = bulletLines.join('\n');
  const pointRe = /POINT\s*\d+\s*[—-]\s*/gi;
  const matches = [...text.matchAll(pointRe)];

  if (matches.length > 0) {
    return matches.map((m, i) => {
      const start = m.index! + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const rest = text.slice(start, end).replace(/\s+/g, ' ').trim();
      const ca = rest.indexOf(':');
      const cb = rest.indexOf('：');
      const ci = ca === -1 ? cb : cb === -1 ? ca : Math.min(ca, cb);
      if (ci > -1 && ci < MAX_LABEL_LEN) {
        return { label: rest.slice(0, ci).trim(), body: rest.slice(ci + 1).trim() };
      }
      return { label: null, body: rest };
    });
  }

  // No "POINT N —" markers anywhere — fall back to the older "• Label: body"
  // format (already-generated content) or fully unlabeled prose, one bullet
  // block per line, same as before.
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
