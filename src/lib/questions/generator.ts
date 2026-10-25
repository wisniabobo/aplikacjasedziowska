/**
 * Generator pytań „przepisowych” z aktualnego tekstu ustawy.
 *
 * Każde pytanie to fragment przepisu z luką i trzema odpowiedziami (jak na egzaminie KSSiP):
 * poprawna jest dokładnie ta, która występuje w treści przepisu. Dystraktory powstają
 * przez podmianę elementu tego samego rodzaju (termin, kwota, sąd, organ, większość głosów…),
 * więc zawsze są gramatycznie zgodne z kontekstem, a tylko jedna odpowiedź jest zgodna z ustawą.
 * Generowanie jest deterministyczne – to samo brzmienie przepisu daje to samo pytanie i ten sam identyfikator.
 */
import type { ActArticle, ActDoc } from '../eli/types';

export type QuestionKind =
  | 'termin'
  | 'liczba'
  | 'kwota'
  | 'ulamek'
  | 'sad'
  | 'organ'
  | 'wiekszosc'
  | 'sankcja'
  | 'skutek'
  | 'tryb';

export interface GeneratedQuestion {
  id: string;
  act: string;
  artId: string;
  artNum: string;
  line: number;
  kind: QuestionKind;
  /** Tekst przed luką (z kontekstem jednostki redakcyjnej). */
  before: string;
  after: string;
  options: [string, string, string];
  correct: 0 | 1 | 2;
  /** Oznaczenie jednostki, np. „§ 2.” */
  mark?: string;
}

/** FNV-1a 32-bit → base36. */
export function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Deterministyczny generator liczb pseudolosowych (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(s: string): number {
  return parseInt(hashId(s), 36) >>> 0;
}

function pickDistinct(pool: string[], exclude: Set<string>, n: number, rand: () => number): string[] {
  const avail = [...new Set(pool)].filter((p) => !exclude.has(p.toLowerCase()));
  const out: string[] = [];
  while (out.length < n && avail.length) {
    const i = Math.floor(rand() * avail.length);
    out.push(avail.splice(i, 1)[0]!);
  }
  return out;
}

interface Candidate {
  start: number;
  end: number;
  answer: string;
  kind: QuestionKind;
  distractors: (rand: () => number, text: string) => string[];
  priority: number;
}

// ---------------------------------------------------------------- terminy i liczby

const UNIT_RE =
  /\b(\d{1,3})\s+(dni|dnia|tygodni|tygodnie|tygodnia|miesięcy|miesiące|miesiąca|miesiąc|lat|lata|roku|rok|godzin|godziny|godziny)\b/g;
const UNIT_BEFORE_RE = /\b(lat|miesięcy|dni)\s+(\d{1,3})\b/g;

const PLAUSIBLE: Record<string, number[]> = {
  dni: [3, 7, 14, 21, 30, 60, 90],
  dnia: [3, 7, 14, 21, 30],
  tygodni: [1, 2, 3, 4, 6, 8],
  tygodnie: [2, 3, 4],
  miesięcy: [1, 2, 3, 6, 12, 18, 24],
  miesiące: [2, 3, 4],
  lat: [1, 2, 3, 5, 6, 8, 10, 12, 15, 20, 25],
  lata: [2, 3, 4],
  godzin: [12, 24, 48, 72],
  godziny: [2, 3, 4],
};

/** Liczebnik zgodny z formą rzeczownika, np. „lata” wymaga 2–4. */
function numberFitsUnit(n: number, unit: string): boolean {
  const last = n % 10;
  const lastTwo = n % 100;
  const paucal = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  if (['lata', 'miesiące', 'tygodnie', 'godziny'].includes(unit)) return paucal;
  return true;
}

function numberCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(UNIT_RE)) {
    const num = Number(m[1]);
    const unit = m[2]!;
    const start = m.index ?? 0;
    const pool = (PLAUSIBLE[unit] ?? [1, 2, 3, 5, 7, 10, 14, 30]).filter((n) => n !== num && numberFitsUnit(n, unit));
    if (pool.length < 2) continue;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'termin',
      priority: 3,
      distractors: (rand, ctx) => pickDistinct(pool.map(String), new Set([m[1]!, ...numbersInText(ctx, unit)]), 2, rand),
    });
  }
  for (const m of text.matchAll(UNIT_BEFORE_RE)) {
    const unit = m[1]!;
    const num = Number(m[2]);
    const start = (m.index ?? 0) + m[0].length - m[2]!.length;
    const pool = (PLAUSIBLE[unit] ?? [1, 2, 3, 5, 8, 10]).filter((n) => n !== num);
    out.push({
      start,
      end: start + m[2]!.length,
      answer: m[2]!,
      kind: unit === 'lat' ? 'sankcja' : 'termin',
      priority: 3,
      distractors: (rand) => pickDistinct(pool.map(String), new Set([m[2]!]), 2, rand),
    });
  }
  // liczby członków / sędziów / posłów / osób
  for (const m of text.matchAll(/\b(\d{1,3})\s+(członków|sędziów|posłów|senatorów|osób|ławników|prokuratorów)\b/g)) {
    const num = Number(m[1]);
    const pool = [num - 2, num - 1, num + 1, num + 2, num * 2, Math.max(1, Math.round(num / 2))].filter((n) => n > 0 && n !== num);
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'liczba',
      priority: 2,
      distractors: (rand) => pickDistinct(pool.map(String), new Set([m[1]!]), 2, rand),
    });
  }
  return out;
}

