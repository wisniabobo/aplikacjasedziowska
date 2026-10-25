/**
 * Parsery dla aktów w układzie „Artykuł N” – traktatów UE (XHTML z Urzędu Publikacji UE)
 * oraz Europejskiej Konwencji Praw Człowieka (PDF Rady Europy).
 */
import type { ActArticle, ActLine, TocNode } from './types';
import type { PdfLine } from './pdfLines';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<a [^>]*class="[^"]*"[^>]*>.*?<\/a>/gs, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** „TYTUŁ IV” → „Tytuł IV”, „CZĘŚĆ PIERWSZA” → „Część pierwsza”. */
function headingLabel(text: string): string {
  const [first = '', ...rest] = text.split(/\s+/);
  const word = first.charAt(0) + first.slice(1).toLowerCase();
  const tail = rest.map((w) => (/^[IVXLC]+[A-Z]?$/.test(w) ? w : w.toLowerCase())).join(' ');
  return tail ? `${word} ${tail}` : word;
}

const UNIT_RE = /^(\d+[a-z]?\.|\d+[a-z]?\)|[a-z]{1,2}\)|[ivx]+\)|[–—-])$/;

function lvlOf(mark: string): ActLine['lvl'] {
  if (/^\d+[a-z]?\.$/.test(mark)) return 0;
  if (/^\d+[a-z]?\)$/.test(mark)) return 1;
  if (/^[a-z]{1,2}\)$/.test(mark)) return 2;
  if (/^[ivx]+\)$/.test(mark)) return 3;
  return 3;
}

/**
 * Wycina z Dz.Urz. UE C 202 z 7.6.2016 tekst jednego traktatu i dzieli go na artykuły.
 */
export function parseEuTreatyXhtml(xhtml: string, which: 'TUE' | 'TFUE'): { toc: TocNode[]; articles: ActArticle[] } {
  // Granice traktatów wyznaczają akapity z klasą „doc-ti” (tytuły dokumentów w Dz.Urz. UE).
  const titles = [...xhtml.matchAll(/<p[^>]*class="doc-ti"[^>]*>(.*?)<\/p>/gs)].map((m) => ({
    at: m.index ?? 0,
    text: stripTags(m[1] ?? ''),
  }));
  const startTitle = which === 'TUE' ? 'TRAKTAT O UNII EUROPEJSKIEJ (WERSJA SKONSOLIDOWANA)' : 'TRAKTAT O FUNKCJONOWANIU UNII EUROPEJSKIEJ (WERSJA SKONSOLIDOWANA)';
  const endTitle = which === 'TUE' ? 'TRAKTAT O FUNKCJONOWANIU UNII EUROPEJSKIEJ (WERSJA SKONSOLIDOWANA)' : 'PROTOKOŁY';
  const start = titles.find((t) => t.text === startTitle)?.at ?? -1;
  if (start < 0) throw new Error(`Nie znaleziono początku ${which}`);
  const end = titles.find((t) => t.at > start && t.text === endTitle)?.at ?? xhtml.length;
  const body = xhtml.slice(start, end);

  const toc: TocNode[] = [];
  const articles: ActArticle[] = [];
  let tocCounter = 0;
  const stack: { node: TocNode; rank: number }[] = [];
  let current: ActArticle | null = null;
  let pendingHeading: TocNode | null = null;
  let expectTitle = false;

  // Tokenizacja: akapity <p class="..."> oraz wiersze tabel z numeracją.
  const tokenRe = /<p[^>]*class="([^"]+)"[^>]*>(.*?)<\/p>|<tr>(.*?)<\/tr>/gs;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body))) {
    if (m[3] !== undefined) {
      if (!current) continue;
      const cells = [...m[3].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => stripTags(c[1] ?? ''));
      if (cells.length >= 2 && UNIT_RE.test(cells[0]!)) {
        current.lines.push({ lvl: lvlOf(cells[0]!), mark: cells[0], text: cells.slice(1).join(' ') });
      } else if (cells.length) {
        const text = cells.join(' ').trim();
        if (text) current.lines.push({ lvl: 0, text });
      }
      continue;
    }
    const cls = (m[1] ?? '').split(/\s+/);
    const text = stripTags(m[2] ?? '');
    if (!text) continue;
    if (cls.includes('ti-section-1') || (cls.includes('ti-section-2') && !pendingHeading)) {
      const rank = /^(CZĘŚĆ)/i.test(text) ? 1 : /^TYTUŁ/i.test(text) ? 2 : /^ROZDZIAŁ/i.test(text) ? 3 : /^SEKCJA/i.test(text) ? 4 : 0;
      if (cls.includes('ti-section-1') && rank > 0) {
        const kind = rank === 1 ? 'part' : rank === 2 ? 'title' : rank === 3 ? 'chapter' : 'subchapter';
        const node: TocNode = { id: `t${++tocCounter}`, kind, label: headingLabel(text), title: '', children: [] };
        while (stack.length && stack[stack.length - 1]!.rank >= rank) stack.pop();
        if (stack.length) stack[stack.length - 1]!.node.children.push(node);
        else toc.push(node);
        stack.push({ node, rank });
        pendingHeading = node;
        current = null;
        continue;
      }
    }
    if (cls.includes('ti-section-2') && pendingHeading) {
      pendingHeading.title = pendingHeading.title ? `${pendingHeading.title} ${text}` : text;
      continue;
    }
    if (cls.includes('ti-art')) {
      const num = text.replace(/^Artykuł\s+/i, '').trim();
      const id = `a${num.replace(/\s+/g, '')}`;
      current = { id, num, tocId: stack.length ? stack[stack.length - 1]!.node.id : undefined, lines: [] };
      for (const s of stack) if (!s.node.firstArt) s.node.firstArt = id;
      articles.push(current);
      pendingHeading = null;
      expectTitle = true;
      continue;
    }
    if (cls.includes('sti-art') && current && expectTitle) {
      const t = text.replace(/^\((dawny|dawne)[^)]*\)\s*/i, '').trim();
      const old = /\((dawny|dawne)[^)]*\)/i.exec(text)?.[0];
      if (t) current.title = t;
      if (old) (current.notes ??= []).push(old.replace(/[()]/g, ''));
      continue;
    }
    if (cls.includes('normal') && current) {
      expectTitle = false;
      const mm = /^(\d+[a-z]?\.)\s+(.*)$/.exec(text);
      if (mm) current.lines.push({ lvl: 0, mark: mm[1], text: mm[2]! });
      else current.lines.push({ lvl: 0, text });
    }
  }
  return { toc, articles };
}

