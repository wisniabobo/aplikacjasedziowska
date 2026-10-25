/**
 * Po `vite build`: dla każdej trasy zapisuje dist/<trasa>/index.html z własnym tytułem,
 * opisem, adresem kanonicznym, Open Graph i treścią czytelną dla wyszukiwarek (aplikacja React
 * zastępuje ją po wczytaniu). Generuje też sitemap.xml i robots.txt.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ACTS } from '../src/data/acts';
import { AREAS, NABOR_2026, STAGES } from '../src/data/exam';
import type { ActDoc, ActIndexEntry } from '../src/lib/eli/types';

const SITE = (process.env.SITE_URL ?? 'https://sedzia.wisnia.dev').replace(/\/$/, '');
const DIST = path.resolve('dist');
const DATA = path.resolve('public/data');

interface Page {
  route: string;
  title: string;
  description: string;
  body: string;
  priority: number;
  changefreq: 'daily' | 'weekly' | 'monthly';
  lastmod?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const nav = `<nav><a href="/">Start</a> · <a href="/nauka">Nauka</a> · <a href="/nauka/testy">Oficjalne testy KSSiP</a> · <a href="/ustawy">Ustawy z wykazu</a> · <a href="/kazusy">Kazusy</a> · <a href="/kariera">Zarobki</a> · <a href="/nabor">Nabór 2026</a></nav>`;

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, 'utf8')) as T;
}

async function main() {
  const template = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');
  const acts = await readJson<ActIndexEntry[]>(path.join(DATA, 'acts/index.json'));
  const exams = await readJson<{ id: string; year: number; kind: string; label: string; count: number; verified: number }[]>(path.join(DATA, 'exams/index.json'));
  const casus = await readJson<{ id: string; year: number; label: string; tasks: string[] }[]>(path.join(DATA, 'casus/index.json'));
  const stats = await readJson<{ total: number }>(path.join(DATA, 'questions/stats.json'));
  const updated = (await readJson<{ updatedAt: string }>(path.join(DATA, 'acts/updated.json'))).updatedAt.slice(0, 10);
  const official = exams.reduce((s, e) => s + e.count, 0);
  const verified = exams.reduce((s, e) => s + e.verified, 0);
  const total = stats.total + verified;
  const fmt = (n: number) => n.toLocaleString('pl-PL');

  const pages: Page[] = [
    {
      route: '/',
      title: 'Sędzia – nauka do konkursu na aplikację sędziowską KSSiP',
      description: `Przygotowanie do egzaminu wstępnego na aplikację sędziowską: oficjalne testy KSSiP z kluczami, ${fmt(total)} pytań, kazusy z kryteriami oceny, 28 ustaw z wykazu i kalkulator wynagrodzeń.`,
      priority: 1,
      changefreq: 'daily',
      lastmod: updated,
      body: `<h1>Przygotuj się do konkursu na aplikację sędziowską</h1>
<p>Sędzia to kompletne miejsce do nauki do egzaminu wstępnego w Krajowej Szkole Sądownictwa i Prokuratury: ${fmt(official)} pytań z oficjalnych testów KSSiP z lat 2010–2026 z kluczami odpowiedzi, ${fmt(stats.total)} pytań z aktualnego brzmienia przepisów, kazusy II etapu z kryteriami oceny i czytnik wszystkich aktów z wykazu na ${NABOR_2026.year} r.</p>
<ul><li>Symulacja egzaminu: ${STAGES.test.questions} pytań, ${STAGES.test.minutes} minut, wynik według dziedzin</li><li>Powtórki w systemie Leitnera – wracasz do pytań, które sprawiają trudność</li><li>Ustawy aktualizowane z API Sejmu (teksty ujednolicone Kancelarii Sejmu)</li><li>Kalkulator wynagrodzeń aplikanta, asesora i sędziego z PIT i dojazdami</li></ul>
<p>I etap konkursu ${NABOR_2026.year}: ${NABOR_2026.stage1.split('-').reverse().join('.')}; II etap: ${NABOR_2026.stage2.split('-').reverse().join('.')}. Limit: ${NABOR_2026.limits.sedziowska} miejsc na aplikacji sędziowskiej.</p>`,
    },
    {
      route: '/nauka',
      title: 'Nauka do testu KSSiP – sesje, powtórki i symulacja egzaminu · Sędzia',
      description: `Ucz się według dziedzin z rozporządzenia, według ustaw albo rodzaju zagadnienia (terminy, właściwość sądu, większość głosów). ${fmt(total)} pytań z kluczem.`,
      priority: 0.9,
      changefreq: 'weekly',
      body: `<h1>Nauka do testu na aplikację sędziowską</h1><p>Szybkie sesje w proporcjach dziedzin jak na teście, powtórki, lista błędów i symulacja całego egzaminu (150 pytań, 150 minut).</p><h2>Dziedziny testu</h2><ol>${AREAS.map((a) => `<li>${esc(a.label)}</li>`).join('')}</ol>`,
    },
    {
      route: '/nauka/testy',
      title: 'Oficjalne testy KSSiP z kluczami odpowiedzi (2010–2026) · Sędzia',
      description: `Testy I etapu konkursów na aplikację sędziowską, prokuratorską, ogólną i uzupełniającą z lat 2010–2026 – ${fmt(official)} pytań z kluczem i podstawą prawną.`,
      priority: 0.9,
      changefreq: 'monthly',
      body: `<h1>Oficjalne testy KSSiP z kluczami</h1><p>Każde pytanie ma podstawę prawną z klucza i odnośnik do aktualnego brzmienia przepisu.</p><ul>${exams.map((e) => `<li><a href="/nauka/egzamin/${e.id}">${esc(e.label)}</a> – ${e.count} pytań</li>`).join('')}</ul>`,
    },
    ...exams.map((e) => ({
      route: `/nauka/egzamin/${e.id}`,
      title: `Test KSSiP ${e.year} z kluczem – ${e.kind === 'uzupelniajaca' ? 'aplikacja uzupełniająca' : e.kind === 'ogolna' ? 'aplikacja ogólna' : 'aplikacja sędziowska i prokuratorska'} · Sędzia`,
      description: `Rozwiąż test z konkursu KSSiP ${e.year}: ${e.count} pytań, 150 minut, wynik i omówienie z podstawą prawną z klucza.`,
      priority: 0.7,
      changefreq: 'monthly' as const,
      body: `<h1>${esc(e.label)}</h1><p>Rozwiąż oficjalny test w warunkach egzaminu: ${e.count} pytań, 3 odpowiedzi, 150 minut. Po zakończeniu zobaczysz wynik według dziedzin i omówienie każdej odpowiedzi.</p>`,
    })),
    {
      route: '/nauka/egzamin/symulacja',
      title: 'Symulacja egzaminu na aplikację sędziowską – 150 pytań · Sędzia',
      description: 'Pełna symulacja I etapu konkursu KSSiP: 150 pytań w proporcjach z rozporządzenia, 150 minut, wynik według dziedzin.',
      priority: 0.8,
      changefreq: 'monthly',
      body: '<h1>Symulacja egzaminu</h1><p>150 pytań w proporcjach dziedzin z § 4 rozporządzenia (co najmniej 120 z prawa cywilnego, karnego, pracy, gospodarczego, administracyjnego i postępowań), 150 minut, wynik według dziedzin.</p>',
    },
    {
      route: '/ustawy',
      title: 'Wykaz aktów prawnych na test KSSiP 2026 – teksty ujednolicone · Sędzia',
      description: 'Wszystkie 28 aktów prawnych z wykazu na konkurs 2026 w aktualnym brzmieniu z API Sejmu: Konstytucja, kodeksy, ustawy ustrojowe, TUE, TFUE i EKPCz.',
      priority: 0.9,
      changefreq: 'daily',
      lastmod: updated,
      body: `<h1>Wykaz aktów prawnych objętych testem w 2026 r.</h1><ol>${acts.filter((a) => a.wykazNo).map((a) => `<li><a href="/ustawy/${a.slug}">${esc(a.title)}</a></li>`).join('')}</ol>`,
    },
    {
      route: '/kazusy',
      title: 'Kazusy z konkursu na aplikację sędziowską z kryteriami oceny · Sędzia',
      description: 'Zadania II etapu konkursów KSSiP z prawa prywatnego, publicznego i karnego wraz z oficjalnymi kryteriami oceny i punktacją.',
      priority: 0.8,
      changefreq: 'monthly',
      body: `<h1>Kazusy z kryteriami oceny</h1><p>Trzy zadania, 180 minut, 0–25 punktów za każde. Ćwicz na zadaniach z lat ubiegłych i porównuj rozwiązanie z kryteriami komisji.</p><ul>${casus.map((c) => `<li><a href="/kazusy/${c.id}">Kazusy ${c.year}</a>${c.tasks.length ? ` – ${esc(c.tasks.join(', '))}` : ''}</li>`).join('')}</ul>`,
    },
    ...casus.map((c) => ({
      route: `/kazusy/${c.id}`,
      title: `Kazusy KSSiP ${c.year} z kryteriami oceny · Sędzia`,
      description: `Zadania II etapu konkursu KSSiP ${c.year}${c.tasks.length ? ` (${c.tasks.join(', ').toLowerCase()})` : ''} z oficjalnymi kryteriami oceny.`,
      priority: 0.6,
      changefreq: 'monthly' as const,
      body: `<h1>Kazusy z konkursu KSSiP ${c.year}</h1><p>${esc(c.label)}. Napisz rozwiązanie z odliczaniem 180 minut i porównaj je z kryteriami oceny.</p>`,
    })),
    {
      route: '/kariera',
      title: 'Ile zarabia sędzia, asesor i aplikant KSSiP w 2026 r. – kalkulator · Sędzia',
      description: 'Kalkulator wynagrodzeń: stypendium aplikanta KSSiP, asesor sądowy, sędzia SR/SO/SA – netto z PIT, składką zdrowotną, dodatkiem za wysługę, pracą na uczelni i kilometrówką.',
      priority: 0.8,
      changefreq: 'monthly',
      body: '<h1>Zarobki aplikanta, asesora i sędziego</h1><p>Podstawa wynagrodzenia sędziów na 2026 r. to 8 748,63 zł (przeciętne wynagrodzenie w II kwartale 2025 r.). Stawka podstawowa sędziego sądu rejonowego: mnożnik 2,05. Stypendium aplikanta: 5 766 zł w pierwszym roku i 6 366 zł później, plus podwyższenie zależne od miejsca zamieszkania.</p><p>Kalkulator liczy netto miesiąc po miesiącu, roczne rozliczenie PIT (także wspólne z małżonkiem i ulgę na dzieci), dochody z uczelni z kosztami 50% oraz zwrot kosztów dojazdu.</p>',
    },
    {
      route: '/nabor',
      title: `Nabór na aplikację sędziowską ${NABOR_2026.year} – terminy, test, kazusy, wymagania · Sędzia`,
      description: `Konkurs KSSiP ${NABOR_2026.year}: test ${NABOR_2026.stage1.split('-').reverse().join('.')}, praca pisemna ${NABOR_2026.stage2.split('-').reverse().join('.')}, ${NABOR_2026.limits.sedziowska} miejsc, opłata ${NABOR_2026.fee} zł. Zasady, wymagania i przebieg aplikacji.`,
      priority: 0.9,
      changefreq: 'weekly',
      body: `<h1>Nabór na aplikację sędziowską ${NABOR_2026.year}</h1>
<h2>Terminy</h2><p>Zgłoszenia w systemie IRK: 3–24 września ${NABOR_2026.year}. I etap (test): ${NABOR_2026.stage1.split('-').reverse().join('.')}. II etap (praca pisemna): ${NABOR_2026.stage2.split('-').reverse().join('.')}.</p>
<h2>Test</h2><p>${STAGES.test.questions} pytań jednokrotnego wyboru z trzema odpowiedziami, ${STAGES.test.minutes} minut, 1 punkt za poprawną odpowiedź. Do II etapu przechodzi dwukrotność sumy limitów przyjęć.</p>
<h2>Praca pisemna</h2><p>Trzy kazusy (prawo prywatne, publiczne i karne), ${STAGES.written.minutes} minut, 0–25 punktów za każde zadanie.</p>
<h2>Aplikacja</h2><p>Aplikacja sędziowska trwa 36 miesięcy i kończy się egzaminem sędziowskim; po nim absolwent wybiera stanowisko asesora sądowego.</p>`,
    },
    ...acts.map((a) => ({
      route: `/ustawy/${a.slug}`,
      title: `${a.short} (${a.abbr}) – tekst ujednolicony${a.textDate ? ` na ${a.textDate.split('-').reverse().join('.')}` : ''} · Sędzia`,
      description: `${a.title} – aktualny tekst z API Sejmu, spis treści, wyszukiwarka i ${fmt(a.articles)} artykułów. ${a.wykazNo ? `Poz. ${a.wykazNo} wykazu aktów na test KSSiP 2026.` : ''}`.trim(),
      priority: 0.7,
      changefreq: 'weekly' as const,
      lastmod: a.textDate ?? updated,
      body: '',
    })),
  ];

  // treść stron ustaw: spis treści i początkowe artykuły
  for (const page of pages) {
    if (!page.route.startsWith('/ustawy/')) continue;
    const slug = page.route.split('/')[2]!;
    const doc = await readJson<ActDoc>(path.join(DATA, `acts/${slug}.json`));
    const def = ACTS.find((d) => d.slug === slug);
    const toc = doc.toc
      .slice(0, 40)
      .map((n) => `<li>${esc(n.label)}${n.title ? ` – ${esc(n.title)}` : ''}</li>`)
      .join('');
    const arts = doc.articles
      .filter((x) => !x.repealed)
      .slice(0, 25)
      .map((x) => `<section id="${x.id}"><h3>Art. ${esc(x.num)}${x.title ? ` – ${esc(x.title)}` : ''}</h3>${x.lines.map((l) => `<p>${l.mark ? `${esc(l.mark)} ` : ''}${esc(l.text)}</p>`).join('')}</section>`)
      .join('');
    page.body = `<h1>${esc(def?.title ?? doc.meta.title)}</h1><p>Stan prawny: ${esc(doc.meta.textDate ?? doc.meta.changeDate.slice(0, 10))}${doc.meta.basedOn ? `. Opracowano na podstawie: ${esc(doc.meta.basedOn)}` : ''}.</p>${toc ? `<h2>Spis treści</h2><ul>${toc}</ul>` : ''}<h2>Przepisy</h2>${arts}`;
  }

  for (const page of pages) {
    const url = `${SITE}${page.route === '/' ? '/' : page.route}`;
    let html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(page.title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(page.title)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
      .replace('<div id="root"></div>', `<div id="root"><div class="page seo-static">${nav}${page.body}</div></div>`);
    if (page.route === '/nabor') {
      const faq = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          { q: `Kiedy jest test na aplikację sędziowską w ${NABOR_2026.year} r.?`, a: `I etap konkursu (test) odbywa się ${NABOR_2026.stage1.split('-').reverse().join('.')}, a II etap (praca pisemna) ${NABOR_2026.stage2.split('-').reverse().join('.')}.` },
          { q: 'Ile pytań jest na teście KSSiP i ile trwa?', a: `Test zawiera ${STAGES.test.questions} pytań z trzema odpowiedziami, z których jedna jest prawidłowa. Czas: ${STAGES.test.minutes} minut.` },
          { q: 'Ile osób przechodzi do II etapu?', a: 'Do drugiego etapu przechodzi liczba kandydatów odpowiadająca dwukrotności sumy limitów przyjęć na aplikację sędziowską i prokuratorską (art. 18 ust. 2 ustawy o KSSiP).' },
          { q: 'Jak wygląda II etap konkursu?', a: `Praca pisemna składa się z trzech kazusów: z prawa prywatnego, publicznego i karnego. Na rozwiązanie jest ${STAGES.written.minutes} minut, a każde zadanie oceniane jest w skali 0–25 punktów.` },
          { q: `Ile wynosi opłata za konkurs w ${NABOR_2026.year} r.?`, a: `${NABOR_2026.fee} zł – równowartość minimalnego wynagrodzenia za pracę.` },
          { q: 'Ile trwa aplikacja sędziowska?', a: 'Aplikacja sędziowska trwa 36 miesięcy i kończy się egzaminem sędziowskim.' },
        ].map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
      };
      html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(faq)}</script>\n</head>`);
    }
    const out = page.route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, page.route.slice(1), 'index.html');
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, html);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${SITE}${p.route === '/' ? '/' : p.route}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}<changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap);
  await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /ustawienia\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`Prerender: ${pages.length} stron, sitemap.xml, robots.txt`);
}

await main();
