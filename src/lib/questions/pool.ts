/** Wspólna pula pytań: oficjalne testy KSSiP + pytania generowane z aktualnych ustaw. */
import { ACT_BY_SLUG } from '../../data/acts';
import { AREAS, AREA_OF_ACT, areaOfQuestion, type AreaId } from '../../data/exam';
import { loadAct, loadExam, loadExamIndex, type ExamDoc } from '../data';
import { generateQuestions, rng, type GeneratedQuestion, type QuestionKind } from './generator';
import type { ProgressState } from '../storage/progress';

export interface UIQuestion {
  id: string;
  source: 'generated' | 'official';
  area: AreaId | null;
  act?: string;
  artId?: string;
  artNum?: string;
  line?: number;
  /** Pytanie oficjalne: treść; pytanie generowane: fragment przed i po luce. */
  text?: string;
  before?: string;
  after?: string;
  options: string[];
  correct: number;
  label: string;
  kind?: QuestionKind;
  year?: number;
  basis?: string;
  refs?: { act: string; art: string }[];
  verified: boolean;
  examId?: string;
  n?: number;
}

const genCache = new Map<string, Promise<UIQuestion[]>>();

export function fromGenerated(q: GeneratedQuestion): UIQuestion {
  const def = ACT_BY_SLUG[q.act];
  return {
    id: q.id,
    source: 'generated',
    area: AREA_OF_ACT[q.act] ?? null,
    act: q.act,
    artId: q.artId,
    artNum: q.artNum,
    line: q.line,
    before: q.before,
    after: q.after,
    options: q.options,
    correct: q.correct,
    label: `${def?.abbr ?? q.act} art. ${q.artNum}${q.mark ? ` ${q.mark.replace(/\.$/, '')}` : ''}`,
    kind: q.kind,
    verified: true,
  };
}

export function generatedFor(slug: string): Promise<UIQuestion[]> {
  let p = genCache.get(slug);
  if (!p) {
    p = loadAct(slug).then((doc) => generateQuestions(doc).map(fromGenerated));
    p.catch(() => genCache.delete(slug));
    genCache.set(slug, p);
  }
  return p;
}

export function clearGeneratedCache(slug?: string) {
  if (slug) genCache.delete(slug);
  else genCache.clear();
}

export function fromOfficial(exam: ExamDoc, q: ExamDoc['questions'][number]): UIQuestion | null {
  if (!q.correct || q.a.some((a) => !a) || !q.q) return null;
  const correct = 'ABCD'.indexOf(q.correct);
  if (correct < 0 || correct >= q.a.length) return null;
  const first = q.refs[0];
  return {
    id: `o:${exam.id}:${q.n}`,
    source: 'official',
    area: areaOfQuestion(q.q, q.refs),
    act: first?.act,
    text: q.q,
    options: q.a,
    correct,
    label: `KSSiP ${exam.year}${exam.kind === 'uzupelniajaca' ? ' (uzup.)' : exam.kind === 'ogolna' ? ' (ogólna)' : ''} · pyt. ${q.n}`,
    year: exam.year,
    basis: q.basis,
    refs: q.refs,
    verified: q.keyVerified,
    examId: exam.id,
    n: q.n,
  };
}

let officialCache: Promise<UIQuestion[]> | null = null;

export function officialAll(): Promise<UIQuestion[]> {
  officialCache ??= loadExamIndex()
    .then((idx) => Promise.all(idx.map((e) => loadExam(e.id))))
    .then((exams) => exams.flatMap((ex) => ex.questions.map((q) => fromOfficial(ex, q)).filter((x): x is UIQuestion => x !== null)));
  officialCache.catch(() => {
    officialCache = null;
  });
  return officialCache;
}

