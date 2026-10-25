/**
 * Postępy nauki zapisywane lokalnie (localStorage): system powtórek Leitnera, dzienny cel,
 * historia egzaminów próbnych, zakładki w ustawach i robocze odpowiedzi do kazusów.
 */
import { useSyncExternalStore } from 'react';

export interface CardState {
  /** Pudełko Leitnera 0–5. */
  b: number;
  /** Termin kolejnej powtórki (ms). */
  d: number;
  c: number;
  w: number;
  l: number;
}

export interface ExamAttempt {
  id: string;
  kind: 'official' | 'simulation';
  examId?: string;
  label: string;
  date: number;
  score: number;
  total: number;
  durationSec: number;
  byArea: Record<string, { ok: number; total: number }>;
}

export interface Settings {
  dailyGoal: number;
  sessionSize: number;
  includeUnverified: boolean;
}

export interface ProgressState {
  v: 1;
  cards: Record<string, CardState>;
  daily: Record<string, { a: number; c: number }>;
  exams: ExamAttempt[];
  bookmarks: string[];
  casus: Record<string, string>;
  settings: Settings;
}

const KEY = 'aplikacjasedziowska:progress:v1';
const DAY = 86_400_000;
export const INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];

const initial = (): ProgressState => ({
  v: 1,
  cards: {},
  daily: {},
  exams: [],
  bookmarks: [],
  casus: {},
  settings: { dailyGoal: 50, sessionSize: 20, includeUnverified: false },
});

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    return { ...initial(), ...parsed, settings: { ...initial().settings, ...(parsed.settings ?? {}) } };
  } catch {
    return initial();
  }
}

let state: ProgressState = typeof window === 'undefined' ? initial() : load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function emit() {
  for (const l of listeners) l();
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* brak miejsca lub tryb prywatny – postęp zostaje w pamięci */
    }
  }, 250);
}

function update(fn: (s: ProgressState) => ProgressState) {
  state = fn(state);
  emit();
}

export function getProgress(): ProgressState {
  return state;
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

export const todayKey = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Zapisuje odpowiedź i przesuwa kartę w systemie Leitnera. */
export function recordAnswer(id: string, correct: boolean, now = Date.now()) {
  update((s) => {
    const prev = s.cards[id] ?? { b: 0, d: 0, c: 0, w: 0, l: 0 };
    const b = correct ? Math.min(5, prev.b + 1) : 0;
    const d = correct ? now + INTERVALS_DAYS[b]! * DAY : now + 10 * 60_000;
    const day = todayKey(new Date(now));
    const dd = s.daily[day] ?? { a: 0, c: 0 };
    return {
      ...s,
      cards: { ...s.cards, [id]: { b, d, c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), l: now } },
      daily: { ...s.daily, [day]: { a: dd.a + 1, c: dd.c + (correct ? 1 : 0) } },
    };
  });
}

export function addExamAttempt(a: ExamAttempt) {
  update((s) => ({ ...s, exams: [a, ...s.exams].slice(0, 200) }));
}

export function toggleBookmark(key: string) {
  update((s) => ({ ...s, bookmarks: s.bookmarks.includes(key) ? s.bookmarks.filter((b) => b !== key) : [key, ...s.bookmarks] }));
}

export function saveCasusAnswer(key: string, text: string) {
  update((s) => ({ ...s, casus: { ...s.casus, [key]: text } }));
}

export function updateSettings(patch: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function resetProgress() {
  update(() => initial());
}

export function importProgress(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as ProgressState;
    if (parsed.v !== 1 || typeof parsed.cards !== 'object') return false;
    update(() => ({ ...initial(), ...parsed }));
    return true;
  } catch {
    return false;
  }
}

/** Liczba dni z rzędu, w których odpowiedziano na co najmniej jedno pytanie. */
export function streak(s: ProgressState, now = new Date()): number {
  let n = 0;
  const d = new Date(now);
  if (!s.daily[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (s.daily[todayKey(d)]?.a) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function dueIds(s: ProgressState, now = Date.now()): string[] {
  return Object.entries(s.cards)
    .filter(([, c]) => c.d <= now)
    .sort((a, b) => a[1].d - b[1].d)
    .map(([id]) => id);
}
