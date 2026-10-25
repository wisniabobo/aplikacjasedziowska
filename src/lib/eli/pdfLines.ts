/**
 * Wyciąganie linii tekstu z PDF-ów Kancelarii Sejmu (tekst ujednolicony „U”).
 * Działa na minimalnym interfejsie pdf.js, dzięki czemu ten sam kod działa
 * w przeglądarce i w skryptach Node.
 */

export interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface PdfPageLike {
  getViewport(params: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}

export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}

export type LineZone = 'body' | 'margin' | 'footnote' | 'header';

export interface PdfLine {
  page: number;
  /** Odległość linii bazowej od góry strony. */
  y: number;
  x: number;
  x2: number;
  size: number;
  text: string;
  zone: LineZone;
  /** Linia zaczyna się oznaczeniem (np. „1)”) oddzielonym tabulatorem od tekstu (wcięcie wiszące). */
  tab?: boolean;
}

interface Item {
  s: string;
  x: number;
  x2: number;
  base: number;
  size: number;
}

const MARKER_ONLY = /^(?:\d+[a-z]{0,3}\)|[a-z]{1,3}\)|[–—-]|§\s*\d+[a-z]*\.|\d+[a-z]{0,3}\.)$/;

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

export function toSuperscript(s: string): string {
  return s.replace(/[0-9]/g, (d) => SUP[d] ?? d);
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  let best = 0;
  let bestCount = -1;
  for (const v of values) {
    const k = Math.round(v * 2) / 2;
    const c = (counts.get(k) ?? 0) + 1;
    counts.set(k, c);
    if (c > bestCount) {
      bestCount = c;
      best = k;
    }
  }
  return best;
}

/** Skleja elementy jednej linii, wstawiając spacje tam, gdzie jest przerwa. */
function joinItems(items: Item[], bodySize: number): string {
  items.sort((a, b) => a.x - b.x);
  let out = '';
  let prevEnd = -Infinity;
  let prevSup = false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const isSup = it.size < bodySize * 0.8 && it.s.trim() !== '';
    let s = it.s;
    if (isSup) {
      // Odnośnik do przypisu („1)”) – pomijamy; cyfry indeksu górnego zamieniamy na znaki Unicode.
      const next = items[i + 1];
      const nextIsSupParen = next !== undefined && next.size < bodySize * 0.8 && next.s.trim().startsWith(')');
      if (/^\d+\)$/.test(s.trim()) || (/^\d+$/.test(s.trim()) && nextIsSupParen)) {
        if (nextIsSupParen && !s.includes(')')) i++;
        prevEnd = it.x2;
        continue;
      }
      if (s.trim() === ')' && prevSup) {
        prevEnd = it.x2;
        continue;
      }
      // Kancelaria Sejmu zapisuje indeksy górne jako „[1]” małą czcionką.
      s = toSuperscript(s.trim().replace(/^\[([0-9a-z]+)\]$/, '$1'));
    }
    const gap = it.x - prevEnd;
    // Osobne elementy tekstu z widoczną przerwą (≥ ok. 1 pt) to granica słów; elementy w obrębie słowa stykają się.
    if (out !== '' && !out.endsWith(' ') && !s.startsWith(' ') && gap > bodySize * 0.075 && !isSup && !s.startsWith('-') && !out.endsWith('-')) {
      out += ' ';
    }
    out += s;
    prevEnd = it.x2;
    prevSup = isSup;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Zwraca linie dokumentu z podziałem na strefy: treść, margines (adnotacje),
 * przypisy i nagłówki/stopki.
 */
export interface ExtractOptions {
  /** Dla składu dwuszpaltowego: granica szpalt (w punktach). Linie są wtedy zwracane szpaltami. */
  splitX?: number;
}

