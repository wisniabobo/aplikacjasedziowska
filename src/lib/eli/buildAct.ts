import type { ActDef } from '../../data/acts';
import { bestTextFile, eliYearPos, fetchActMeta, fetchRecentAmendments, latestConsolidatedText, type EliActMeta } from './api';
import { parseActLines } from './actParser';
import { extractPdfLines, type PdfDocLike } from './pdfLines';
import type { ActDoc, ActMeta } from './types';

export type PdfOpener = (data: Uint8Array) => Promise<PdfDocLike & { destroy?: () => Promise<void> }>;
type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Nadchodzące zmiany: akty zmieniające z datą wejścia w życie późniejszą niż dziś. */
export async function pendingChanges(meta: EliActMeta, today: string, f?: FetchFn): Promise<ActMeta['pendingChanges']> {
  const tj = latestConsolidatedText(meta);
  const sinceYear = tj ? eliYearPos(tj).year : new Date(today).getFullYear() - 1;
  const recent = await fetchRecentAmendments(meta, { sinceYear, limit: 10 }, f);
  const out = recent
    .filter((a) => (a.entryIntoForce ?? '') > today)
    .map((a) => ({ eli: a.ELI, title: a.title, entryIntoForce: a.entryIntoForce }));
  return out.length ? out : undefined;
}

/**
 * Pobiera najnowszy tekst ujednolicony aktu z API Sejmu i zamienia go na strukturę ActDoc.
 * Używane zarówno przez skrypt aktualizacji danych, jak i przez przycisk „Aktualizuj z Sejmu”.
 */
export async function buildActFromEli(
  def: ActDef,
  openPdf: PdfOpener,
  opts: { fetch?: FetchFn; today?: string; withPending?: boolean } = {},
): Promise<ActDoc> {
  if (def.source.kind !== 'eli') throw new Error(`${def.slug}: źródło nie jest aktem ELI`);
  const f: FetchFn = opts.fetch ?? ((i, init) => fetch(i, init));
  const meta = await fetchActMeta(def.source.eli, f);
  const file = bestTextFile(meta);
  if (!file) throw new Error(`${def.slug}: brak tekstu w API Sejmu`);
  const res = await f(file.url);
  if (!res.ok) throw new Error(`${def.slug}: błąd pobierania tekstu (${res.status})`);
  const data = new Uint8Array(await res.arrayBuffer());
  const doc = await openPdf(data);
  try {
    const lines = await extractPdfLines(doc);
    const parsed = parseActLines(lines, { dehyphenate: file.type !== 'U' });
    const today = opts.today ?? new Date().toISOString().slice(0, 10);
    const actMeta: ActMeta = {
      slug: def.slug,
      eli: def.source.eli,
      title: def.title,
      short: def.short,
      abbr: def.abbr,
      changeDate: meta.changeDate ?? '',
      textDate: parsed.textDate,
      textType: file.type,
      basedOn: parsed.basedOn,
      sourceUrl: file.url,
      fetchedAt: new Date().toISOString(),
      status: meta.status,
      latestTj: latestConsolidatedText(meta),
    };
    if (opts.withPending) {
      const pending = await pendingChanges(meta, today, f);
      if (pending) actMeta.pendingChanges = pending;
    }
    if (parsed.articles.length < 5) throw new Error(`${def.slug}: podejrzanie mało artykułów (${parsed.articles.length})`);
    return { meta: actMeta, toc: parsed.toc, articles: parsed.articles };
  } finally {
    await doc.destroy?.();
  }
}
