import { describe, expect, it } from 'vitest';
import { generateQuestions } from '../generator';
import type { ActDoc } from '../../eli/types';

const doc: ActDoc = {
  meta: { slug: 'test', eli: 'DU/1/1', title: 'Test', short: 'Test', abbr: 't.', changeDate: '', textType: 'U', sourceUrl: '', fetchedAt: '' },
  toc: [],
  articles: [
    { id: 'a1', num: '1', lines: [{ lvl: 0, mark: '§ 1.', text: 'Zażalenie wnosi się w terminie 7 dni od dnia doręczenia postanowienia stronie.' }] },
    { id: 'a2', num: '2', lines: [{ lvl: 0, text: 'Sprawy rozpoznaje w pierwszej instancji sąd okręgowy, chyba że ustawa stanowi inaczej.' }] },
    { id: 'a3', num: '3', lines: [{ lvl: 0, text: 'Sejm uchwala ustawę bezwzględną większością głosów w obecności co najmniej połowy ustawowej liczby posłów.' }] },
    { id: 'a4', num: '4', repealed: true, lines: [{ lvl: 0, text: '(uchylony)' }] },
  ],
};

describe('generator pytań', () => {
  const qs = generateQuestions(doc);
  it('tworzy pytania z poprawną odpowiedzią z tekstu przepisu', () => {
    expect(qs.length).toBeGreaterThan(3);
    for (const q of qs) {
      const full = q.before + q.options[q.correct] + q.after;
      const line = doc.articles.find((a) => a.id === q.artId)!.lines[q.line]!.text;
      expect(full.endsWith(line) || full.includes(line)).toBe(true);
      expect(new Set(q.options).size).toBe(3);
    }
  });
  it('jest deterministyczny', () => {
    const again = generateQuestions(doc);
    expect(again.map((q) => [q.id, q.options, q.correct])).toEqual(qs.map((q) => [q.id, q.options, q.correct]));
  });
  it('pomija uchylone przepisy', () => {
    expect(qs.some((q) => q.artId === 'a4')).toBe(false);
  });
  it('rozpoznaje termin, sąd i większość głosów', () => {
    const kinds = new Set(qs.map((q) => q.kind));
    expect(kinds.has('termin')).toBe(true);
    expect(kinds.has('sad')).toBe(true);
    expect(kinds.has('wiekszosc')).toBe(true);
  });
});
