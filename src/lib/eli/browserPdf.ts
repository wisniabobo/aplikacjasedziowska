import type { PdfDocLike } from './pdfLines';

/** pdf.js ładowany dopiero wtedy, gdy użytkownik aktualizuje ustawę z API Sejmu. */
export async function openPdfInBrowser(data: Uint8Array): Promise<PdfDocLike & { destroy: () => Promise<void> }> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data }).promise;
  return doc as unknown as PdfDocLike & { destroy: () => Promise<void> };
}
