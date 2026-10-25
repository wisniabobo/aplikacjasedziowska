import type { ActGroup } from '../lib/eli/types';

export type ActSource =
  | { kind: 'eli'; eli: string }
  | { kind: 'eu'; celex: 'TUE' | 'TFUE'; resource: string }
  | { kind: 'pdf'; url: string; eli?: string };

export interface ActDef {
  slug: string;
  short: string;
  abbr: string;
  title: string;
  group: ActGroup;
  source: ActSource;
  /** Pozycja w wykazie aktów prawnych KSSiP na 2026 r. (Komunikat nr 28/2026). */
  wykazNo?: number;
}

/**
 * Wykaz aktów prawnych objętych zakresem testu w konkursie na aplikację sędziowską
 * i aplikację prokuratorską w 2026 r. (załącznik do Komunikatu nr 28/2026 Dyrektora KSSiP
 * z 11 sierpnia 2026 r.) + akty regulujące sam nabór.
 */
export const ACTS: ActDef[] = [
  { slug: 'konstytucja', short: 'Konstytucja RP', abbr: 'Konstytucja', title: 'Konstytucja Rzeczypospolitej Polskiej z dnia 2 kwietnia 1997 r.', group: 'ustroj', source: { kind: 'eli', eli: 'DU/1997/483' }, wykazNo: 1 },
  { slug: 'rpo', short: 'Ustawa o RPO', abbr: 'u.RPO', title: 'Ustawa z dnia 15 lipca 1987 r. o Rzeczniku Praw Obywatelskich', group: 'ustroj', source: { kind: 'eli', eli: 'DU/1987/123' }, wykazNo: 2 },
  { slug: 'rpd', short: 'Ustawa o RPD', abbr: 'u.RPD', title: 'Ustawa z dnia 6 stycznia 2000 r. o Rzeczniku Praw Dziecka', group: 'ustroj', source: { kind: 'eli', eli: 'DU/2000/69' }, wykazNo: 3 },
  { slug: 'sn', short: 'Ustawa o Sądzie Najwyższym', abbr: 'u.SN', title: 'Ustawa z dnia 8 grudnia 2017 r. o Sądzie Najwyższym', group: 'ustroj', source: { kind: 'eli', eli: 'DU/2018/5' }, wykazNo: 4 },
  { slug: 'usp', short: 'Prawo o ustroju sądów powszechnych', abbr: 'u.s.p.', title: 'Ustawa z dnia 27 lipca 2001 r. – Prawo o ustroju sądów powszechnych', group: 'ustroj', source: { kind: 'eli', eli: 'DU/2001/1070' }, wykazNo: 5 },
  { slug: 'prok', short: 'Prawo o prokuraturze', abbr: 'p.o.p.', title: 'Ustawa z dnia 28 stycznia 2016 r. – Prawo o prokuraturze', group: 'ustroj', source: { kind: 'eli', eli: 'DU/2016/177' }, wykazNo: 6 },
  { slug: 'kc', short: 'Kodeks cywilny', abbr: 'k.c.', title: 'Ustawa z dnia 23 kwietnia 1964 r. – Kodeks cywilny', group: 'cywilne', source: { kind: 'eli', eli: 'DU/1964/93' }, wykazNo: 7 },
  { slug: 'kpc', short: 'Kodeks postępowania cywilnego', abbr: 'k.p.c.', title: 'Ustawa z dnia 17 listopada 1964 r. – Kodeks postępowania cywilnego', group: 'cywilne', source: { kind: 'eli', eli: 'DU/1964/296' }, wykazNo: 8 },
  { slug: 'ukwh', short: 'Ustawa o księgach wieczystych i hipotece', abbr: 'u.k.w.h.', title: 'Ustawa z dnia 6 lipca 1982 r. o księgach wieczystych i hipotece', group: 'cywilne', source: { kind: 'eli', eli: 'DU/1982/147' }, wykazNo: 9 },
  { slug: 'uksc', short: 'Ustawa o kosztach sądowych w sprawach cywilnych', abbr: 'u.k.s.c.', title: 'Ustawa z dnia 28 lipca 2005 r. o kosztach sądowych w sprawach cywilnych', group: 'cywilne', source: { kind: 'eli', eli: 'DU/2005/1398' }, wykazNo: 10 },
  { slug: 'kro', short: 'Kodeks rodzinny i opiekuńczy', abbr: 'k.r.o.', title: 'Ustawa z dnia 25 lutego 1964 r. – Kodeks rodzinny i opiekuńczy', group: 'cywilne', source: { kind: 'eli', eli: 'DU/1964/59' }, wykazNo: 11 },
  { slug: 'kp', short: 'Kodeks pracy', abbr: 'k.p.', title: 'Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy', group: 'pracy', source: { kind: 'eli', eli: 'DU/1974/141' }, wykazNo: 12 },
  { slug: 'zwolnienia-grupowe', short: 'Ustawa o zwolnieniach grupowych', abbr: 'u.z.g.', title: 'Ustawa z dnia 13 marca 2003 r. o szczególnych zasadach rozwiązywania z pracownikami stosunków pracy z przyczyn niedotyczących pracowników', group: 'pracy', source: { kind: 'eli', eli: 'DU/2003/844' }, wykazNo: 13 },
  { slug: 'ksh', short: 'Kodeks spółek handlowych', abbr: 'k.s.h.', title: 'Ustawa z dnia 15 września 2000 r. – Kodeks spółek handlowych', group: 'gospodarcze', source: { kind: 'eli', eli: 'DU/2000/1037' }, wykazNo: 14 },
  { slug: 'krs', short: 'Ustawa o Krajowym Rejestrze Sądowym', abbr: 'u.KRS', title: 'Ustawa z dnia 20 sierpnia 1997 r. o Krajowym Rejestrze Sądowym', group: 'gospodarcze', source: { kind: 'eli', eli: 'DU/1997/769' }, wykazNo: 15 },
  { slug: 'kk', short: 'Kodeks karny', abbr: 'k.k.', title: 'Ustawa z dnia 6 czerwca 1997 r. – Kodeks karny', group: 'karne', source: { kind: 'eli', eli: 'DU/1997/553' }, wykazNo: 16 },
  { slug: 'kpk', short: 'Kodeks postępowania karnego', abbr: 'k.p.k.', title: 'Ustawa z dnia 6 czerwca 1997 r. – Kodeks postępowania karnego', group: 'karne', source: { kind: 'eli', eli: 'DU/1997/555' }, wykazNo: 17 },
  { slug: 'kw', short: 'Kodeks wykroczeń', abbr: 'k.w.', title: 'Ustawa z dnia 20 maja 1971 r. – Kodeks wykroczeń', group: 'karne', source: { kind: 'eli', eli: 'DU/1971/114' }, wykazNo: 18 },
  { slug: 'kpsw', short: 'Kodeks postępowania w sprawach o wykroczenia', abbr: 'k.p.s.w.', title: 'Ustawa z dnia 24 sierpnia 2001 r. – Kodeks postępowania w sprawach o wykroczenia', group: 'karne', source: { kind: 'eli', eli: 'DU/2001/1148' }, wykazNo: 19 },
  { slug: 'kks', short: 'Kodeks karny skarbowy', abbr: 'k.k.s.', title: 'Ustawa z dnia 10 września 1999 r. – Kodeks karny skarbowy', group: 'karne', source: { kind: 'eli', eli: 'DU/1999/930' }, wykazNo: 20 },
  { slug: 'przewleklosc', short: 'Ustawa o skardze na przewlekłość', abbr: 'u.s.p.p.', title: 'Ustawa z dnia 17 czerwca 2004 r. o skardze na naruszenie prawa strony do rozpoznania sprawy w postępowaniu przygotowawczym prowadzonym lub nadzorowanym przez prokuratora i postępowaniu sądowym bez nieuzasadnionej zwłoki', group: 'karne', source: { kind: 'eli', eli: 'DU/2004/1843' }, wykazNo: 21 },
  { slug: 'ochrona-zwierzat', short: 'Ustawa o ochronie zwierząt', abbr: 'u.o.z.', title: 'Ustawa z dnia 21 sierpnia 1997 r. o ochronie zwierząt', group: 'karne', source: { kind: 'eli', eli: 'DU/1997/724' }, wykazNo: 22 },
  { slug: 'kpa', short: 'Kodeks postępowania administracyjnego', abbr: 'k.p.a.', title: 'Ustawa z dnia 14 czerwca 1960 r. – Kodeks postępowania administracyjnego', group: 'administracyjne', source: { kind: 'eli', eli: 'DU/1960/168' }, wykazNo: 23 },
  { slug: 'ppsa', short: 'Prawo o postępowaniu przed sądami administracyjnymi', abbr: 'p.p.s.a.', title: 'Ustawa z dnia 30 sierpnia 2002 r. – Prawo o postępowaniu przed sądami administracyjnymi', group: 'administracyjne', source: { kind: 'eli', eli: 'DU/2002/1270' }, wykazNo: 24 },
  { slug: 'usg', short: 'Ustawa o samorządzie gminnym', abbr: 'u.s.g.', title: 'Ustawa z dnia 8 marca 1990 r. o samorządzie gminnym', group: 'administracyjne', source: { kind: 'eli', eli: 'DU/1990/95' }, wykazNo: 25 },
  { slug: 'tue', short: 'Traktat o Unii Europejskiej', abbr: 'TUE', title: 'Traktat o Unii Europejskiej (wersja skonsolidowana)', group: 'ue', source: { kind: 'eu', celex: 'TUE', resource: 'https://publications.europa.eu/resource/oj/JOC_2016_202_R_0001' }, wykazNo: 26 },
  { slug: 'tfue', short: 'Traktat o funkcjonowaniu UE', abbr: 'TFUE', title: 'Traktat o funkcjonowaniu Unii Europejskiej (wersja skonsolidowana)', group: 'ue', source: { kind: 'eu', celex: 'TFUE', resource: 'https://publications.europa.eu/resource/oj/JOC_2016_202_R_0001' }, wykazNo: 27 },
  { slug: 'ekpc', short: 'Europejska Konwencja Praw Człowieka', abbr: 'EKPCz', title: 'Konwencja o Ochronie Praw Człowieka i Podstawowych Wolności sporządzona w Rzymie dnia 4 listopada 1950 r.', group: 'ue', source: { kind: 'pdf', url: 'https://www.echr.coe.int/documents/d/echr/convention_pol', eli: 'DU/1993/284' }, wykazNo: 28 },
  { slug: 'kssip', short: 'Ustawa o KSSiP', abbr: 'u.KSSiP', title: 'Ustawa z dnia 23 stycznia 2009 r. o Krajowej Szkole Sądownictwa i Prokuratury', group: 'ustroj', source: { kind: 'eli', eli: 'DU/2009/157' } },
];

export const ACT_BY_SLUG: Record<string, ActDef> = Object.fromEntries(ACTS.map((a) => [a.slug, a]));

export const GROUP_LABELS: Record<ActGroup, string> = {
  ustroj: 'Ustrój i prawo konstytucyjne',
  cywilne: 'Prawo cywilne i postępowanie cywilne',
  pracy: 'Prawo pracy',
  gospodarcze: 'Prawo gospodarcze',
  karne: 'Prawo karne i wykroczeń',
  administracyjne: 'Prawo administracyjne',
  ue: 'Prawo UE i prawa człowieka',
};