export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const r = rng(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export type SessionMode = 'mix' | 'act' | 'area' | 'kind' | 'review' | 'wrong' | 'official' | 'new';

export interface SessionSpec {
  mode: SessionMode;
  act?: string;
  area?: AreaId;
  kind?: QuestionKind;
  size: number;
  includeUnverified?: boolean;
}

/** Rozwiązuje identyfikatory zapisanych kart na pytania (powtórki). */
export async function resolveIds(ids: string[]): Promise<UIQuestion[]> {
  const acts = new Set<string>();
  let needOfficial = false;
  for (const id of ids) {
    if (id.startsWith('o:')) needOfficial = true;
    else acts.add(id.slice(0, id.lastIndexOf('-')));
  }
  const pools = await Promise.all([...acts].filter((a) => ACT_BY_SLUG[a]).map((a) => generatedFor(a).catch(() => [] as UIQuestion[])));
  const off = needOfficial ? await officialAll() : [];
  const map = new Map<string, UIQuestion>();
  for (const q of [...pools.flat(), ...off]) map.set(q.id, q);
  return ids.map((id) => map.get(id)).filter((q): q is UIQuestion => q !== undefined);
}

export async function buildSession(spec: SessionSpec, progress: ProgressState): Promise<UIQuestion[]> {
  const seed = Date.now();
  const size = spec.size;
  const okVerified = (q: UIQuestion) => spec.includeUnverified || q.verified;
  switch (spec.mode) {
    case 'act': {
      const all = await generatedFor(spec.act!);
      const official = (await officialAll()).filter((q) => q.act === spec.act && okVerified(q));
      return prioritize(shuffle([...all, ...official], seed), progress).slice(0, size);
    }
    case 'kind': {
      const acts = AREAS.flatMap((a) => a.acts);
      const picked = shuffle(acts, seed).slice(0, 8);
      const pools = await Promise.all(picked.map((a) => generatedFor(a).catch(() => [])));
      return prioritize(shuffle(pools.flat().filter((q) => q.kind === spec.kind), seed), progress).slice(0, size);
    }
    case 'area': {
      const area = AREAS.find((a) => a.id === spec.area)!;
      const pools = await Promise.all(area.acts.map((a) => generatedFor(a).catch(() => [])));
      const official = (await officialAll()).filter((q) => q.area === area.id && okVerified(q));
      return prioritize(shuffle([...pools.flat(), ...official], seed), progress).slice(0, size);
    }
    case 'official': {
      const all = (await officialAll()).filter(okVerified);
      return prioritize(shuffle(all, seed), progress).slice(0, size);
    }
    case 'review': {
      const now = Date.now();
      const ids = Object.entries(progress.cards)
        .filter(([, c]) => c.d <= now)
        .sort((a, b) => a[1].d - b[1].d)
        .map(([id]) => id)
        .slice(0, size * 2);
      return (await resolveIds(ids)).slice(0, size);
    }
    case 'wrong': {
      const ids = Object.entries(progress.cards)
        .filter(([, c]) => c.w > 0 && c.b < 3)
        .sort((a, b) => b[1].w - a[1].w)
        .map(([id]) => id)
        .slice(0, size * 2);
      return (await resolveIds(ids)).slice(0, size);
    }
    default: {
      // mieszanka: proporcje dziedzin jak w teście, połowa pytań oficjalnych
      const official = (await officialAll()).filter(okVerified);
      const out: UIQuestion[] = [];
      const r = rng(seed);
      for (const area of AREAS) {
        const want = Math.max(1, Math.round((area.simTarget / 150) * size));
        const act = area.acts[Math.floor(r() * area.acts.length)]!;
        const gen = await generatedFor(act).catch(() => [] as UIQuestion[]);
        const off = official.filter((q) => q.area === area.id);
        const pool = prioritize(shuffle([...shuffle(gen, seed).slice(0, want * 3), ...shuffle(off, seed + 1).slice(0, want * 3)], seed + 2), progress);
        out.push(...pool.slice(0, want));
      }
      return shuffle(out, seed + 3).slice(0, size);
    }
  }
}

/** Najpierw nowe i zaległe, na końcu dobrze opanowane. */
function prioritize(qs: UIQuestion[], progress: ProgressState): UIQuestion[] {
  const now = Date.now();
  const score = (q: UIQuestion) => {
    const c = progress.cards[q.id];
    if (!c) return 1;
    if (c.d <= now) return 0;
    return 2 + c.b;
  };
  return qs.map((q, i) => ({ q, s: score(q), i })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.q);
}

/** Symulacja egzaminu: 150 pytań w proporcjach dziedzin (≥120 z dziedzin 2–8). */
export async function buildSimulation(opts: { officialShare: number; includeUnverified: boolean }): Promise<UIQuestion[]> {
  const seed = Date.now();
  const official = (await officialAll()).filter((q) => opts.includeUnverified || q.verified);
  const out: UIQuestion[] = [];
  for (const area of AREAS) {
    const want = area.simTarget;
    const wantOfficial = Math.round(want * opts.officialShare);
    const off = shuffle(official.filter((q) => q.area === area.id), seed + area.no).slice(0, wantOfficial);
    const pools = await Promise.all(area.acts.map((a) => generatedFor(a).catch(() => [] as UIQuestion[])));
    const gen = shuffle(pools.flat(), seed + 100 + area.no).slice(0, want - off.length);
    out.push(...shuffle([...off, ...gen], seed + 200 + area.no));
  }
  return out;
}
