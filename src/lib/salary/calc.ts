/**
 * Kalkulator wynagrodzeń: sędzia, asesor sądowy, aplikant KSSiP (+ etat na uczelni).
 *
 * Najważniejsze zasady (z przepisów pobranych z API Sejmu):
 *  – sędzia: art. 91 § 1c, § 7, § 9 u.s.p. – brak składek ZUS, dodatek za wysługę 5–20%, stawki z załącznika,
 *  – asesor: art. 106y u.s.p. – 80% stawki I SR „powiększone o należną składkę”, pełne składki ZUS,
 *  – aplikant: art. 41a ustawy o KSSiP + rozporządzenie o stypendium; stypendium to przychód z innych źródeł
 *    (art. 20 ust. 1 ustawy o PIT), bez ZUS (brak tytułu w ustawie o s.u.s.), składka zdrowotna 9% (art. 81 ust. 8 pkt 13 u.ś.o.z.),
 *  – sędziom, asesorom i aplikantom nie przysługuje „trzynastka” (ustawa o dodatkowym wynagrodzeniu rocznym dotyczy pracowników),
 *  – PIT: skala 12%/32%, kwota zmniejszająca 3600 zł, koszty 250/300 zł, limit 4500/5400 zł przy kilku stosunkach,
 *    koszty 50% od przychodów z praw autorskich (limit 120 000 zł), wspólne rozliczenie małżonków (art. 6 ust. 2),
 *    ulga na dzieci (art. 27f).
 */
import { COURT_STAWKI, JUDGE_MULTIPLIERS, paramsFor, type CourtLevel, type YearParams } from './params';

export type Role = 'sedzia' | 'asesor' | 'aplikant';
export type Filing = 'single' | 'joint' | 'singleParent';

export interface UniversityJob {
  enabled: boolean;
  grossMonthly: number;
  /** Udział wynagrodzenia za utwory (prawa autorskie), 0–1. */
  authorShare: number;
  months: number;
  /** „Trzynastka” z uczelni publicznej (8,5% rocznego wynagrodzenia za poprzedni rok). */
  thirteenth: boolean;
  pit2: boolean;
}

export interface CalcInput {
  year: number;
  role: Role;
  court: CourtLevel;
  /** Pełne lata na stanowisku (dla SR wraz z okresem asesury) – wyznacza stawkę. */
  yearsOnPosition: number;
  /** Pełne lata pracy do dodatku za długoletnią pracę. */
  seniorityYears: number;
  functionMultiplier: number;
  asesorGrossUp: 'divide' | 'add';
  stipendPhase: 'first12' | 'after12';
  stipendIncrease: number;
  /** Podwyższone koszty (mieszka poza miejscowością zakładu pracy). */
  commuter: boolean;
  /** Miesięczny zwrot kosztów dojazdu (art. 95 § 3 u.s.p.) – przychód opodatkowany. */
  commuteReimbursement: number;
  pit2: boolean;
  uni: UniversityJob;
  filing: Filing;
  /** Roczny dochód małżonka opodatkowany skalą (przychód − koszty − składki ZUS). */
  spouseIncome: number;
  /** Zaliczki zapłacone przez małżonka (gdy nie podano – szacujemy jako podatek przy rozliczeniu indywidualnym). */
  spouseAdvances?: number;
  children: number;
  /** Inne roczne dochody opodatkowane skalą. */
  otherIncome: number;
  judgeBaseOverride?: number;
}

export const DEFAULT_INPUT: CalcInput = {
  year: 2026,
  role: 'sedzia',
  court: 'SR',
  yearsOnPosition: 0,
  seniorityYears: 4,
  functionMultiplier: 0,
  asesorGrossUp: 'divide',
  stipendPhase: 'first12',
  stipendIncrease: 0,
  commuter: false,
  commuteReimbursement: 0,
  pit2: true,
  uni: { enabled: false, grossMonthly: 4000, authorShare: 0.7, months: 12, thirteenth: true, pit2: false },
  filing: 'single',
  spouseIncome: 0,
  children: 0,
  otherIncome: 0,
};

export interface MonthRow {
  month: number;
  gross: number;
  zusSocial: number;
  health: number;
  kup: number;
  authorKup: number;
  taxBase: number;
  advance: number;
  net: number;
  rate: number;
}

export interface JobResult {
  label: string;
  months: MonthRow[];
  gross: number;
  zusSocial: number;
  health: number;
  kup: number;
  authorKup: number;
  advances: number;
  net: number;
}

