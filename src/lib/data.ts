import { useCallback, useEffect, useState } from 'react';
import type { ActDoc, ActIndexEntry } from './eli/types';
import { idbGet } from './storage/idb';
import type { QuestionKind } from './questions/generator';

export const BASE = import.meta.env.BASE_URL;

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`Błąd ${res.status} podczas wczytywania ${path}`);
      return (await res.json()) as T;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export interface ExamQuestion {
  n: number;
  q: string;
  a: string[];
  correct: 'A' | 'B' | 'C' | 'D' | null;
  keyVerified: boolean;
  basis: string;
  refs: { act: string; art: string }[];
  cancelled?: boolean;
}

export interface ExamDoc {
  id: string;
  year: number;
  kind: 'ogolna' | 'sedziowska-prokuratorska' | 'uzupelniajaca';
  label: string;
  durationMin: number;
  /** Liczba odpowiedzi w pytaniu (do 2017 r. – 4, od 2018 r. – 3). */
  options?: number;
  source: { page: string; test: string; key: string };
  questions: ExamQuestion[];
}

export interface ExamIndexEntry {
  id: string;
  year: number;
  kind: ExamDoc['kind'];
  label: string;
  count: number;
  withKey: number;
  verified: number;
}

export interface CasusPart {
  title: string;
  area: string | null;
  paragraphs: string[];
}

export interface CasusDoc {
  id: string;
  year: number;
  kind: string;
  label: string;
  durationMin: number;
  tasks: CasusPart[];
  criteria: { source: string; parts: CasusPart[] }[];
  source: { page: string; tasks: string };
}

export interface CasusIndexEntry {
  id: string;
  year: number;
  kind: string;
  label: string;
  tasks: string[];
  hasCriteria: boolean;
}

export interface QuestionStats {
  generatedAt: string;
  total: number;
  perAct: Record<string, { total: number; kinds: Partial<Record<QuestionKind, number>> }>;
}

export const loadActIndex = () => loadJson<ActIndexEntry[]>('data/acts/index.json');
export const loadExamIndex = () => loadJson<ExamIndexEntry[]>('data/exams/index.json');
export const loadExam = (id: string) => loadJson<ExamDoc>(`data/exams/${id}.json`);
export const loadCasusIndex = () => loadJson<CasusIndexEntry[]>('data/casus/index.json');
export const loadCasus = (id: string) => loadJson<CasusDoc>(`data/casus/${id}.json`);
export const loadQuestionStats = () => loadJson<QuestionStats>('data/questions/stats.json');
export const loadDataUpdated = () => loadJson<{ updatedAt: string }>('data/acts/updated.json');

/** Ustawa: wersja zaktualizowana w przeglądarce (IndexedDB), jeśli jest nowsza od wersji z serwera. */
export async function loadAct(slug: string): Promise<ActDoc> {
  const [local, remote] = await Promise.all([
    idbGet<ActDoc>(`act:${slug}`),
    loadJson<ActDoc>(`data/acts/${slug}.json`).catch((e: unknown) => {
      if (!local) throw e;
      return null;
    }),
  ]);
  if (local && (!remote || (local.meta.changeDate ?? '') > (remote.meta.changeDate ?? '') || (local.meta.textDate ?? '') > (remote.meta.textDate ?? ''))) {
    return { ...local, meta: { ...local.meta, local: true } };
  }
  if (!remote) throw new Error(`Brak tekstu: ${slug}`);
  return remote;
}

export function invalidateAct(slug: string) {
  cache.delete(`${BASE}data/acts/${slug}.json`);
}

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: undefined, loading: true });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, error: undefined, loading: true }));
    fn().then(
      (data) => alive && setState({ data, error: undefined, loading: false }),
      (error: unknown) => alive && setState({ data: undefined, error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload };
}
