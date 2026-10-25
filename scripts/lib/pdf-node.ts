import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfDocLike } from '../../src/lib/eli/pdfLines';

/** Otwiera PDF w Node za pomocą pdf.js (bez renderowania czcionek). */
export async function openPdf(data: Uint8Array): Promise<PdfDocLike & { destroy(): Promise<void> }> {
  const task = getDocument({ data, useSystemFonts: false, disableFontFace: true, isEvalSupported: false, verbosity: 0 });
  const doc = await task.promise;
  return doc as unknown as PdfDocLike & { destroy(): Promise<void> };
}