export interface Breakdown {
  baseSalary: number;
  seniorityPct: number;
  seniorityAmount: number;
  functionAllowance: number;
  stawka?: number;
  multiplier?: number;
  stipendBase?: number;
  stipendIncrease?: number;
  commute: number;
  grossMonthly: number;
}

export interface AnnualTax {
  income: number;
  spouseIncome: number;
  taxBase: number;
  taxBeforeRelief: number;
  childRelief: number;
  childReliefRefund: number;
  tax: number;
  advances: number;
  spouseAdvances: number;
  /** Dodatnia – zwrot, ujemna – dopłata. */
  settlement: number;
  separateTaxYou: number;
  separateTaxSpouse: number;
  jointBenefit: number;
  kupLimited: number;
  solidarity: boolean;
  netAnnual: number;
}

export interface CalcResult {
  params: YearParams;
  breakdown: Breakdown;
  main: JobResult;
  uni?: JobResult;
  annual: AnnualTax;
  notes: string[];
}

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const roundZl = (v: number) => Math.round(v);

/** Stawka wynagrodzenia zasadniczego wg sądu i pełnych lat na stanowisku (art. 91a u.s.p.). */
export function stawkaFor(court: CourtLevel, yearsOnPosition: number): number {
  const list = COURT_STAWKI[court];
  const idx = Math.min(Math.max(0, Math.floor(yearsOnPosition / 5)), list.length - 1);
  return list[idx]!;
}

/** Dodatek za długoletnią pracę: od szóstego roku pracy 5%, +1% za każdy rok, maks. 20% (art. 91 § 7 u.s.p.). */
export function seniorityPercent(fullYears: number): number {
  if (fullYears < 5) return 0;
  return Math.min(20, Math.floor(fullYears));
}

/** Pełne lata między datami (rocznice). */
export function fullYearsBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  let years = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) years--;
  return Math.max(0, years);
}

