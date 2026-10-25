/** Rodzaj jednostki redakcyjnej wyższego rzędu (spis treści aktu). */
export type TocKind = 'part' | 'book' | 'title' | 'section' | 'chapter' | 'subchapter' | 'annex' | 'other';

export interface TocNode {
  id: string;
  kind: TocKind;
  /** Np. „Tytuł VI”, „Rozdział 2a”. */
  label: string;
  /** Np. „Czyny niedozwolone”. */
  title: string;
  children: TocNode[];
  /** Identyfikator pierwszego artykułu w tej jednostce. */
  firstArt?: string;
}

/** Jedna jednostka tekstu artykułu: paragraf, ustęp, punkt, litera, tiret. */
export interface ActLine {
  /** Poziom wcięcia: 0 – paragraf/ustęp, 1 – punkt, 2 – litera, 3 – tiret, 4 – podwójne tiret. */
  lvl: 0 | 1 | 2 | 3 | 4;
  /** Oznaczenie jednostki, np. „§ 1.”, „2.”, „3)”, „a)”, „–”. */
  mark?: string;
  text: string;
}

export interface ActArticle {
  /** Stabilny identyfikator kotwicy, np. „a415”, „a417_1”. */
  id: string;
  /** Numer w zapisie urzędowym, np. „417¹”, „4–6”. */
  num: string;
  /** Tytuł artykułu (traktaty, EKPCz). */
  title?: string;
  tocId?: string;
  lines: ActLine[];
  /** Adnotacje Kancelarii Sejmu o przyszłych zmianach („Nowe brzmienie … wejdzie w życie …”). */
  notes?: string[];
  repealed?: boolean;
}

export type ActTextType = 'U' | 'T' | 'O' | 'EU';

export interface ActMeta {
  slug: string;
  /** Adres ELI aktu pierwotnego, np. „DU/1964/93”. */
  eli: string;
  title: string;
  short: string;
  abbr: string;
  /** Data ostatniej zmiany metadanych w API Sejmu (changeDate). */
  changeDate: string;
  /** Data stanu prawnego z nagłówka tekstu ujednoliconego. */
  textDate?: string;
  textType: ActTextType;
  /** „Opracowano na podstawie: …” */
  basedOn?: string;
  sourceUrl: string;
  fetchedAt: string;
  status?: string;
  /** Najnowszy tekst jednolity (np. „DU/2026/795”). */
  latestTj?: string;
  /** Akty zmieniające opublikowane po tekście jednolitym. */
  pendingChanges?: { eli: string; title: string; entryIntoForce?: string }[];
  /** Wersja pobrana z Sejmu w przeglądarce i zapisana na urządzeniu. */
  local?: boolean;
}

export interface ActDoc {
  meta: ActMeta;
  toc: TocNode[];
  articles: ActArticle[];
}

/** Pozycja w indeksie ustaw (public/data/acts/index.json). */
export interface ActIndexEntry {
  slug: string;
  eli: string;
  title: string;
  short: string;
  abbr: string;
  group: ActGroup;
  changeDate: string;
  textDate?: string;
  articles: number;
  bytes: number;
  wykazNo?: number;
}

export type ActGroup =
  | 'ustroj'
  | 'cywilne'
  | 'pracy'
  | 'gospodarcze'
  | 'karne'
  | 'administracyjne'
  | 'ue';
