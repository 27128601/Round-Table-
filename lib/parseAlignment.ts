// Parses the alignment ("shared recommendation") output. Restored to match
// the original single-file build's richer parseSynth() structure —
// CONCLUSION / POINT (x3) / RESTATE / SCORE / CONFIDENCE — instead of the
// flattened RECOMMENDATION/WHY format, so the card can render the same
// tag+curve / bold conclusion / numbered points / restate-line hierarchy
// the prototype had. Also tolerates the old RECOMMENDATION/WHY labels so
// rounds already saved in that format still render something sensible.
//
// Parsing is line-by-line but state-machine based (not "one field = one
// line"): once a label like POINT: is seen, every following line that isn't
// itself a new label is treated as a continuation of that same field. This
// fixes real cut-off points where the model (or a mid-stream render) wraps a
// point across two physical lines — the old version silently dropped
// anything after the first newline, so a card could show "...exists for f"
// and nothing else.

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ParsedAlignment {
  displayText: string;
  conclusion: string;
  points: string[];
  restate: string;
  score: number | null;
  confidence: Confidence | null;
}

type Field = 'conclusion' | 'point' | 'restate' | null;

export function parseAlignment(text: string): ParsedAlignment {
  const raw = text || '';
  let score: number | null = null;
  let confidence: Confidence | null = null;
  let conclusion = '';
  const points: string[] = [];
  let restate = '';
  const keptLines: string[] = [];

  let current: Field = null;
  let buf = '';

  const flush = () => {
    const val = buf.trim();
    if (val) {
      if (current === 'conclusion') { conclusion = val; keptLines.push(val); }
      else if (current === 'point') { points.push(val); keptLines.push(`• ${val}`); }
      else if (current === 'restate') { restate = val; keptLines.push(val); }
    }
    buf = '';
  };

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();

    if (/^SCORE:/i.test(trimmed)) {
      flush(); current = null;
      const n = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(n)) score = Math.max(1, Math.min(99, n));
      continue;
    }
    if (/^CONFIDENCE:/i.test(trimmed)) {
      flush(); current = null;
      const c = trimmed.replace(/^CONFIDENCE:/i, '').trim().toUpperCase();
      const found = c.match(/LOW|MEDIUM|HIGH/);
      if (found) confidence = found[0] as Confidence;
      continue;
    }
    if (/^CONCLUSION:/i.test(trimmed) || /^RECOMMENDATION:/i.test(trimmed)) {
      flush();
      current = 'conclusion';
      buf = trimmed.replace(/^CONCLUSION:/i, '').replace(/^RECOMMENDATION:/i, '').trim();
      continue;
    }
    if (/^POINT:/i.test(trimmed) || /^WHY:/i.test(trimmed)) {
      flush();
      current = 'point';
      buf = trimmed.replace(/^POINT:/i, '').replace(/^WHY:/i, '').trim();
      continue;
    }
    if (/^RESTATE:/i.test(trimmed)) {
      flush();
      current = 'restate';
      buf = trimmed.replace(/^RESTATE:/i, '').trim();
      continue;
    }

    // Continuation of whatever field is currently open — handles the model
    // (or a mid-stream chunk boundary) wrapping a point/conclusion across
    // multiple physical lines instead of one.
    if (trimmed && current) {
      buf += (buf ? ' ' : '') + trimmed;
      continue;
    }
    if (trimmed) keptLines.push(line);
  }
  flush();

  if (!conclusion && keptLines.length) conclusion = keptLines[0];

  return {
    displayText: keptLines.join('\n').trim(),
    conclusion,
    points,
    restate,
    score,
    confidence,
  };
}
