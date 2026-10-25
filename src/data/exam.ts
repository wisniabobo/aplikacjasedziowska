/**
 * Informacje o naborze na aplikację sędziowską – wyłącznie z oficjalnych źródeł
 * (ustawa o KSSiP, rozporządzenie MS z 12.03.2018 r., zarządzenie MS z 29.05.2026 r., komunikaty Dyrektora KSSiP).
 */

export const NABOR_2026 = {
  year: 2026,
  stage1: '2026-10-29',
  stage2: '2026-11-18',
  registration: { from: '2026-09-03T13:00', to: '2026-09-24T13:00' },
  docsDeadline: '2026-10-15',
  withdrawalDeadline: '2026-10-08',
  fee: 2403,
  limits: { sedziowska: 210, prokuratorska: 150 },
  sources: [
    { label: 'Zarządzenie Ministra Sprawiedliwości z 29 maja 2026 r. (Dz. Urz. MS poz. 134) – limity 210 + 150', url: 'https://www.kssip.gov.pl/sites/default/files/poz_134-e.pdf' },
    { label: 'Komunikat nr 19/2026 Dyrektora KSSiP – ogłoszenie naboru', url: 'https://www.kssip.gov.pl/node/10345' },
    { label: 'Komunikat nr 28/2026 – wykaz aktów prawnych objętych testem', url: 'https://www.kssip.gov.pl/node/10406' },
    { label: 'Strona naboru 2026 w KSSiP', url: 'https://www.kssip.gov.pl/node/10337' },
    { label: 'Internetowa Rejestracja Kandydatów (IRK)', url: 'https://irk.kssip.gov.pl/pl/' },
  ],
};

export type AreaId =
  | 'ustroj'
  | 'cywilne'
  | 'kpc'
  | 'pracy'
  | 'gospodarcze'
  | 'karne'
  | 'kpk'
  | 'administracyjne'
  | 'miedzynarodowe'
  | 'ue';

/** Dziedziny z § 4 ust. 1 rozporządzenia MS w sprawie przeprowadzania naboru. */
export const AREAS: { id: AreaId; no: number; label: string; acts: string[]; simTarget: number }[] = [
  { id: 'ustroj', no: 1, label: 'Prawo konstytucyjne, ustrój sądów, prokuratury, organów kontroli i ochrony prawa', acts: ['konstytucja', 'rpo', 'rpd', 'sn', 'usp', 'prok', 'kssip'], simTarget: 15 },
  { id: 'cywilne', no: 2, label: 'Prawo cywilne materialne z prawem rodzinnym i opiekuńczym', acts: ['kc', 'kro', 'ukwh'], simTarget: 22 },
  { id: 'kpc', no: 3, label: 'Postępowanie cywilne', acts: ['kpc', 'uksc'], simTarget: 20 },
  { id: 'pracy', no: 4, label: 'Prawo pracy', acts: ['kp', 'zwolnienia-grupowe'], simTarget: 12 },
  { id: 'gospodarcze', no: 5, label: 'Prawo gospodarcze publiczne i prywatne', acts: ['ksh', 'krs'], simTarget: 12 },
  { id: 'karne', no: 6, label: 'Prawo karne materialne z materialnym prawem wykroczeń', acts: ['kk', 'kw', 'kks', 'ochrona-zwierzat'], simTarget: 20 },
  { id: 'kpk', no: 7, label: 'Postępowanie karne i w sprawach o wykroczenia', acts: ['kpk', 'kpsw', 'przewleklosc'], simTarget: 20 },
  { id: 'administracyjne', no: 8, label: 'Prawo administracyjne, postępowanie administracyjne i sądowoadministracyjne', acts: ['kpa', 'ppsa', 'usg'], simTarget: 17 },
  { id: 'miedzynarodowe', no: 9, label: 'Prawo międzynarodowe publiczne – prawo traktatów i ochrona praw człowieka', acts: ['ekpc'], simTarget: 6 },
  { id: 'ue', no: 10, label: 'Ustrój Unii Europejskiej i organy ochrony prawnej UE', acts: ['tue', 'tfue'], simTarget: 6 },
];

export const AREA_OF_ACT: Record<string, AreaId> = Object.fromEntries(AREAS.flatMap((a) => a.acts.map((s) => [s, a.id])));
export const AREA_LABEL: Record<AreaId, string> = Object.fromEntries(AREAS.map((a) => [a.id, a.label])) as Record<AreaId, string>;
export const AREA_SHORT: Record<AreaId, string> = {
  ustroj: 'Ustrój',
  cywilne: 'Cywilne',
  kpc: 'Post. cywilne',
  pracy: 'Pracy',
  gospodarcze: 'Gospodarcze',
  karne: 'Karne',
  kpk: 'Post. karne',
  administracyjne: 'Administracyjne',
  miedzynarodowe: 'Międzynarodowe',
  ue: 'UE',
};

/** Rozpoznanie dziedziny pytania po treści („Zgodnie z Kodeksem…”). */
const Q_AREA: [RegExp, AreaId][] = [
  [/Kodeks(?:em|u)? postępowania cywilnego|kosztach sądowych w sprawach cywilnych/, 'kpc'],
  [/Kodeks(?:em|u)? postępowania karnego|postępowania w sprawach o wykroczenia|skardze na naruszenie prawa strony/, 'kpk'],
  [/Kodeks(?:em|u)? postępowania administracyjnego|postępowaniu przed sądami administracyjnymi|samorządzie gminnym|samorządzie powiatowym|samorządzie województwa/, 'administracyjne'],
  [/Kodeks(?:em|u)? karn|Kodeks(?:em|u)? wykroczeń|ochronie zwierząt/, 'karne'],
  [/Kodeks(?:em|u)? pracy|rozwiązywania z pracownikami/, 'pracy'],
  [/Kodeks(?:em|u)? spółek handlowych|Krajowym Rejestrze Sądowym|prawo upadłościowe|restrukturyzacyjne|przedsiębiorców/i, 'gospodarcze'],
  [/Kodeks(?:em|u)? cywiln|Kodeks(?:em|u)? rodzinn|księgach wieczystych/, 'cywilne'],
  [/Traktat|Unii Europejskiej|Trybunału Sprawiedliwości/, 'ue'],
  [/Konwencj|praw człowieka|prawie traktatów/i, 'miedzynarodowe'],
  [/Konstytucj|Trybunale Konstytucyjnym|Trybunale Stanu|Sądzie Najwyższym|ustroju sądów|prokuraturze|Rzeczniku|Krajowej Radzie|Najwyższej Izbie Kontroli/, 'ustroj'],
];

export function areaOfQuestion(text: string, refs: { act: string }[]): AreaId | null {
  const head = text.slice(0, 180);
  for (const [re, area] of Q_AREA) if (re.test(head)) return area;
  const first = refs[0]?.act;
  return first ? AREA_OF_ACT[first] ?? null : null;
}

export const STAGES = {
  test: { questions: 150, options: 3, minutes: 150, pointsPerQuestion: 1, minFromAreas2to8: 120 },
  written: { tasks: 3, minutes: 180, maxPerTask: 25 },
};
