/**
 * Parametry płacowe i podatkowe na poszczególne lata – każdy z odnośnikiem do źródła.
 * Gdy brakuje danych na bieżący rok, aplikacja pobiera komunikat GUS z API Sejmu (Monitor Polski) – zob. liveParams.ts.
 */

export interface YearParams {
  year: number;
  /** Podstawa ustalenia wynagrodzenia zasadniczego sędziego (art. 91 § 1c u.s.p.). */
  judgeBase: number;
  judgeBaseSource: string;
  /** Czy podstawa jest prognozą (np. brak jeszcze ustawy okołobudżetowej). */
  judgeBaseForecast?: boolean;
  pit: {
    threshold: number;
    lowRate: number;
    highRate: number;
    /** Kwota zmniejszająca podatek (roczna). */
    taxReduction: number;
    kupMonthly: number;
    kupMonthlyCommuter: number;
    kupAnnualMultiMax: number;
    kupAnnualMultiMaxCommuter: number;
    /** Limit rocznych kosztów 50% (art. 22 ust. 9a). */
    authorCostLimit: number;
    childRelief: { first: number; second: number; third: number; fourthPlus: number; incomeLimitMarried: number; incomeLimitSingle: number };
    solidarityThreshold: number;
  };
  zus: {
    pension: number;
    disability: number;
    sickness: number;
    /** Roczny limit podstawy składek emerytalno-rentowych (30-krotność). */
    annualCap: number;
    capSource: string;
  };
  health: number;
  mileage: { carUpTo900: number; carOver900: number; motorcycle: number; moped: number; source: string };
  perDiem: number;
  /** Stypendium aplikanta KSSiP. */
  stipend: { first12: number; after12: number; source: string };
}

const PIT_2022_PLUS = {
  threshold: 120_000,
  lowRate: 0.12,
  highRate: 0.32,
  taxReduction: 3_600,
  kupMonthly: 250,
  kupMonthlyCommuter: 300,
  kupAnnualMultiMax: 4_500,
  kupAnnualMultiMaxCommuter: 5_400,
  authorCostLimit: 120_000,
  childRelief: { first: 1112.04, second: 1112.04, third: 2000.04, fourthPlus: 2700, incomeLimitMarried: 112_000, incomeLimitSingle: 56_000 },
  solidarityThreshold: 1_000_000,
};

const ZUS_RATES = { pension: 0.0976, disability: 0.015, sickness: 0.0245 };

const MILEAGE_2023 = {
  carUpTo900: 0.89,
  carOver900: 1.15,
  motorcycle: 0.69,
  moped: 0.42,
  source: 'Rozporządzenie Ministra Infrastruktury z 25.03.2002 r. (Dz.U. poz. 271), § 2 w brzmieniu z Dz.U. z 2023 r. poz. 5',
};

export const YEARS: Record<number, YearParams> = {
  2025: {
    year: 2025,
    judgeBase: 8038.41,
    judgeBaseSource: 'Komunikat Prezesa GUS z 9.08.2024 r. (M.P. poz. 730) – przeciętne wynagrodzenie w II kw. 2024 r.',
    pit: PIT_2022_PLUS,
    zus: { ...ZUS_RATES, annualCap: 260_190, capSource: 'Obwieszczenie MRPiPS z 10.12.2024 r. (M.P. poz. 1051)' },
    health: 0.09,
    mileage: MILEAGE_2023,
    perDiem: 45,
    stipend: { first12: 5766, after12: 6366, source: 'Rozporządzenie MS w sprawie stypendium aplikantów KSSiP, § 2 ust. 1 (od 1.07.2025 r., Dz.U. z 2025 r. poz. 1115)' },
  },
  2026: {
    year: 2026,
    judgeBase: 8748.63,
    judgeBaseSource: 'Komunikat Prezesa GUS z 8.08.2025 r. (M.P. poz. 743) – przeciętne wynagrodzenie w II kw. 2025 r.; ustawa okołobudżetowa na 2026 r. (Dz.U. z 2025 r. poz. 1840) nie zmienia podstawy',
    pit: PIT_2022_PLUS,
    zus: { ...ZUS_RATES, annualCap: 282_600, capSource: 'Obwieszczenie MRPiPS z 19.11.2025 r. (M.P. poz. 1206)' },
    health: 0.09,
    mileage: MILEAGE_2023,
    perDiem: 45,
    stipend: { first12: 5766, after12: 6366, source: 'Rozporządzenie MS w sprawie stypendium aplikantów KSSiP (t.j. Dz.U. z 2026 r. poz. 594), § 2 ust. 1' },
  },
  2027: {
    year: 2027,
    judgeBase: 9233.13,
    judgeBaseSource: 'Komunikat Prezesa GUS z 10.08.2026 r. (M.P. poz. 779) – przeciętne wynagrodzenie w II kw. 2026 r.',
    judgeBaseForecast: true,
    pit: PIT_2022_PLUS,
    zus: { ...ZUS_RATES, annualCap: 282_600, capSource: 'Prognoza: limit z 2026 r. (obwieszczenie na 2027 r. jeszcze nie opublikowane)' },
    health: 0.09,
    mileage: MILEAGE_2023,
    perDiem: 45,
    stipend: { first12: 5766, after12: 6366, source: 'Stawki z 2026 r. (brak zmian na 2027 r. w chwili publikacji)' },
  },
};