/** Data, od której przysługuje kolejna wartość (rocznica). */
export function anniversary(fromISO: string, years: number): string {
  const a = new Date(`${fromISO}T00:00:00`);
  const d = new Date(a.getFullYear() + years, a.getMonth(), a.getDate());
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Podatek wg skali (roczny), z kwotą zmniejszającą; podstawa zaokrąglona do zł. */
export function scaleTax(base: number, p: YearParams['pit']): number {
  const b = roundZl(Math.max(0, base));
  const tax = b <= p.threshold ? b * p.lowRate - p.taxReduction : p.threshold * p.lowRate - p.taxReduction + (b - p.threshold) * p.highRate;
  return Math.max(0, roundZl(tax));
}

export function childReliefAmount(children: number, familyIncome: number, filing: Filing, p: YearParams['pit']): number {
  if (children <= 0) return 0;
  const r = p.childRelief;
  if (children === 1) {
    const limit = filing === 'single' ? r.incomeLimitSingle : r.incomeLimitMarried;
    return familyIncome <= limit ? r.first : 0;
  }
  let total = r.first + r.second;
  if (children >= 3) total += r.third;
  if (children >= 4) total += r.fourthPlus * (children - 3);
  return round2(total);
}

interface PayrollOpts {
  label: string;
  grossByMonth: number[];
  /** Część przychodu z tytułu praw autorskich w danym miesiącu (przed odliczeniem składek). */
  authorShare: number;
  zus: boolean;
  sickness: boolean;
  kupMonthly: number;
  pit2: boolean;
  /** Składka zdrowotna ograniczana do zaliczki wg zasad z 2021 r. (płatnicy z art. 85 ust. 1–13 u.ś.o.z.). */
  healthCap: boolean;
  params: YearParams;
  capUsed: { value: number };
  authorKupUsed: { value: number };
}

function payroll(o: PayrollOpts): JobResult {
  const p = o.params;
  const months: MonthRow[] = [];
  let cumBase = 0;
  for (let i = 0; i < o.grossByMonth.length; i++) {
    const gross = round2(o.grossByMonth[i]!);
    let zusSocial = 0;
    if (o.zus) {
      const capRemaining = Math.max(0, p.zus.annualCap - o.capUsed.value);
      const pdBase = Math.min(gross, capRemaining);
      o.capUsed.value += pdBase;
      zusSocial = round2(pdBase * p.zus.pension) + round2(pdBase * p.zus.disability) + (o.sickness ? round2(gross * p.zus.sickness) : 0);
      zusSocial = round2(zusSocial);
    }
    const afterZus = gross - zusSocial;
    const authorIncome = afterZus * o.authorShare;
    let authorKup = round2(authorIncome * 0.5);
    const authorRemaining = Math.max(0, p.pit.authorCostLimit - o.authorKupUsed.value);
    authorKup = Math.min(authorKup, authorRemaining);
    o.authorKupUsed.value += authorKup;
    const nonAuthor = afterZus - authorIncome;
    const kup = o.kupMonthly > 0 ? Math.min(o.kupMonthly, Math.max(0, nonAuthor)) : 0;
    const taxBase = Math.max(0, roundZl(afterZus - kup - authorKup));
    const before = cumBase;
    cumBase += taxBase;
    let advanceRaw: number;
    if (cumBase <= p.pit.threshold) advanceRaw = taxBase * p.pit.lowRate;
    else if (before >= p.pit.threshold) advanceRaw = taxBase * p.pit.highRate;
    else advanceRaw = (p.pit.threshold - before) * p.pit.lowRate + (cumBase - p.pit.threshold) * p.pit.highRate;
    const reduction = o.pit2 ? p.pit.taxReduction / 12 : 0;
    const advance = Math.max(0, roundZl(advanceRaw - reduction));
    let health = round2(afterZus * p.health);
    if (o.healthCap) {
      // zaliczka obliczona wg przepisów obowiązujących 31.12.2021 r. (art. 83 ust. 2b u.ś.o.z.) – przed obniżeniem o składkę zdrowotną
      const old = roundZl(Math.max(0, taxBase * 0.17 - (o.pit2 ? 43.76 : 0)));
      if (health > old) health = round2(Math.max(0, old));
    }
    const net = round2(gross - zusSocial - health - advance);
    months.push({
      month: i + 1,
      gross,
      zusSocial,
      health,
      kup,
      authorKup,
      taxBase,
      advance,
      net,
      rate: before >= p.pit.threshold ? p.pit.highRate : cumBase > p.pit.threshold ? -1 : p.pit.lowRate,
    });
  }
  const sum = (k: keyof MonthRow) => round2(months.reduce((s, m) => s + (m[k] as number), 0));
  return {
    label: o.label,
    months,
    gross: sum('gross'),
    zusSocial: sum('zusSocial'),
    health: sum('health'),
    kup: sum('kup'),
    authorKup: sum('authorKup'),
    advances: sum('advance'),
    net: sum('net'),
  };
}

export function mainBreakdown(input: CalcInput, p: YearParams): Breakdown {
  const base = input.judgeBaseOverride ?? p.judgeBase;
  const funcAllowance = input.functionMultiplier > 0 ? roundZl(input.functionMultiplier * base) : 0;
  const commute = Math.max(0, input.commuteReimbursement);
  if (input.role === 'aplikant') {
    const stipendBase = input.stipendPhase === 'first12' ? p.stipend.first12 : p.stipend.after12;
    const inc = Math.max(0, input.stipendIncrease);
    return { baseSalary: stipendBase, seniorityPct: 0, seniorityAmount: 0, functionAllowance: 0, stipendBase, stipendIncrease: inc, commute: 0, grossMonthly: round2(stipendBase + inc) };
  }
  if (input.role === 'asesor') {
    const s1 = round2(JUDGE_MULTIPLIERS[1]! * base);
    const eighty = round2(s1 * 0.8);
    const rate = p.zus.pension + p.zus.disability + p.zus.sickness;
    const baseSalary = round2(input.asesorGrossUp === 'divide' ? eighty / (1 - rate) : eighty * (1 + rate));
    const pct = seniorityPercent(input.seniorityYears);
    const sen = round2((baseSalary * pct) / 100);
    return {
      baseSalary,
      seniorityPct: pct,
      seniorityAmount: sen,
      functionAllowance: funcAllowance,
      stawka: 1,
      multiplier: JUDGE_MULTIPLIERS[1],
      commute,
      grossMonthly: round2(baseSalary + sen + funcAllowance + commute),
    };
  }
  const stawka = stawkaFor(input.court, input.yearsOnPosition);
  const mult = JUDGE_MULTIPLIERS[stawka]!;
  const baseSalary = round2(mult * base);
  const pct = seniorityPercent(input.seniorityYears);
  const sen = round2((baseSalary * pct) / 100);
  return {
    baseSalary,
    seniorityPct: pct,
    seniorityAmount: sen,
    functionAllowance: funcAllowance,
    stawka,
    multiplier: mult,
    commute,
    grossMonthly: round2(baseSalary + sen + funcAllowance + commute),
  };
}

export function calculate(input: CalcInput): CalcResult {
  const p = paramsFor(input.year, input.judgeBaseOverride ? { judgeBase: input.judgeBaseOverride, judgeBaseSource: 'Wartość wpisana ręcznie' } : undefined);
  const b = mainBreakdown(input, p);
  const notes: string[] = [];
  const capUsed = { value: 0 };
  const authorKupUsed = { value: 0 };
  const isAplikant = input.role === 'aplikant';
  const main = payroll({
    label: input.role === 'sedzia' ? 'Sąd (stosunek służbowy sędziego)' : input.role === 'asesor' ? 'Sąd (stosunek służbowy asesora)' : 'KSSiP (stypendium aplikanta)',
    grossByMonth: Array.from({ length: 12 }, () => b.grossMonthly),
    authorShare: 0,
    zus: input.role === 'asesor',
    sickness: input.role === 'asesor',
    kupMonthly: isAplikant ? 0 : input.commuter ? p.pit.kupMonthlyCommuter : p.pit.kupMonthly,
    pit2: input.pit2,
    healthCap: !isAplikant,
    params: p,
    capUsed,
    authorKupUsed,
  });

  let uni: JobResult | undefined;
  if (input.uni.enabled && input.uni.grossMonthly > 0) {
    const months = Math.min(12, Math.max(1, Math.round(input.uni.months)));
    const gross = Array.from({ length: months }, () => input.uni.grossMonthly);
    uni = payroll({
      label: 'Uczelnia (umowa o pracę)',
      grossByMonth: gross,
      authorShare: Math.min(1, Math.max(0, input.uni.authorShare)),
      zus: true,
      sickness: true,
      kupMonthly: input.commuter ? p.pit.kupMonthlyCommuter : p.pit.kupMonthly,
      pit2: input.uni.pit2,
      healthCap: true,
      params: p,
      capUsed,
      authorKupUsed,
    });
    if (input.uni.thirteenth) {
      const thirteenth = round2(input.uni.grossMonthly * 12 * 0.085);
      const extra = payroll({
        label: 'Uczelnia – „trzynastka”',
        grossByMonth: [thirteenth],
        authorShare: 0,
        zus: true,
        sickness: true,
        kupMonthly: 0,
        pit2: false,
        healthCap: true,
        params: p,
        capUsed,
        authorKupUsed,
      });
      const m = extra.months[0]!;
      uni.months.push({ ...m, month: 13 });
      uni.gross = round2(uni.gross + extra.gross);
      uni.zusSocial = round2(uni.zusSocial + extra.zusSocial);
      uni.health = round2(uni.health + extra.health);
      uni.advances = round2(uni.advances + extra.advances);
      uni.net = round2(uni.net + extra.net);
      notes.push('„Trzynastka” z uczelni publicznej liczona jako 8,5% wynagrodzenia z poprzedniego roku (przyjęto takie samo wynagrodzenie).');
    }
  }

  // ---- roczne rozliczenie PIT
  const employmentRelations = (input.role !== 'aplikant' ? 1 : 0) + (uni ? 1 : 0);
  const kupApplied = main.kup + (uni?.kup ?? 0);
  let kupLimited = kupApplied;
  if (employmentRelations > 1) {
    const limit = input.commuter ? p.pit.kupAnnualMultiMaxCommuter : p.pit.kupAnnualMultiMax;
    kupLimited = Math.min(kupApplied, limit);
  }
  const grossTotal = main.gross + (uni?.gross ?? 0);
  const zusTotal = main.zusSocial + (uni?.zusSocial ?? 0);
  const authorKup = main.authorKup + (uni?.authorKup ?? 0);
  const income = round2(grossTotal - zusTotal - kupLimited - authorKup + Math.max(0, input.otherIncome));
  const advances = main.advances + (uni?.advances ?? 0);
  const spouseIncome = input.filing === 'joint' ? Math.max(0, input.spouseIncome) : 0;
  const separateTaxYou = scaleTax(income, p.pit);
  const separateTaxSpouse = input.filing === 'joint' ? scaleTax(spouseIncome, p.pit) : 0;
  let taxBefore: number;
  if (input.filing === 'single') taxBefore = separateTaxYou;
  else taxBefore = 2 * scaleTax((roundZl(income) + roundZl(spouseIncome)) / 2, p.pit);
  const familyIncome = income + spouseIncome;
  const relief = childReliefAmount(input.children, familyIncome, input.filing, p.pit);
  const usedRelief = Math.min(relief, taxBefore);
  const tax = roundZl(Math.max(0, taxBefore - usedRelief));
  const contributions = main.zusSocial + main.health + (uni ? uni.zusSocial + uni.health : 0);
  const reliefRefund = round2(Math.min(relief - usedRelief, contributions));
  const spouseAdvances = input.filing === 'joint' ? (input.spouseAdvances ?? separateTaxSpouse) : 0;
  const settlement = round2(advances + spouseAdvances - tax + reliefRefund);
  const jointBenefit = input.filing === 'joint' ? Math.max(0, separateTaxYou + separateTaxSpouse - taxBefore) : 0;
  const netAnnual = round2(main.net + (uni?.net ?? 0) + (input.filing === 'single' ? settlement : settlement));

  if (input.role !== 'aplikant') notes.push('Sędziom i asesorom nie przysługuje dodatkowe wynagrodzenie roczne („trzynastka”) – nie są pracownikami w rozumieniu ustawy o dodatkowym wynagrodzeniu rocznym.');
  if (input.role === 'sedzia') notes.push('Od wynagrodzenia sędziego nie odprowadza się składek na ubezpieczenia społeczne (art. 91 § 9 u.s.p.) – w stanie spoczynku przysługuje uposażenie 75% (art. 100 § 2).');
  if (input.role === 'asesor')
    notes.push(
      input.asesorGrossUp === 'divide'
        ? 'Asesor: 80% stawki I SR powiększone o składki tak, by po ich potrąceniu zostało 80% stawki (art. 106y § 1 u.s.p.).'
        : 'Asesor: 80% stawki I SR + 13,71% (składki pracownika) – wariant uproszczony.',
    );
  if (input.role === 'aplikant') notes.push('Stypendium to przychód z innych źródeł (art. 20 ust. 1 ustawy o PIT): bez kosztów uzyskania, bez składek ZUS, ze składką zdrowotną 9% (podstawa = stypendium).');
  if (input.commuteReimbursement > 0) notes.push('Zwrot kosztów dojazdu z art. 95 § 3 u.s.p. nie jest objęty zwolnieniem z art. 21 ust. 1 pkt 16 (dotyczy podróży służbowych) – doliczono go do przychodu i podstawy składki zdrowotnej.');
  if (employmentRelations > 1 && kupLimited < kupApplied) notes.push(`Koszty uzyskania z dwóch stosunków (sąd + uczelnia) ograniczono w zeznaniu do ${kupLimited.toLocaleString('pl-PL')} zł (art. 22 ust. 2 pkt 2/4).`);
  if (income + spouseIncome > p.pit.solidarityThreshold) notes.push('Dochód przekracza 1 000 000 zł – dodatkowo danina solidarnościowa 4% od nadwyżki (art. 30h).');
  if (p.judgeBaseForecast && input.role !== 'aplikant') notes.push('Podstawa wynagrodzenia na ten rok jest prognozą – ostateczną wysokość może zmienić ustawa okołobudżetowa.');

  return {
    params: p,
    breakdown: b,
    main,
    uni,
    annual: {
      income,
      spouseIncome,
      taxBase: roundZl(income),
      taxBeforeRelief: taxBefore,
      childRelief: usedRelief,
      childReliefRefund: reliefRefund,
      tax,
      advances,
      spouseAdvances,
      settlement,
      separateTaxYou,
      separateTaxSpouse,
      jointBenefit,
      kupLimited,
      solidarity: income + spouseIncome > p.pit.solidarityThreshold,
      netAnnual,
    },
    notes,
  };
}

// ---------------------------------------------------------------- kilometrówka i delegacje

export type Vehicle = 'carUpTo900' | 'carOver900' | 'motorcycle' | 'moped';

export function mileageCost(kmOneWay: number, tripsPerMonth: number, vehicle: Vehicle, p: YearParams, roundTrip = true): number {
  const km = Math.max(0, kmOneWay) * (roundTrip ? 2 : 1) * Math.max(0, tripsPerMonth);
  return round2(km * p.mileage[vehicle]);
}

/** Dieta krajowa (§ 7 rozporządzenia MRPiPS z 29.01.2013 r.): <8 h – 0; 8–12 h – 50%; >12 h – 100%; doba+ – reszta wg progów 8 h. */
export function domesticPerDiem(hours: number, p: YearParams, mealsProvided = 0): number {
  const d = p.perDiem;
  let amount = 0;
  if (hours <= 24) {
    if (hours < 8) amount = 0;
    else if (hours <= 12) amount = d * 0.5;
    else amount = d;
  } else {
    const full = Math.floor(hours / 24);
    const rest = hours - full * 24;
    amount = full * d + (rest === 0 ? 0 : rest <= 8 ? d * 0.5 : d);
  }
  // śniadanie 25%, obiad 50%, kolacja 25% diety – pomniejszenie za zapewnione posiłki
  amount -= Math.min(amount, mealsProvided * d);
  return round2(Math.max(0, amount));
}
