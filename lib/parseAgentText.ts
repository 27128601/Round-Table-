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
  const cleaned = stripAsterisks(text || '');
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