export const LATEST_KNOWN_YEAR = Math.max(...Object.keys(YEARS).map(Number));

/** Parametry na rok; dla lat spoza tabeli bierzemy najbliższy znany rok i oznaczamy jako prognozę. */
export function paramsFor(year: number, overrides?: Partial<Pick<YearParams, 'judgeBase' | 'judgeBaseSource'>>): YearParams {
  const known = YEARS[year];
  const base: YearParams = known
    ? known
    : { ...YEARS[Math.min(Math.max(year, 2025), LATEST_KNOWN_YEAR)]!, year, judgeBaseForecast: true };
  return overrides ? { ...base, ...overrides, judgeBaseForecast: overrides.judgeBase ? false : base.judgeBaseForecast } : base;
}

/** Mnożniki z załącznika do u.s.p. */
export const JUDGE_MULTIPLIERS: Record<number, number> = {
  1: 2.05,
  2: 2.17,
  3: 2.28,
  4: 2.36,
  5: 2.5,
  6: 2.65,
  7: 2.75,
  8: 2.92,
  9: 3.12,
  10: 3.23,
};

export type CourtLevel = 'SR' | 'SO' | 'SA';

export const COURT_STAWKI: Record<CourtLevel, number[]> = {
  SR: [1, 2, 3, 4, 5],
  SO: [4, 5, 6, 7, 8],
  SA: [7, 8, 9, 10],
};

export const COURT_LABELS: Record<CourtLevel, string> = {
  SR: 'Sąd rejonowy',
  SO: 'Sąd okręgowy',
  SA: 'Sąd apelacyjny',
};

/** Wybrane funkcje z tabeli dodatków funkcyjnych (rozporządzenie MS z 7.03.2018 r., t.j. Dz.U. z 2026 r. poz. 206). */
export const FUNCTIONS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'none', label: 'Brak funkcji', min: 0, max: 0 },
  { id: 'pw-sr', label: 'Przewodniczący wydziału w sądzie rejonowym', min: 0.2, max: 0.4 },
  { id: 'zpw-sr', label: 'Zastępca przewodniczącego wydziału w SR / kierownik sekcji w SR', min: 0.15, max: 0.35 },
  { id: 'wp-sr', label: 'Wiceprezes sądu rejonowego', min: 0.2, max: 0.45 },
  { id: 'p-sr', label: 'Prezes sądu rejonowego / przewodniczący wydziału w SO lub SA', min: 0.3, max: 0.55 },
  { id: 'zpw-so', label: 'Zastępca przewodniczącego wydziału w SO lub SA / wizytator', min: 0.25, max: 0.5 },
  { id: 'wp-so', label: 'Wiceprezes sądu okręgowego lub apelacyjnego', min: 0.35, max: 0.8 },
  { id: 'p-so', label: 'Prezes sądu okręgowego lub apelacyjnego', min: 0.4, max: 1.1 },
  { id: 'rzecznik', label: 'Rzecznik prasowy / kierownik sekcji w SO lub SA', min: 0.2, max: 0.4 },
  { id: 'mediacje', label: 'Koordynator do spraw mediacji', min: 0.1, max: 0.3 },
];
