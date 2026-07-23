// Client-side file-to-markdown conversion (§6). All conversion happens in the
// browser before anything is sent to the backend. Ported from the original
// single-file build's handleFile/readAsArrayBuffer logic, with the size limit
// raised from 8MB to 10MB per §6 and an explicit "no extractable text" state
// added for scanned/image-only PDFs.

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, §6

export type FileConvertError = 'too_large' | 'legacy_doc' | 'lib_failed' | 'parse_failed' | 'empty_text';

export interface FileConvertResult {
  ok: true;
  name: string;
  markdown: string;
}
export interface FileConvertFailure {
  ok: false;
  error: FileConvertError;
}

function readAsArrayBuffer(f: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = reject;
    r.readAsArrayBuffer(f);
  });
}

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

export async function convertFile(file: File): Promise<FileConvertResult | FileConvertFailure> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'too_large' };

  const name = file.name.toLowerCase();
  let text = '';

  try {
    if (name.endsWith('.pdf')) {
      let pdfjsLib;
      try {
        pdfjsLib = await loadPdfjs();
      } catch {
        return { ok: false, error: 'lib_failed' };
      }
      const buf = await readAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const maxPages = Math.min(pdf.numPages, 30);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n\n';
        if (text.length > 20000) break;
      }
    } else if (name.endsWith('.docx')) {
      let mammoth;
      try {
        mammoth = await import('mammoth');
      } catch {
        return { ok: false, error: 'lib_failed' };
      }
      const buf = await readAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      text = result.value;
    } else if (name.endsWith('.doc')) {
      return { ok: false, error: 'legacy_doc' };
    } else {
      text = await file.text();
    }
  } catch {
    return { ok: false, error: 'parse_failed' };
  }

  const cleaned = text.replace(/\s+\n/g, '\n').trim();
  if (!cleaned) return { ok: false, error: 'empty_text' };

  return { ok: true, name: file.name, markdown: cleaned.slice(0, 20000) };
}
