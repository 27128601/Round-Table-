// Parses the alignment ("shared recommendation") output, pulling out the
// SCORE/CONFIDENCE pair for the bell curve gauge and returning the display
// text with those two lines stripped out. Ported from the original
// single-file build's parseSynth().

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ParsedAlignment {
  displayText: string;
  score: number | null;
  confidence: Confidence | null;
}

export function parseAlignment(text: string): ParsedAlignment {
  const raw = text || '';
  let score: number | null = null;
  let confidence: Confidence | null = null;
  const keptLines: string[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    const scoreMatch = /^SCORE:/i.test(trimmed);
    const confMatch = /^CONFIDENCE:/i.test(trimmed);
    if (scoreMatch) {
      const n = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n)) score = Math.max(1, Math.min(99, n));
      continue;
    }
    if (confMatch) {
      const c = trimmed.replace(/^CONFIDENCE:/i, '').trim().toUpperCase();
      const found = c.match(/LOW|MEDIUM|HIGH/);
      if (found) confidence = found[0] as Confidence;
      continue;
    }
    keptLines.push(line);
  }

  return { displayText: keptLines.join('\n').trim(), score, confidence };
}
