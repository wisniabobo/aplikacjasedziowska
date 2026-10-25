/**
 * Pobiera najnowsze teksty wszystkich aktów z wykazu KSSiP:
 *  – ustawy: tekst ujednolicony z API ELI Kancelarii Sejmu,
 *  – TUE/TFUE: wersja skonsolidowana z Urzędu Publikacji UE (Cellar),
 *  – EKPCz: tekst Rady Europy.
 * Wynik: public/data/acts/<slug>.json + public/data/acts/index.json
 *
 * Użycie: npm run data:acts [-- slug1 slug2 ...]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ACTS, type ActDef } from '../src/data/acts';
import { buildActFromEli } from '../src/lib/eli/buildAct';
import { parseConventionLines, parseEuTreatyXhtml } from '../src/lib/eli/articleStyle';
import { extractPdfLines } from '../src/lib/eli/pdfLines';
import { fetchActMeta } from '../src/lib/eli/api';
import type { ActDoc, ActIndexEntry } from '../src/lib/eli/types';
import { openPdf } from './lib/pdf-node';

const OUT = path.resolve('public/data/acts');
const UA = { 'User-Agent': 'aplikacjasedziowska (https://github.com/wisniabobo/aplikacjasedziowska)' };

async function fetchWithRetry(url: string, init?: RequestInit, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) } });
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status} ${url}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error(String(last));
}

let euCache: string | null = null;
async function buildEu(def: ActDef): Promise<ActDoc> {
  if (def.source.kind !== 'eu') throw new Error('not eu');
  euCache ??= await (await fetchWithRetry(def.source.resource, { headers: { Accept: 'application/xhtml+xml', 'Accept-Language': 'pol' } })).text();
  const { toc, articles } = parseEuTreatyXhtml(euCache, def.source.celex);
  return {
    meta: {
      slug: def.slug,
      eli: 'Dz.Urz. UE C 202 z 7.6.2016',
      title: def.title,
      short: def.short,
      abbr: def.abbr,
      changeDate: '2016-06-07',
      textType: 'EU',
      basedOn: 'Wersja skonsolidowana, Dz.Urz. UE C 202 z 7.6.2016 (Urząd Publikacji UE)',
      sourceUrl: def.source.resource,
      fetchedAt: new Date().toISOString(),
    },
    toc,
    articles,
  };
}

async function buildPdf(def: ActDef): Promise<ActDoc> {
  if (def.source.kind !== 'pdf') throw new Error('not pdf');
  const data = new Uint8Array(await (await fetchWithRetry(def.source.url)).arrayBuffer());
  const doc = await openPdf(data);
  const lines = await extractPdfLines(doc, { splitX: 320 });
  await doc.destroy();
  const { toc, articles } = parseConventionLines(lines);
  let changeDate = '';
  if (def.source.eli) {
    try {
      changeDate = (await fetchActMeta(def.source.eli, fetchWithRetry)).changeDate ?? '';
    } catch {
      /* metadane są opcjonalne */
    }
  }
  return {
    meta: {
      slug: def.slug,
      eli: def.source.eli ?? def.source.url,
      title: def.title,
      short: def.short,
      abbr: def.abbr,
      changeDate,
      textType: 'T',
      basedOn: 'Tekst Konwencji po zmianach wprowadzonych Protokołami nr 11, 14 i 15 (Rada Europy); w Polsce: Dz.U. z 1993 r. Nr 61, poz. 284',
      sourceUrl: def.source.url,
      fetchedAt: new Date().toISOString(),
    },
    toc,
    articles,
  };
}

async function main() {
  const only = new Set(process.argv.slice(2));
  const list = ACTS.filter((a) => only.size === 0 || only.has(a.slug));
  await fs.mkdir(OUT, { recursive: true });
  const indexPath = path.join(OUT, 'index.json');
  let index: ActIndexEntry[] = [];
  try {
    index = JSON.parse(await fs.readFile(indexPath, 'utf8')) as ActIndexEntry[];
  } catch {
    index = [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const failures: string[] = [];
  for (const def of list) {
    const t0 = Date.now();
    try {
      const doc =
        def.source.kind === 'eli'
          ? await buildActFromEli(def, openPdf, { fetch: fetchWithRetry, today, withPending: true })
          : def.source.kind === 'eu'
            ? await buildEu(def)
            : await buildPdf(def);
      if (doc.articles.length < 5) throw new Error(`podejrzanie mało artykułów: ${doc.articles.length}`);
      const json = JSON.stringify(doc);
      await fs.writeFile(path.join(OUT, `${def.slug}.json`), json);
      const entry: ActIndexEntry = {
        slug: def.slug,
        eli: doc.meta.eli,
        title: def.title,
        short: def.short,
        abbr: def.abbr,
        group: def.group,
        changeDate: doc.meta.changeDate,
        textDate: doc.meta.textDate,
        articles: doc.articles.filter((a) => !a.repealed).length,
        bytes: json.length,
        ...(def.wykazNo ? { wykazNo: def.wykazNo } : {}),
      };
      index = index.filter((e) => e.slug !== def.slug).concat(entry);
      console.log(`✓ ${def.slug.padEnd(20)} ${String(doc.articles.length).padStart(5)} art.  ${(json.length / 1024).toFixed(0)} kB  ${Date.now() - t0} ms`);
    } catch (e) {
      failures.push(def.slug);
      console.error(`✗ ${def.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const order = new Map(ACTS.map((a, i) => [a.slug, i]));
  index.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99));
  await fs.writeFile(indexPath, JSON.stringify(index, null, 1));
  await fs.writeFile(path.join(OUT, 'updated.json'), JSON.stringify({ updatedAt: new Date().toISOString() }));
  if (failures.length) {
    console.error(`Nie udało się: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
