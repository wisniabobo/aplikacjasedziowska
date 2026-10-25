import { describe, expect, it } from 'vitest';
import { articleId, parseActLines } from '../actParser';
import type { PdfLine } from '../pdfLines';

const L = (y: number, x: number, text: string, extra: Partial<PdfLine> = {}): PdfLine => ({ page: 1, y, x, x2: x + text.length * 5.5, size: 12, text, zone: 'body', ...extra });

describe('parser tekstu ujednoliconego', () => {
  it('identyfikatory artykułów z indeksem górnym', () => {
    expect(articleId('417¹')).toBe('a417_1');
    expect(articleId('4–6')).toBe('a4-6');
    expect(articleId('10a')).toBe('a10a');
  });
  it('rozpoznaje rozdziały, artykuły, paragrafy i punkty', () => {
    const lines: PdfLine[] = [
      L(100, 235, 'Rozdział 1', { x2: 290 }),
      L(120, 220, 'Przepisy ogólne', { x2: 305 }),
      L(140, 82, 'Art. 1. § 1. Pierwszy paragraf tekstu ustawy, który jest dość długi i', { x2: 467 }),
      L(160, 56, 'zawija się do następnej linii, a następnie kończy się w tym miejscu tekstu.', { x2: 467 }),
      L(180, 82, '§ 2. Drugi paragraf zawiera wyliczenie, które poprzedza dwa punkty:', { x2: 467 }),
      L(200, 56, '1) pierwszy punkt;', { tab: true, x2: 160 }),
      L(220, 56, '2) drugi punkt.', { tab: true, x2: 150 }),
      L(240, 82, 'Art. 2. (uchylony)', { x2: 170 }),
      L(260, 82, 'Art. 2¹. Artykuł dodany nowelizacją, który ma długą treść zawijającą się', { x2: 467 }),
      L(280, 56, 'na kolejną linię tekstu i kończy się dopiero w tym miejscu tej jednostki.', { x2: 467 }),
    ];
    const r = parseActLines(lines);
    expect(r.toc[0]!.label).toBe('Rozdział 1');
    expect(r.toc[0]!.title).toBe('Przepisy ogólne');
    expect(r.articles.map((a) => a.num)).toEqual(['1', '2', '2¹']);
    const a1 = r.articles[0]!;
    expect(a1.lines[0]).toEqual({ lvl: 0, mark: '§ 1.', text: 'Pierwszy paragraf tekstu ustawy, który jest dość długi i zawija się do następnej linii, a następnie kończy się w tym miejscu tekstu.' });
    expect(a1.lines[2]).toEqual({ lvl: 1, mark: '1)', text: 'pierwszy punkt;' });
    expect(a1.lines[3]).toEqual({ lvl: 1, mark: '2)', text: 'drugi punkt.' });
    expect(a1.lines[1]!.mark).toBe('§ 2.');
    expect(r.articles[1]!.repealed).toBe(true);
    expect(r.articles[2]!.id).toBe('a2_1');
  });
});
