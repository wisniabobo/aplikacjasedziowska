/**
 * Liczy pytania generowane z aktualnych tekstów ustaw i zapisuje statystyki
 * (public/data/questions/stats.json). Same pytania powstają w przeglądarce z tekstu ustawy,
 * więc zawsze odpowiadają wersji pobranej z API Sejmu.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateQuestions, type QuestionKind } from '../src/lib/questions/generator';
import type { ActDoc, ActIndexEntry } from '../src/lib/eli/types';

const ACTS = path.resolve('public/data/acts');
const OUT = path.resolve('public/data/questions');

const index = JSON.parse(await fs.readFile(path.join(ACTS, 'index.json'), 'utf8')) as ActIndexEntry[];
const perAct: Record<string, { total: number; kinds: Partial<Record<QuestionKind, number>> }> = {};
let total = 0;
for (const entry of index) {
  const doc = JSON.parse(await fs.readFile(path.join(ACTS, `${entry.slug}.json`), 'utf8')) as ActDoc;
  const qs = generateQuestions(doc);
  const kinds: Partial<Record<QuestionKind, number>> = {};
  for (const q of qs) kinds[q.kind] = (kinds[q.kind] ?? 0) + 1;
  perAct[entry.slug] = { total: qs.length, kinds };
  total += qs.length;
  console.log(`${entry.slug.padEnd(20)} ${String(qs.length).padStart(6)}`);
}
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'stats.json'), JSON.stringify({ generatedAt: new Date().toISOString(), total, perAct }, null, 1));
console.log('RAZEM', total);
