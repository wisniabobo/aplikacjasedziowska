import type { ActArticle, ActLine, TocKind, TocNode } from './types';
import { numericMode, type PdfLine } from './pdfLines';

const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUP_RE = `[${SUP_DIGITS}]`;

/** „Art. 417¹.”, „Art. 4–6.”, „Art. 79¹–79³.” */
const ART_RE = new RegExp(
  `^Art\\.\\s*(\\d+[a-z]{0,3}${SUP_RE}*(?:\\s*[–-]\\s*\\d+[a-z]{0,3}${SUP_RE}*)?)\\.(?:\\s+|$)(.*)$`,
);
const PARA_RE = new RegExp(`^(§\\s*\\d+[a-z]{0,3}${SUP_RE}*\\.)(?:\\s+|$)(.*)$`);
const UST_RE = new RegExp(`^(\\d+[a-z]{0,3}${SUP_RE}*\\.)(?:\\s+|$)(.*)$`);
const PKT_RE = new RegExp(`^(\\d+[a-z]{0,3}${SUP_RE}*\\))(?:\\s+|$)(.*)$`);
const LIT_RE = new RegExp(`^([a-z]{1,3}${SUP_RE}*\\))(?:\\s+|$)(.*)$`);
const TIRET_RE = /^([–—-]\s?[–—-]?)(?:\s+)(.*)$/;

const HEADING_RE =
  /^(KSIĘGA|Księga|CZĘŚĆ|Część|TYTUŁ|Tytuł|DZIAŁ|Dział|ROZDZIAŁ|Rozdział|ODDZIAŁ|Oddział|PODDZIAŁ|Poddział)(?=\s|$)\s*(.*)$/;
const ANNEX_RE = /^(ZAŁĄCZNIK|Załącznik|ZAŁĄCZNIKI|Załączniki)(?=\s|$|\s*nr)(.*)$/;

const KIND_BY_WORD: Record<string, TocKind> = {
  część: 'part',
  księga: 'book',
  tytuł: 'title',
  dział: 'section',
  rozdział: 'chapter',
  oddział: 'subchapter',
  poddział: 'subchapter',
};
const RANK: Record<TocKind, number> = {
  part: 1,
  book: 2,
  title: 3,
  section: 4,
  chapter: 5,
  subchapter: 6,
  annex: 0,
  other: 7,
};

export function capitalizeHeading(word: string, rest: string): string {
  const w = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return rest ? `${w} ${rest}` : w;
}

/** Zamienia numer artykułu na identyfikator kotwicy: „417¹” → „a417_1”, „4–6” → „a4-6”. */
export function articleId(num: string): string {
  let out = '';
  let sup = false;
  for (const ch of num) {
    const si = SUP_DIGITS.indexOf(ch);
    if (si >= 0) {
      if (!sup) out += '_';
      out += String(si);
      sup = true;
    } else {
      sup = false;
      if (ch === '–' || ch === '-') out += '-';
      else if (/\s/.test(ch)) continue;
      else out += ch;
    }
  }
  return `a${out}`;
}

function joinText(a: string, b: string, dehyphenate: boolean): string {
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith('-')) {
    const prev = a.charAt(a.length - 2);
    if (dehyphenate && /[a-ząćęłńóśźż]/.test(prev) && /^[a-ząćęłńóśźż]/.test(b)) return a.slice(0, -1) + b;
    return a + b;
  }
  return `${a} ${b}`;
}

export interface ParseOptions {
  dehyphenate?: boolean;
}

export interface ParsedAct {
  toc: TocNode[];
  articles: ActArticle[];
  basedOn?: string;
  textDate?: string;
  preamble?: string[];
}

interface Ctx {
  left: number;
  indent: number;
  center: number;
  right: number;
}

function isCentered(l: PdfLine, c: Ctx): boolean {
  const mid = (l.x + l.x2) / 2;
  const width = l.x2 - l.x;
  return Math.abs(mid - c.center) < 18 && width < (c.right - c.left) * 0.86 && l.x > c.left + 8;
}

/**
 * Parsuje linie tekstu ujednoliconego do struktury: spis treści + artykuły.
 */
