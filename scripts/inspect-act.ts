/** Narzędzie deweloperskie: npx tsx scripts/inspect-act.ts <plik.pdf> [nrArt...] */
import fs from 'node:fs';
import { openPdf } from './lib/pdf-node';
import { extractPdfLines } from '../src/lib/eli/pdfLines';
import { parseActLines } from '../src/lib/eli/actParser';

const [file, ...arts] = process.argv.slice(2);
if (!file) throw new Error('Podaj plik PDF');
const doc = await openPdf(new Uint8Array(fs.readFileSync(file)));
const lines = await extractPdfLines(doc);
const parsed = parseActLines(lines);
console.log('linie:', lines.length, 'artykuły:', parsed.articles.length, 'toc:', parsed.toc.length, 'basedOn:', parsed.basedOn, 'date:', parsed.textDate);
const printToc = (nodes: typeof parsed.toc, d = 0) => { for (const n of nodes) { if (d < 4) console.log('  '.repeat(d) + n.label + ' — ' + n.title + ' [' + n.firstArt + ']'); printToc(n.children, d + 1); } };
printToc(parsed.toc);
for (const a of parsed.articles.filter((x) => arts.includes(x.num))) {
  console.log('\nArt.', a.num, a.repealed ? '(uchylony)' : '', a.tocId, a.notes ?? '');
  for (const l of a.lines) console.log('  '.repeat(l.lvl + 1) + (l.mark ?? '') + ' ' + l.text);
}
const nums = parsed.articles.map((a) => a.num);
console.log('\npierwsze:', nums.slice(0, 15).join(' '), '\nostatnie:', nums.slice(-10).join(' '));
