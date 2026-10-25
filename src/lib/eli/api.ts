/** Klient API ELI Kancelarii Sejmu (https://api.sejm.gov.pl/eli). */

export const ELI_API = 'https://api.sejm.gov.pl/eli';

export interface EliRef {
  id: string;
  date?: string;
  art?: string;
}

export interface EliActMeta {
  ELI: string;
  title: string;
  status?: string;
  changeDate?: string;
  promulgation?: string;
  entryIntoForce?: string;
  announcementDate?: string;
  textHTML?: boolean;
  textPDF?: boolean;
  texts?: { fileName: string; type: string }[];
  references?: Record<string, EliRef[]>;
  inForce?: string;
}

export interface EliSearchResult {
  count: number;
  items: EliActMeta[];
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const defaultFetch: FetchFn = (input, init) => fetch(input, init);

async function getJson<T>(url: string, f: FetchFn): Promise<T> {
  const res = await f(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API Sejmu: ${res.status} dla ${url}`);
  return (await res.json()) as T;
}

export function actUrl(eli: string): string {
  return `${ELI_API}/acts/${eli}`;
}

export async function fetchActMeta(eli: string, f: FetchFn = defaultFetch): Promise<EliActMeta> {
  return getJson<EliActMeta>(actUrl(eli), f);
}

/** Adres pliku z tekstem: preferujemy tekst ujednolicony (U), potem jednolity (T), potem ogłoszony (O). */
export function bestTextFile(meta: EliActMeta): { type: 'U' | 'T' | 'O'; url: string } | null {
  const texts = meta.texts ?? [];
  for (const type of ['U', 'T', 'O'] as const) {
    const t = texts.find((x) => x.type === type);
    if (t) return { type, url: `${ELI_API}/acts/${meta.ELI}/text/${type}/${t.fileName}` };
  }
  return null;
}

export function latestConsolidatedText(meta: EliActMeta): string | undefined {
  const tj = meta.references?.['Inf. o tekście jednolitym'] ?? [];
  return tj
    .map((r) => r.id)
    .sort((a, b) => {
      const [, ya = '0', pa = '0'] = a.split('/');
      const [, yb = '0', pb = '0'] = b.split('/');
      return Number(yb) - Number(ya) || Number(pb) - Number(pa);
    })[0];
}

/** Rok i pozycja z adresu ELI. */
export function eliYearPos(eli: string): { year: number; pos: number } {
  const [, y = '0', p = '0'] = eli.split('/');
  return { year: Number(y), pos: Number(p) };
}

/**
 * Akty zmieniające opublikowane po ostatnim tekście jednolitym – kandydaci do zmian,
 * które mogą jeszcze nie wejść w życie albo nie być ujęte w tekście jednolitym.
 */
export async function fetchRecentAmendments(
  meta: EliActMeta,
  opts: { sinceYear: number; limit?: number },
  f: FetchFn = defaultFetch,
): Promise<EliActMeta[]> {
  const amending = (meta.references?.['Akty zmieniające'] ?? [])
    .map((r) => r.id)
    .filter((id) => eliYearPos(id).year >= opts.sinceYear)
    .sort((a, b) => {
      const A = eliYearPos(a);
      const B = eliYearPos(b);
      return B.year - A.year || B.pos - A.pos;
    })
    .slice(0, opts.limit ?? 12);
  const out: EliActMeta[] = [];
  for (const id of amending) {
    try {
      out.push(await fetchActMeta(id, f));
    } catch {
      // pomijamy pojedyncze błędy sieci – reszta danych jest nadal przydatna
    }
  }
  return out;
}

export async function searchActs(params: Record<string, string | number>, f: FetchFn = defaultFetch): Promise<EliSearchResult> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return getJson<EliSearchResult>(`${ELI_API}/acts/search?${qs.toString()}`, f);
}