export function parseActLines(lines: PdfLine[], opts: ParseOptions = {}): ParsedAct {
  const dehyphenate = opts.dehyphenate ?? false;
  const body = lines.filter((l) => l.zone === 'body');
  const left = numericMode(body.filter((l) => l.text.length > 30).map((l) => l.x));
  const artLines = body.filter((l) => ART_RE.test(l.text));
  const indent = artLines.length ? numericMode(artLines.map((l) => l.x)) : left + 25;
  const right = numericMode(body.filter((l) => l.text.length > 50).map((l) => l.x2)) || left + 410;
  const ctx: Ctx = { left, indent, right, center: (left + right) / 2 };

  // Adnotacja „Opracowano na podstawie: …” z marginesu pierwszej strony.
  const firstMargin = lines.filter((l) => l.page === 1 && l.zone === 'margin').map((l) => l.text);
  let basedOn: string | undefined;
  const mIdx = firstMargin.findIndex((t) => t.startsWith('Opracowano'));
  if (mIdx >= 0) {
    basedOn = firstMargin
      .slice(mIdx)
      .join(' ')
      .replace(/^Opracowano\s+na\s+podstawie:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const dateLine = lines.find((l) => l.zone === 'header' && /^\d{4}-\d{2}-\d{2}$/.test(l.text));
  const textDate = dateLine?.text;

  const toc: TocNode[] = [];
  const stack: TocNode[] = [];
  const articles: ActArticle[] = [];
  const preamble: string[] = [];
  let current: ActArticle | null = null;
  let currentLine: ActLine | null = null;
  let pendingHeading: TocNode | null = null;
  let headingTitleOpen = false;
  let tocCounter = 0;
  let started = false;
  const usedIds = new Set<string>();

  const pushToc = (node: TocNode) => {
    while (stack.length && RANK[stack[stack.length - 1]!.kind] >= RANK[node.kind]) stack.pop();
    if (stack.length) stack[stack.length - 1]!.children.push(node);
    else toc.push(node);
    stack.push(node);
  };
  const currentTocId = () => (stack.length ? stack[stack.length - 1]!.id : undefined);

  // Adnotacje z marginesu przypisujemy do artykułu, który zajmuje to miejsce strony.
  const marginByPage = new Map<number, PdfLine[]>();
  for (const l of lines) {
    if (l.zone !== 'margin' || l.page === 1) continue;
    const arr = marginByPage.get(l.page) ?? [];
    arr.push(l);
    marginByPage.set(l.page, arr);
  }
  const notesQueue: { page: number; y: number; text: string }[] = [];
  for (const [page, ml] of marginByPage) {
    ml.sort((a, b) => a.y - b.y);
    let buf: PdfLine[] = [];
    const flush = () => {
      if (!buf.length) return;
      const text = buf.map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim();
      if (/wejdzie w życie|wchodzi w życie|traci moc|uchyl/i.test(text)) notesQueue.push({ page, y: buf[0]!.y, text });
      buf = [];
    };
    for (const l of ml) {
      const last = buf[buf.length - 1];
      if (last && l.y - last.y > l.size * 1.9) flush();
      buf.push(l);
    }
    flush();
  }
  const articlePos: { page: number; y: number; art: ActArticle }[] = [];

  for (const l of body) {
    const text = l.text;
    const h = HEADING_RE.exec(text);
    const annex = ANNEX_RE.exec(text);
    const art = ART_RE.exec(text);

    if (h && isCentered(l, ctx) && !art) {
      const word = h[1]!.toLowerCase();
      const kind = KIND_BY_WORD[word] ?? 'other';
      const rest = h[2]!.trim();
      // „CZĘŚĆ OGÓLNA” – nazwa w tej samej linii; „TYTUŁ I” – tytuł w następnej.
      const node: TocNode = {
        id: `t${++tocCounter}`,
        kind,
        label: capitalizeHeading(h[1]!, rest),
        title: '',
        children: [],
      };
      pushToc(node);
      pendingHeading = node;
      headingTitleOpen = true;
      current = null;
      currentLine = null;
      started = true;
      continue;
    }
    if (annex && (isCentered(l, ctx) || l.x <= ctx.left + 2) && started && !art) {
      const node: TocNode = { id: `t${++tocCounter}`, kind: 'annex', label: text.replace(/\s+/g, ' '), title: '', children: [] };
      while (stack.length) stack.pop();
      toc.push(node);
      stack.push(node);
      const annexArt: ActArticle = { id: `zal${tocCounter}`, num: text, tocId: node.id, lines: [] };
      node.firstArt = annexArt.id;
      articles.push(annexArt);
      current = annexArt;
      currentLine = null;
      pendingHeading = null;
      headingTitleOpen = false;
      continue;
    }
    if (headingTitleOpen && pendingHeading && !art && isCentered(l, ctx)) {
      pendingHeading.title = pendingHeading.title ? `${pendingHeading.title} ${text}` : text;
      continue;
    }
    headingTitleOpen = false;

    if (art && (Math.abs(l.x - ctx.indent) < 6 || l.x <= ctx.left + 2)) {
      started = true;
      const num = art[1]!.replace(/\s+/g, '').replace('-', '–');
      let id = articleId(num);
      while (usedIds.has(id)) id += '_';
      usedIds.add(id);
      const rest = art[2]!.trim();
      current = { id, num, tocId: currentTocId(), lines: [] };
      if (/^\((uchylony|uchylone|pominięty|pominięte|utracił moc|utraciły moc)\)/.test(rest)) current.repealed = true;
      articles.push(current);
      articlePos.push({ page: l.page, y: l.y, art: current });
      for (const node of stack) if (!node.firstArt) node.firstArt = id;
      currentLine = startLine(rest);
      if (currentLine) current.lines.push(currentLine);
      pendingHeading = null;
      continue;
    }

    if (!started) {
      preamble.push(text);
      continue;
    }
    if (!current) {
      // Tekst poza artykułem (np. preambuła rozdziału) – dołączamy do tytułu jednostki.
      if (pendingHeading && isCentered(l, ctx)) pendingHeading.title = `${pendingHeading.title} ${text}`.trim();
      continue;
    }

    const isIndented = l.x > ctx.left + 3 || l.tab === true;
    const unit = isIndented ? startLine(text) : null;
    if (unit && unit.mark !== undefined && (unit.lvl > 0 || Math.abs(l.x - ctx.indent) < 6 || l.tab === true)) {
      current.lines.push(unit);
      currentLine = unit;
    } else if (currentLine) {
      currentLine.text = joinText(currentLine.text, text, dehyphenate);
    } else {
      currentLine = { lvl: 0, text };
      current.lines.push(currentLine);
    }
  }

  // Przypisanie adnotacji do artykułów.
  for (const n of notesQueue) {
    let target: ActArticle | undefined;
    for (const p of articlePos) {
      if (p.page < n.page || (p.page === n.page && p.y <= n.y + 14)) target = p.art;
      else break;
    }
    if (target) (target.notes ??= []).push(n.text);
  }

  for (const a of articles) {
    for (const ln of a.lines) ln.text = ln.text.replace(/\s+/g, ' ').trim();
    a.lines = a.lines.filter((ln) => ln.text !== '' || ln.mark);
  }
  return { toc: cleanToc(toc), articles, basedOn, textDate, preamble: preamble.length ? preamble : undefined };
}

function startLine(text: string): ActLine | null {
  if (!text) return null;
  let m = PARA_RE.exec(text);
  if (m) return { lvl: 0, mark: m[1]!.replace(/\s+/g, ' '), text: m[2]!.trim() };
  m = UST_RE.exec(text);
  if (m && !/^\d{1,2}\.\d/.test(text)) return { lvl: 0, mark: m[1]!, text: m[2]!.trim() };
  m = PKT_RE.exec(text);
  if (m) return { lvl: 1, mark: m[1]!, text: m[2]!.trim() };
  m = LIT_RE.exec(text);
  if (m) return { lvl: 2, mark: m[1]!, text: m[2]!.trim() };
  m = TIRET_RE.exec(text);
  if (m) return { lvl: m[1]!.replace(/\s/g, '').length > 1 ? 4 : 3, mark: m[1]!.replace(/\s/g, ' '), text: m[2]!.trim() };
  return { lvl: 0, text };
}

function cleanToc(nodes: TocNode[]): TocNode[] {
  for (const n of nodes) {
    n.title = n.title.replace(/\s+/g, ' ').trim();
    n.children = cleanToc(n.children);
  }
  return nodes;
}