const ARTYKUL_RE = /^(?:Artykuł|ARTYKUŁ)\s+(\d+[a-z]?)\s*$/;
const PROTOCOL_RE = /^((?:Protokół|PROTOKÓŁ)(?: (?:nr|NR) \d+)?(?: (?:dodatkowy|do Konwencji|DO KONWENCJI).*)?)$/;
const SECTION_RE = /^(Tytuł|TYTUŁ|Rozdział|ROZDZIAŁ|Część|CZĘŚĆ)\s+([IVXLC\d]+)\s*(.*)$/;

/**
 * Parser EKPCz: linie PDF Rady Europy w układzie „Artykuł N” + tytuł artykułu.
 * Protokoły dodatkowe tworzą osobne węzły spisu treści, a ich artykuły dostają prefiks.
 */
export function parseConventionLines(lines: PdfLine[]): { toc: TocNode[]; articles: ActArticle[] } {
  const body = lines.filter((l) => l.zone !== 'header' && !/^\d{1,3}$/.test(l.text.trim()));
  const toc: TocNode[] = [];
  const articles: ActArticle[] = [];
  let tocCounter = 0;
  let protocol: TocNode | null = null;
  let section: TocNode | null = null;
  let prefix = '';
  let current: ActArticle | null = null;
  let line: ActLine | null = null;
  let expectTitle = false;
  let started = false;
  const used = new Set<string>();

  for (const l of body) {
    const text = l.text.trim();
    if (!text) continue;
    const prot = PROTOCOL_RE.exec(text);
    if (prot && started && text.length < 120 && !text.endsWith(',')) {
      protocol = { id: `t${++tocCounter}`, kind: 'part', label: text, title: '', children: [] };
      toc.push(protocol);
      section = null;
      const n = /nr (\d+)/.exec(text)?.[1] ?? String(tocCounter);
      prefix = `p${n}-`;
      current = null;
      line = null;
      continue;
    }
    const sec = SECTION_RE.exec(text);
    if (sec && text.length < 80) {
      section = { id: `t${++tocCounter}`, kind: 'title', label: `${sec[1]!.charAt(0)}${sec[1]!.slice(1).toLowerCase()} ${sec[2]}`, title: sec[3] ?? '', children: [] };
      (protocol ? protocol.children : toc).push(section);
      current = null;
      line = null;
      started = true;
      continue;
    }
    const art = ARTYKUL_RE.exec(text);
    if (art) {
      started = true;
      let id = `${prefix}a${art[1]}`;
      while (used.has(id)) id += '_';
      used.add(id);
      const num = prefix ? `${art[1]} (${protocol?.label ?? ''})` : art[1]!;
      current = { id, num, tocId: (section ?? protocol)?.id, lines: [] };
      for (const node of [protocol, section]) if (node && !node.firstArt) node.firstArt = id;
      articles.push(current);
      line = null;
      expectTitle = true;
      continue;
    }
    if (!current) {
      if (section && !section.title && text.length < 80) section.title = text;
      else if (protocol && !protocol.title && text.length < 200) protocol.title = text;
      continue;
    }
    if (expectTitle && !current.title && !/^\d+\.\s/.test(text) && text.length < 90 && !/[.;,]$/.test(text)) {
      current.title = text;
      continue;
    }
    expectTitle = false;
    const mm = /^(\d+\.|[a-z]\))\s+(.*)$/.exec(text);
    if (mm) {
      line = { lvl: mm[1]!.endsWith(')') ? 2 : 0, mark: mm[1], text: mm[2]! };
      current.lines.push(line);
    } else if (line) {
      line.text = line.text.endsWith('-') ? line.text.slice(0, -1) + text : `${line.text} ${text}`;
    } else {
      line = { lvl: 0, text };
      current.lines.push(line);
    }
  }
  return { toc, articles };
}