function numbersInText(text: string, unit: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,3})\\s+${unit}\\b`, 'g'))) out.push(m[1]!);
  return out;
}

// terminy słowne w dopełniaczu („w terminie miesiąca”)
const TERM_WORDS = ['tygodnia', '7 dni', '14 dni', '30 dni', 'miesiąca', '2 miesięcy', '3 miesięcy', '6 miesięcy', 'roku', '2 lat', '3 lat'];
const TERM_CTX_RE =
  /\b(w terminie|w ciągu|przed upływem|po upływie|w okresie|nie później niż w terminie|przez okres)\s+(tygodnia|miesiąca|roku|dwóch tygodni|dwóch miesięcy|trzech miesięcy|sześciu miesięcy|dwóch lat|trzech lat|pięciu lat|dziesięciu lat)\b/g;

function wordTermCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(TERM_CTX_RE)) {
    const ans = m[2]!;
    const start = (m.index ?? 0) + m[1]!.length + 1;
    out.push({
      start,
      end: start + ans.length,
      answer: ans,
      kind: 'termin',
      priority: 3,
      distractors: (rand) => pickDistinct(TERM_WORDS, new Set([ans]), 2, rand),
    });
  }
  return out;
}

// ---------------------------------------------------------------- kwoty i ułamki

function moneyCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(/\b(\d{1,3}(?:[  ]\d{3})*|\d+)\s+(złotych|zł)\b/g)) {
    const raw = m[1]!;
    const value = Number(raw.replace(/[  ]/g, ''));
    if (!Number.isFinite(value) || value < 10) continue;
    const fmt = (v: number) => v.toLocaleString('pl-PL').replace(/ /g, ' ');
    const pool = [value * 2, value * 5, value / 2, value * 10, value / 5]
      .filter((v) => Number.isInteger(v) && v >= 10 && v !== value)
      .map(fmt);
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + raw.length,
      answer: raw,
      kind: 'kwota',
      priority: 3,
      distractors: (rand) => pickDistinct(pool, new Set([raw, fmt(value)]), 2, rand),
    });
  }
  for (const m of text.matchAll(/\b(\d{1,3})\s?%/g)) {
    const v = Number(m[1]);
    const pool = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100].filter((x) => x !== v).map(String);
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'ulamek',
      priority: 2,
      distractors: (rand) => pickDistinct(pool, new Set([m[1]!]), 2, rand),
    });
  }
  return out;
}

const FRACTIONS = ['1/2', '1/3', '2/3', '3/5', '1/4', '3/4', '1/5'];
const FRACTION_WORDS = ['połowy', 'jednej trzeciej', 'dwóch trzecich', 'trzech piątych', 'jednej czwartej', 'trzech czwartych'];

function fractionCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(/\b([1-9]\/[1-9])\b/g)) {
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'ulamek',
      priority: 3,
      distractors: (rand) => pickDistinct(FRACTIONS, new Set([m[1]!]), 2, rand),
    });
  }
  for (const m of text.matchAll(/\b(połowy|jednej trzeciej|dwóch trzecich|trzech piątych|jednej czwartej|trzech czwartych)\b/g)) {
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'ulamek',
      priority: 3,
      distractors: (rand) => pickDistinct(FRACTION_WORDS, new Set([m[1]!]), 2, rand),
    });
  }
  return out;
}

// ---------------------------------------------------------------- sądy, organy, większości

const COURT_STEMS = ['rejonow', 'okręgow', 'apelacyjn'];
const COURT_RE = /\b(sąd(?:u|owi|em|zie)?|sądy|sądów|sądom|sądach)\s+(rejonow|okręgow|apelacyjn)(y|ego|emu|ym|i|ych|ymi|e)\b/g;

function courtCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(COURT_RE)) {
    const stem = m[2]!;
    const ending = m[3]!;
    const start = (m.index ?? 0) + m[1]!.length + 1;
    const answer = stem + ending;
    const pool = COURT_STEMS.filter((s) => s !== stem).map((s) => s + ending);
    out.push({ start, end: start + answer.length, answer, kind: 'sad', priority: 4, distractors: () => pool });
  }
  return out;
}

/** Organy w mianowniku – podmiot zdania; zamiana nie zmienia składni (czas teraźniejszy). */
const ORGANS_NOM = [
  'Prezydent Rzeczypospolitej',
  'Prezes Rady Ministrów',
  'Marszałek Sejmu',
  'Marszałek Senatu',
  'Minister Sprawiedliwości',
  'Prokurator Generalny',
  'Prokurator Krajowy',
  'Pierwszy Prezes Sądu Najwyższego',
  'Krajowa Rada Sądownictwa',
  'Rada Ministrów',
  'Rzecznik Praw Obywatelskich',
  'Trybunał Konstytucyjny',
  'Sąd Najwyższy',
  'Naczelny Sąd Administracyjny',
  'prezes sądu apelacyjnego',
  'prezes sądu okręgowego',
  'prezes sądu rejonowego',
  'kolegium sądu',
  'zgromadzenie ogólne sędziów apelacji',
];
const ORGAN_RE = new RegExp(`(?<![\\p{L}])(${ORGANS_NOM.map((o) => o.replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`, 'gu');

function organCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(ORGAN_RE)) {
    const answer = m[1]!.replace(/\s+/g, ' ');
    const start = m.index ?? 0;
    // tylko jako podmiot: po organie musi następować czasownik/orzeczenie, nie dopełnienie
    const after = text.slice(start + m[1]!.length, start + m[1]!.length + 3);
    if (/^[a-ząćęłńóśźż]/.test(after.trim()) === false && !/^[\s,]/.test(after)) continue;
    const group = answer.charAt(0) === answer.charAt(0).toLowerCase() ? ORGANS_NOM.filter((o) => o.startsWith('prezes') || o.startsWith('kolegium') || o.startsWith('zgromadzenie')) : ORGANS_NOM.filter((o) => o.charAt(0) === o.charAt(0).toUpperCase());
    out.push({
      start,
      end: start + m[1]!.length,
      answer,
      kind: 'organ',
      priority: 2,
      distractors: (rand, ctx) => pickDistinct(group.filter((g) => !ctx.includes(g)), new Set([answer.toLowerCase()]), 2, rand),
    });
  }
  return out;
}

const MAJORITIES = ['zwykłą większością głosów', 'bezwzględną większością głosów', 'większością 2/3 głosów', 'większością 3/5 głosów'];

function majorityCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(/\b(zwykłą większością głosów|bezwzględną większością głosów|większością (?:co najmniej )?(?:2\/3|3\/5) głosów)/g)) {
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'wiekszosc',
      priority: 5,
      distractors: (rand) => pickDistinct(MAJORITIES, new Set([m[1]!.toLowerCase()]), 2, rand),
    });
  }
  return out;
}

// ---------------------------------------------------------------- skutki prawne i tryb

const EFFECT_STEMS = ['nieważn', 'bezskuteczn', 'wzruszaln'];
const EFFECT_RE = /\b(jest|są|będzie|staje się|stają się)\s+(nieważn|bezskuteczn)(a|y|e|ą)\b/g;

function effectCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(EFFECT_RE)) {
    const stem = m[2]!;
    const ending = m[3]!;
    const start = (m.index ?? 0) + m[1]!.length + 1;
    const answer = stem + ending;
    out.push({
      start,
      end: start + answer.length,
      answer,
      kind: 'skutek',
      priority: 4,
      distractors: () => EFFECT_STEMS.filter((s) => s !== stem).map((s) => s + ending),
    });
  }
  const forms: [RegExp, string[]][] = [
    [/\b(w formie pisemnej|w formie aktu notarialnego|w formie dokumentowej|w formie elektronicznej|w formie pisemnej z podpisami notarialnie poświadczonymi)\b/g,
      ['w formie pisemnej', 'w formie aktu notarialnego', 'w formie dokumentowej', 'w formie elektronicznej', 'w formie pisemnej z podpisami notarialnie poświadczonymi']],
    [/\b(w drodze rozporządzenia|w drodze zarządzenia|w drodze uchwały|w drodze decyzji|w drodze postanowienia)\b/g,
      ['w drodze rozporządzenia', 'w drodze zarządzenia', 'w drodze uchwały', 'w drodze decyzji', 'w drodze postanowienia']],
    [/\b(postanowienie|wyrok|nakaz zapłaty|zarządzenie)(?= (?:sądu|wydaje|wydany|kończące))/g, ['postanowienie', 'wyrok', 'zarządzenie']],
    [/\b(zażalenie|apelacja|skarga kasacyjna|sprzeciw)(?= (?:przysługuje|do sądu|wnosi|wnoszą))/g, ['zażalenie', 'apelacja', 'skarga kasacyjna', 'sprzeciw']],
  ];
  for (const [re, pool] of forms) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      out.push({
        start,
        end: start + m[1]!.length,
        answer: m[1]!,
        kind: 'tryb',
        priority: 4,
        distractors: (rand) => pickDistinct(pool, new Set([m[1]!.toLowerCase()]), 2, rand),
      });
    }
  }
  return out;
}

const PENALTIES_RE = /\b(grzywny, karze ograniczenia wolności albo pozbawienia wolności|karze ograniczenia wolności albo pozbawienia wolności|karze pozbawienia wolności|karze aresztu|karze grzywny|karze nagany)\b/g;
const PENALTIES = ['grzywny, karze ograniczenia wolności albo pozbawienia wolności', 'karze ograniczenia wolności albo pozbawienia wolności', 'karze pozbawienia wolności', 'karze grzywny'];

function penaltyCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(PENALTIES_RE)) {
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + m[1]!.length,
      answer: m[1]!,
      kind: 'sankcja',
      priority: 3,
      distractors: (rand) => pickDistinct(PENALTIES, new Set([m[1]!.toLowerCase()]), 2, rand),
    });
  }
  return out;
}


// ---------------------------------------------------------------- liczebniki słowne

const GEN: Record<number, string> = {
  1: 'jednego', 2: 'dwóch', 3: 'trzech', 4: 'czterech', 5: 'pięciu', 6: 'sześciu', 7: 'siedmiu', 8: 'ośmiu',
  10: 'dziesięciu', 12: 'dwunastu', 14: 'czternastu', 15: 'piętnastu', 20: 'dwudziestu', 21: 'dwudziestu jeden', 30: 'trzydziestu',
};
const GEN_BY_WORD = Object.fromEntries(Object.entries(GEN).map(([k, v]) => [v, Number(k)]));
const GEN_PLAUSIBLE: Record<string, number[]> = {
  lat: [2, 3, 5, 6, 10, 15, 20, 30],
  miesięcy: [2, 3, 6, 12],
  dni: [3, 7, 14, 21, 30],
  tygodni: [2, 3, 4, 6],
  godzin: [12, 24, 48],
};
const GEN_WORDS = Object.values(GEN).sort((a, b) => b.length - a.length).join('|');
const GEN_NUM_RE = new RegExp(`(?<![\\p{L}])(${GEN_WORDS})\\s+(lat|miesięcy|dni|tygodni|godzin)(?![\\p{L}])`, 'gu');
const GEN_AFTER_RE = new RegExp(`(?<![\\p{L}])(lat|miesięcy|dni)\\s+(${GEN_WORDS})(?![\\p{L}])`, 'gu');

const NOM_PHRASES: Record<string, string[]> = {
  lat: ['rok', 'dwa lata', 'trzy lata', 'pięć lat', 'sześć lat', 'dziesięć lat', 'dwadzieścia lat', 'trzydzieści lat'],
  miesięcy: ['miesiąc', 'dwa miesiące', 'trzy miesiące', 'sześć miesięcy', 'dwanaście miesięcy'],
  dni: ['trzy dni', 'siedem dni', 'czternaście dni', 'trzydzieści dni'],
};
const NOM_RE = /(?<![\p{L}])(rok|dwa lata|trzy lata|cztery lata|pięć lat|sześć lat|dziesięć lat|dwadzieścia lat|trzydzieści lat|miesiąc|dwa miesiące|trzy miesiące|sześć miesięcy|dwanaście miesięcy|trzy dni|siedem dni|czternaście dni|trzydzieści dni)(?![\p{L}])/gu;

function wordNumberCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(GEN_NUM_RE)) {
    const word = m[1]!;
    const unit = m[2]!;
    const n = GEN_BY_WORD[word];
    const pool = (GEN_PLAUSIBLE[unit] ?? []).filter((x) => x !== n).map((x) => GEN[x]!).filter(Boolean);
    const start = m.index ?? 0;
    out.push({ start, end: start + word.length, answer: word, kind: 'termin', priority: 3, distractors: (rand) => pickDistinct(pool, new Set([word]), 2, rand) });
  }
  for (const m of text.matchAll(GEN_AFTER_RE)) {
    const unit = m[1]!;
    const word = m[2]!;
    const n = GEN_BY_WORD[word];
    const pool = (GEN_PLAUSIBLE[unit] ?? []).filter((x) => x !== n).map((x) => GEN[x]!).filter(Boolean);
    const start = (m.index ?? 0) + m[0].length - word.length;
    out.push({ start, end: start + word.length, answer: word, kind: 'termin', priority: 3, distractors: (rand) => pickDistinct(pool, new Set([word]), 2, rand) });
  }
  for (const m of text.matchAll(NOM_RE)) {
    const phrase = m[1]!;
    const family = /lat|rok/.test(phrase) ? 'lat' : /miesi/.test(phrase) ? 'miesięcy' : 'dni';
    const start = m.index ?? 0;
    // „rok” jako rzeczownik w innym znaczeniu („w danym roku”) pomijamy – liczymy tylko formy liczebnikowe
    if (phrase === 'rok' && !/(wynosi|trwa|przez|na|okres)\s+$/.test(text.slice(Math.max(0, start - 12), start))) continue;
    if (phrase === 'miesiąc' && !/(wynosi|trwa|przez|na|okres)\s+$/.test(text.slice(Math.max(0, start - 12), start))) continue;
    out.push({
      start,
      end: start + phrase.length,
      answer: phrase,
      kind: 'termin',
      priority: 3,
      distractors: (rand) => pickDistinct(NOM_PHRASES[family]!, new Set([phrase]), 2, rand),
    });
  }
  return out;
}

// ---------------------------------------------------------------- obligatoryjność, instancja, wina, tryb z urzędu

function modalCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /(?<![\p{L}])(nie może|może|musi)\s+(?=[\p{Ll}]+(?:ć|c)(?![\p{L}]))/gu;
  for (const m of text.matchAll(re)) {
    const ans = m[1]!;
    const start = m.index ?? 0;
    out.push({ start, end: start + ans.length, answer: ans, kind: 'tryb', priority: 1, distractors: () => ['może', 'musi', 'nie może'].filter((x) => x !== ans) });
  }
  for (const m of text.matchAll(/(?<![\p{L}])(pierwszej|drugiej) instancji/gu)) {
    const ans = m[1]!;
    const start = m.index ?? 0;
    out.push({ start, end: start + ans.length, answer: ans, kind: 'tryb', priority: 2, distractors: () => ['pierwszej', 'drugiej', 'trzeciej'].filter((x) => x !== ans) });
  }
  for (const m of text.matchAll(/(?<![\p{L}])(nieumyślnie|umyślnie)(?![\p{L}])/gu)) {
    const ans = m[1]!;
    const start = m.index ?? 0;
    out.push({ start, end: start + ans.length, answer: ans, kind: 'skutek', priority: 3, distractors: () => ['umyślnie', 'nieumyślnie', 'w zamiarze bezpośrednim'].filter((x) => x !== ans) });
  }
  for (const m of text.matchAll(/(?<![\p{L}])(z urzędu)(?![\p{L}])/gu)) {
    const start = m.index ?? 0;
    out.push({ start, end: start + 9, answer: 'z urzędu', kind: 'tryb', priority: 2, distractors: () => ['na wniosek strony', 'na żądanie strony'] });
  }
  return out;
}

function subjectCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of text.matchAll(/(?<![\p{L}])(osoba fizyczna|osoba prawna)(?![\p{L}])/gu)) {
    const ans = m[1]!;
    const start = m.index ?? 0;
    out.push({
      start, end: start + ans.length, answer: ans, kind: 'organ', priority: 2,
      distractors: () => ['osoba fizyczna', 'osoba prawna', 'jednostka organizacyjna niebędąca osobą prawną'].filter((x) => x !== ans),
    });
  }
  for (const m of text.matchAll(/(?<![\p{L}])(na piśmie|ustnie)(?![\p{L}])/gu)) {
    const ans = m[1]!;
    const start = m.index ?? 0;
    out.push({ start, end: start + ans.length, answer: ans, kind: 'tryb', priority: 2, distractors: () => ['na piśmie', 'ustnie', 'w formie dokumentowej'].filter((x) => x !== ans) });
  }
  for (const m of text.matchAll(/(?<![\p{L}])(Sejm|Senat|Zgromadzenie Narodowe)(?![\p{L}])/gu)) {
    const ans = m[1]!;
    const start = m.index ?? 0;
    out.push({ start, end: start + ans.length, answer: ans, kind: 'organ', priority: 2, distractors: () => ['Sejm', 'Senat', 'Zgromadzenie Narodowe'].filter((x) => x !== ans) });
  }
  return out;
}

const EXTRACTORS = [
  numberCandidates,
  wordTermCandidates,
  moneyCandidates,
  fractionCandidates,
  courtCandidates,
  organCandidates,
  majorityCandidates,
  effectCandidates,
  penaltyCandidates,
  wordNumberCandidates,
  modalCandidates,
  subjectCandidates,
];

const SKIP_LINE_RE = /^\((uchylony|uchylone|uchylona|pominięty|pominięte|utracił moc|utraciły moc|wygasł|wygasły)\)/;

function lineContext(art: ActArticle, idx: number): string {
  const ln = art.lines[idx]!;
  // dla punktów dołączamy zdanie wprowadzające (ostatnia jednostka wyższego poziomu)
  if (ln.lvl > 0) {
    for (let j = idx - 1; j >= 0; j--) {
      const prev = art.lines[j]!;
      if (prev.lvl < ln.lvl) {
        const intro = prev.text.length > 220 ? `… ${prev.text.slice(-200)}` : prev.text;
        return `${prev.mark ? prev.mark + ' ' : ''}${intro} … `;
      }
    }
  }
  return '';
}

export interface GenerateOptions {
  /** Maksymalna liczba pytań z jednej jednostki redakcyjnej. */
  perLine?: number;
}

/** Generuje pytania z całego aktu. */
export function generateQuestions(doc: ActDoc, opts: GenerateOptions = {}): GeneratedQuestion[] {
  const perLine = opts.perLine ?? 3;
  const slug = doc.meta.slug;
  const out: GeneratedQuestion[] = [];
  for (const art of doc.articles) {
    if (art.repealed || art.id.startsWith('zal')) continue;
    art.lines.forEach((ln, idx) => {
      const text = ln.text;
      if (text.length < 25 || SKIP_LINE_RE.test(text) || /[[\]<>]/.test(text)) return;
      const cands = EXTRACTORS.flatMap((f) => f(text))
        .filter((c) => c.start >= 0 && c.end <= text.length && c.end > c.start)
        .sort((a, b) => b.priority - a.priority || a.start - b.start);
      const taken: Candidate[] = [];
      for (const c of cands) {
        if (taken.length >= perLine) break;
        if (taken.some((t) => c.start < t.end && t.start < c.end)) continue;
        taken.push(c);
      }
      const ctx = lineContext(art, idx);
      for (const c of taken) {
        const key = `${slug}|${art.id}|${idx}|${c.start}|${c.answer}|${text.length}`;
        const id = hashId(key);
        const rand = rng(seedOf(key));
        const distractors = c.distractors(rand, text).filter((d) => d && d.toLowerCase() !== c.answer.toLowerCase());
        const uniq = [...new Set(distractors)].slice(0, 2);
        if (uniq.length < 2) continue;
        const correct = Math.floor(rand() * 3) as 0 | 1 | 2;
        const options = [...uniq];
        options.splice(correct, 0, c.answer);
        out.push({
          id: `${slug}-${id}`,
          act: slug,
          artId: art.id,
          artNum: art.num,
          line: idx,
          kind: c.kind,
          before: ctx + text.slice(0, c.start),
          after: text.slice(c.end),
          options: options as [string, string, string],
          correct,
          mark: ln.mark,
        });
      }
    });
  }
  return out;
}

export const KIND_LABELS: Record<QuestionKind, string> = {
  termin: 'Terminy',
  liczba: 'Liczby',
  kwota: 'Kwoty',
  ulamek: 'Ułamki i progi',
  sad: 'Właściwość sądu',
  organ: 'Organy',
  wiekszosc: 'Większość głosów',
  sankcja: 'Sankcje',
  skutek: 'Skutki prawne',
  tryb: 'Forma i tryb',
};
