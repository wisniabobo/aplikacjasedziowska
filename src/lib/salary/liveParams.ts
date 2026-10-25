/**
 * Samoaktualizacja parametrów kalkulatora przez API Sejmu:
 *  – podstawa wynagrodzenia sędziów na rok N = przeciętne wynagrodzenie w II kw. roku N−1
 *    z komunikatu Prezesa GUS ogłaszanego w Monitorze Polskim (art. 91 § 1c u.s.p.),
 *  – sygnał, czy uchwalono ustawę okołobudżetową na rok N (może zmienić podstawę).
 */
import { searchActs, bestTextFile, fetchActMeta } from '../eli/api';
import { extractPdfLines, type PdfDocLike } from '../eli/pdfLines';

export interface LiveBase {
  year: number;
  value: number;
  source: string;
  eli: string;
}

export function parseAverageWage(text: string): number | null {
  const m = /wynios[łl]o\s+([\d\s  ]+,\d{2})\s*zł/i.exec(text.replace(/\n/g, ' '));
  if (!m) return null;
  const v = Number(m[1]!.replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 1000 ? v : null;
}

export async function fetchJudgeBase(year: number, openPdf: (data: Uint8Array) => Promise<PdfDocLike & { destroy?: () => Promise<void> }>): Promise<LiveBase | null> {
  const q = year - 1;
  const res = await searchActs({ publisher: 'MP', title: `przeciętnego wynagrodzenia w drugim kwartale ${q}`, limit: 10 });
  const hit = res.items.find((a) => /^Komunikat Prezesa Głównego Urzędu Statystycznego/.test(a.title) && a.title.includes(`drugim kwartale ${q}`));
  if (!hit) return null;
  const meta = await fetchActMeta(hit.ELI);
  const file = bestTextFile(meta);
  if (!file) return null;
  const pdf = await fetch(file.url);
  if (!pdf.ok) return null;
  const doc = await openPdf(new Uint8Array(await pdf.arrayBuffer()));
  try {
    const lines = await extractPdfLines(doc);
    const value = parseAverageWage(lines.map((l) => l.text).join(' '));
    if (!value) return null;
    return { year, value, source: `${hit.title} (${hit.ELI.replace('MP/', 'M.P. ').replace(/\/(\d+)$/, ' poz. $1')})`, eli: hit.ELI };
  } finally {
    await doc.destroy?.();
  }
}

/** Czy w ELI jest już ustawa okołobudżetowa na dany rok? */
export async function findBudgetRelatedAct(year: number): Promise<{ eli: string; title: string } | null> {
  const res = await searchActs({ publisher: 'DU', title: `szczególnych rozwiązaniach służących realizacji ustawy budżetowej na rok ${year}`, limit: 5 });
  const hit = res.items.find((a) => a.title.includes(`na rok ${year}`) && a.title.startsWith('Ustawa'));
  return hit ? { eli: hit.ELI, title: hit.title } : null;
}