export async function extractPdfLines(doc: PdfDocLike, opts: ExtractOptions = {}): Promise<PdfLine[]> {
  const all: PdfLine[] = [];
  // Najpierw zbieramy elementy, żeby ustalić rozmiar czcionki treści.
  const pages: { items: Item[]; width: number; height: number }[] = [];
  const sizes: number[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const raw of tc.items) {
      const it = raw as PdfTextItem;
      if (typeof it.str !== 'string' || !it.transform || it.str === '') continue;
      const [a = 0, b = 0, , , e = 0, f = 0] = it.transform;
      const size = Math.hypot(a, b) || it.height || 0;
      if (size <= 0) continue;
      const width = it.width ?? 0;
      items.push({ s: it.str, x: e, x2: e + width, base: vp.height - f, size });
      if (it.str.trim().length > 3) sizes.push(size);
    }
    pages.push({ items, width: vp.width, height: vp.height });
  }
  const bodySize = mode(sizes) || 12;

  for (let pi = 0; pi < pages.length; pi++) {
    const { items, width, height } = pages[pi]!;
    // Grupowanie po linii bazowej: najpierw elementy „normalnej” wielkości.
    const normal = items.filter((i) => i.size >= bodySize * 0.8);
    const small = items.filter((i) => i.size < bodySize * 0.8 && i.s.trim() !== '');
    normal.sort((a, b) => a.base - b.base || a.x - b.x);
    const marginX = opts.splitX ?? width * 0.79;
    const groups: { base: number; size: number; items: Item[]; margin: boolean }[] = [];
    for (const it of normal) {
      const margin = it.x >= marginX;
      const g = groups.find(
        (gr) => gr.margin === margin && Math.abs(gr.base - it.base) <= 1.6 && Math.abs(gr.size - it.size) < 2.5,
      );
      if (g) g.items.push(it);
      else groups.push({ base: it.base, size: it.size, items: [it], margin });
    }
    // Indeksy górne doklejamy do linii, nad którą „wiszą”.
    for (const it of small) {
      let target: (typeof groups)[number] | undefined;
      let best = Infinity;
      for (const g of groups) {
        if (g.margin !== it.x >= marginX) continue;
        if (!g.items.some((i) => i.s.trim() !== '' && i.size >= bodySize * 0.8)) continue;
        const raise = g.base - it.base;
        if (raise >= -1 && raise <= g.size * 0.75) {
          const gx1 = Math.min(...g.items.map((i) => i.x));
          const gx2 = Math.max(...g.items.map((i) => i.x2));
          if (it.x >= gx1 - 30 && it.x <= gx2 + 30 && raise < best) {
            best = raise;
            target = g;
          }
        }
      }
      if (target) target.items.push(it);
      else groups.push({ base: it.base, size: it.size, items: [it], margin: it.x >= marginX });
    }
    groups.sort((a, b) => (opts.splitX !== undefined ? Number(a.margin) - Number(b.margin) : 0) || a.base - b.base);

    const pageLines: PdfLine[] = [];
    for (const g of groups) {
      const visible = g.items.filter((i) => i.s.trim() !== '');
      if (visible.length === 0) continue;
      const text = joinItems([...g.items], bodySize);
      if (!text) continue;
      const x = Math.min(...visible.map((i) => i.x));
      const x2 = Math.max(...visible.map((i) => i.x2));
      let zone: LineZone = 'body';
      // Nagłówek Kancelarii Sejmu leży ok. 54 pt od góry; pierwsza linia treści zaczyna się ok. 67–69 pt.
      if (opts.splitX === undefined && (g.base < 61 || g.base > height - 36)) zone = 'header';
      if (/^©\s?Kancelaria Sejmu/.test(text) || /^s\. \d+\/\d+$/.test(text) || /^\d{4}-\d{2}-\d{2}$/.test(text)) {
        zone = 'header';
      }
      if (zone === 'body' && g.margin && opts.splitX === undefined) zone = 'margin';
      const sorted = visible.slice().sort((a, b) => a.x - b.x);
      const first = sorted[0]!;
      const second = sorted[1];
      const tab =
        second !== undefined &&
        MARKER_ONLY.test(first.s.trim()) &&
        second.x - first.x2 >= bodySize * 0.6;
      pageLines.push({ page: pi + 1, y: g.base, x, x2, size: g.size, text, zone, ...(tab ? { tab } : {}) });
    }
    // Strefa przypisów: mniejsze linie poniżej ostatniej linii treści o zwykłym rozmiarze.
    const normalBody = pageLines.filter((l) => l.zone === 'body' && l.size >= bodySize - 0.5);
    const lastNormalY = normalBody.length ? Math.max(...normalBody.map((l) => l.y)) : -Infinity;
    for (const l of pageLines) {
      if (l.zone === 'body' && l.size < bodySize - 1 && l.y > lastNormalY && l.y > height * 0.3) l.zone = 'footnote';
    }
    all.push(...pageLines);
  }
  return all;
}

/** Typowy rozmiar czcionki treści w zestawie linii. */
export function bodyFontSize(lines: PdfLine[]): number {
  return mode(lines.filter((l) => l.zone === 'body' && l.text.length > 20).map((l) => l.size)) || 12;
}

export { mode as numericMode };
