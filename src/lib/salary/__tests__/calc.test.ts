import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT, calculate, childReliefAmount, domesticPerDiem, fullYearsBetween, mileageCost, scaleTax, seniorityPercent, stawkaFor } from '../calc';
import { paramsFor } from '../params';

const p26 = paramsFor(2026);

describe('zasady u.s.p.', () => {
  it('dodatek za wysługę: od 6. roku 5%, +1% rocznie, maks. 20%', () => {
    expect(seniorityPercent(4)).toBe(0);
    expect(seniorityPercent(5)).toBe(5);
    expect(seniorityPercent(6)).toBe(6);
    expect(seniorityPercent(19)).toBe(19);
    expect(seniorityPercent(35)).toBe(20);
  });
  it('stawki awansowe co 5 lat w granicach sądu', () => {
    expect(stawkaFor('SR', 0)).toBe(1);
    expect(stawkaFor('SR', 5)).toBe(2);
    expect(stawkaFor('SR', 24)).toBe(5);
    expect(stawkaFor('SR', 40)).toBe(5);
    expect(stawkaFor('SO', 0)).toBe(4);
    expect(stawkaFor('SA', 12)).toBe(9);
  });
  it('pełne lata między datami', () => {
    expect(fullYearsBetween('2020-10-26', '2026-10-25')).toBe(5);
    expect(fullYearsBetween('2020-10-25', '2026-10-25')).toBe(6);
  });
});

describe('PIT', () => {
  it('skala 12%/32% z kwotą zmniejszającą', () => {
    expect(scaleTax(30_000, p26.pit)).toBe(0);
    expect(scaleTax(100_000, p26.pit)).toBe(8_400);
    expect(scaleTax(212_216.28, p26.pit)).toBe(40_309);
  });
  it('ulga na dzieci', () => {
    expect(childReliefAmount(1, 100_000, 'joint', p26.pit)).toBe(1112.04);
    expect(childReliefAmount(1, 120_000, 'joint', p26.pit)).toBe(0);
    expect(childReliefAmount(1, 60_000, 'single', p26.pit)).toBe(0);
    expect(childReliefAmount(3, 500_000, 'joint', p26.pit)).toBe(4224.12);
    expect(childReliefAmount(4, 500_000, 'joint', p26.pit)).toBe(6924.12);
  });
});

describe('sędzia SR, stawka I, 2026', () => {
  const r = calculate({ ...DEFAULT_INPUT, year: 2026, role: 'sedzia', court: 'SR', yearsOnPosition: 0, seniorityYears: 4 });
  it('brutto = 2,05 × 8748,63 zł', () => {
    expect(r.breakdown.grossMonthly).toBe(17934.69);
    expect(r.main.zusSocial).toBe(0);
  });
  it('styczeń: zdrowotna, zaliczka i netto', () => {
    const m = r.main.months[0]!;
    expect(m.health).toBe(1614.12);
    expect(m.taxBase).toBe(17685);
    expect(m.advance).toBe(1822);
    expect(m.net).toBe(14498.57);
  });
  it('przekroczenie progu w lipcu i 32% od sierpnia', () => {
    expect(r.main.months[6]!.advance).toBe(2581);
    expect(r.main.months[7]!.advance).toBe(5359);
  });
  it('roczne rozliczenie', () => {
    expect(r.annual.income).toBe(212216.28);
    expect(r.annual.tax).toBe(40309);
    expect(r.annual.advances).toBe(40308);
    expect(r.annual.settlement).toBe(-1);
  });
});

describe('asesor sądowy 2026', () => {
  const r = calculate({ ...DEFAULT_INPUT, year: 2026, role: 'asesor', seniorityYears: 0 });
  it('80% stawki I powiększone o składki', () => {
    expect(r.breakdown.baseSalary).toBe(16627.36);
  });
  it('składki ZUS i netto', () => {
    const m = r.main.months[0]!;
    expect(m.zusSocial).toBe(2279.61);
    expect(m.health).toBe(1291.3);
    expect(m.advance).toBe(1392);
    expect(m.net).toBe(11664.45);
  });
});

describe('aplikant KSSiP 2026', () => {
  const r = calculate({ ...DEFAULT_INPUT, year: 2026, role: 'aplikant', stipendPhase: 'first12', stipendIncrease: 0 });
  it('stypendium bez ZUS i bez kosztów', () => {
    const m = r.main.months[0]!;
    expect(m.gross).toBe(5766);
    expect(m.zusSocial).toBe(0);
    expect(m.kup).toBe(0);
    expect(m.health).toBe(518.94);
    expect(m.advance).toBe(392);
    expect(m.net).toBe(4855.06);
  });
});

describe('sędzia + uczelnia (koszty 50%)', () => {
  const r = calculate({
    ...DEFAULT_INPUT,
    role: 'sedzia',
    uni: { enabled: true, grossMonthly: 5000, authorShare: 0.8, months: 12, thirteenth: false, pit2: false },
  });
  it('koszty autorskie od przychodu po składkach', () => {
    const m = r.uni!.months[0]!;
    // ZUS: 5000 × (9,76% + 1,5% + 2,45%)
    expect(m.zusSocial).toBe(685.5);
    expect(m.authorKup).toBe(round(4314.5 * 0.8 * 0.5));
    expect(m.kup).toBe(250);
  });
  it('limit kosztów przy dwóch stosunkach = 4500 zł', () => {
    expect(r.annual.kupLimited).toBe(4500);
  });
});

describe('wspólne rozliczenie z małżonkiem', () => {
  const single = calculate({ ...DEFAULT_INPUT, filing: 'single' });
  const joint = calculate({ ...DEFAULT_INPUT, filing: 'joint', spouseIncome: 30_000 });
  it('obniża podatek rodziny', () => {
    expect(joint.annual.jointBenefit).toBeGreaterThan(0);
    expect(joint.annual.taxBeforeRelief).toBeLessThan(single.annual.taxBeforeRelief + joint.annual.separateTaxSpouse);
  });
});

describe('kilometrówka i diety', () => {
  it('stawki z rozporządzenia', () => {
    expect(mileageCost(50, 10, 'carOver900', p26)).toBe(1150);
    expect(mileageCost(50, 10, 'carUpTo900', p26)).toBe(890);
  });
  it('dieta krajowa 45 zł', () => {
    expect(domesticPerDiem(7, p26)).toBe(0);
    expect(domesticPerDiem(10, p26)).toBe(22.5);
    expect(domesticPerDiem(13, p26)).toBe(45);
    expect(domesticPerDiem(30, p26)).toBe(67.5);
    expect(domesticPerDiem(34, p26)).toBe(90);
  });
});

function round(v: number) {
  return Math.round(v * 100) / 100;
}
