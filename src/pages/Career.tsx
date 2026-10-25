import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Notice, NumberRow, PageHeader, Row, Section, Segmented, SelectRow, SwitchRow, zl } from '../components/ui';
import stipendTables from '../data/stipendIncrease.json';
import { openPdfInBrowser } from '../lib/eli/browserPdf';
import {
  DEFAULT_INPUT,
  anniversary,
  calculate,
  domesticPerDiem,
  fullYearsBetween,
  mileageCost,
  stawkaFor,
  type CalcInput,
  type Filing,
  type Role,
  type Vehicle,
} from '../lib/salary/calc';
import { fetchJudgeBase, findBudgetRelatedAct } from '../lib/salary/liveParams';
import { COURT_LABELS, COURT_STAWKI, FUNCTIONS, JUDGE_MULTIPLIERS, LATEST_KNOWN_YEAR, YEARS, paramsFor, type CourtLevel } from '../lib/salary/params';

const STORAGE = 'aplikacjasedziowska:calc:v1';
const todayISO = () => new Date().toISOString().slice(0, 10);

interface UiState {
  input: CalcInput;
  useDates: boolean;
  serviceStart: string;
  positionStart: string;
  functionId: string;
  stipendCity: 'krakow' | 'gdansk';
  stipendCourt: string;
  commuteKm: number;
  commuteDays: number;
  commuteVehicle: Vehicle;
  commuteOn: boolean;
  aplKm: number;
  aplTrips: number;
  delegKm: number;
  delegHours: number;
  delegVehicle: Vehicle;
}

const initialUi = (): UiState => ({
  input: { ...DEFAULT_INPUT, year: Math.min(Math.max(new Date().getFullYear(), 2025), LATEST_KNOWN_YEAR) },
  useDates: false,
  serviceStart: '2020-10-01',
  positionStart: '2026-01-01',
  functionId: 'none',
  stipendCity: 'krakow',
  stipendCourt: '',
  commuteKm: 30,
  commuteDays: 21,
  commuteVehicle: 'carOver900',
  commuteOn: false,
  aplKm: 300,
  aplTrips: 1,
  delegKm: 120,
  delegHours: 9,
  delegVehicle: 'carOver900',
});

function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return initialUi();
    const p = JSON.parse(raw) as Partial<UiState>;
    const base = initialUi();
    return { ...base, ...p, input: { ...base.input, ...(p.input ?? {}), uni: { ...base.input.uni, ...(p.input?.uni ?? {}) } } };
  } catch {
    return initialUi();
  }
}

const VEHICLES: { value: Vehicle; label: string }[] = [
  { value: 'carOver900', label: 'Samochód > 900 cm³' },
  { value: 'carUpTo900', label: 'Samochód ≤ 900 cm³' },
  { value: 'motorcycle', label: 'Motocykl' },
  { value: 'moped', label: 'Motorower' },
];

const COURT_OPTIONS = (city: 'krakow' | 'gdansk') => {
  const table = stipendTables[city];
  const out: { value: string; label: string; amount: number }[] = [];
  for (const g of table) for (const c of g.courts) out.push({ value: `${g.amount}|${c}`, label: `SR ${c} (+${g.amount} zł)`, amount: g.amount });
  return out.sort((a, b) => a.label.localeCompare(b.label, 'pl'));
};

export default function Career() {
  const [ui, setUi] = useState<UiState>(loadUi);
  const [live, setLive] = useState<{ state: 'idle' | 'loading' | 'ok' | 'none' | 'error'; value?: number; source?: string; budgetAct?: string }>({ state: 'idle' });
  const set = (patch: Partial<UiState>) => setUi((s) => ({ ...s, ...patch }));
  const setInput = (patch: Partial<CalcInput>) => setUi((s) => ({ ...s, input: { ...s.input, ...patch } }));
  const setUni = (patch: Partial<CalcInput['uni']>) => setUi((s) => ({ ...s, input: { ...s.input, uni: { ...s.input.uni, ...patch } } }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(ui));
    } catch {
      /* ignorujemy brak miejsca */
    }
  }, [ui]);

  const year = ui.input.year;
  const p = paramsFor(year);

  // Samoaktualizacja: jeśli brakuje podstawy na wybrany rok, pobieramy komunikat GUS z API Sejmu.
  useEffect(() => {
    if (YEARS[year] && !YEARS[year]!.judgeBaseForecast) {
      setLive({ state: 'idle' });
      return;
    }
    let alive = true;
    setLive({ state: 'loading' });
    Promise.all([fetchJudgeBase(year, openPdfInBrowser), findBudgetRelatedAct(year)])
      .then(([base, budget]) => {
        if (!alive) return;
        if (base) setLive({ state: 'ok', value: base.value, source: base.source, budgetAct: budget?.title });
        else setLive({ state: 'none', budgetAct: budget?.title });
      })
      .catch(() => alive && setLive({ state: 'error' }));
    return () => {
      alive = false;
    };
  }, [year]);

  const derived = useMemo(() => {
    const today = todayISO();
    const seniority = ui.useDates ? fullYearsBetween(ui.serviceStart, today) : ui.input.seniorityYears;
    const onPosition = ui.useDates ? fullYearsBetween(ui.positionStart, today) : ui.input.yearsOnPosition;
    const fn = FUNCTIONS.find((f) => f.id === ui.functionId) ?? FUNCTIONS[0]!;
    const fnMult = fn.id === 'none' ? 0 : Math.min(fn.max, Math.max(fn.min, ui.input.functionMultiplier || fn.min));
    let stipendIncrease = 0;
    if (ui.input.role === 'aplikant' && ui.stipendCourt) stipendIncrease = Number(ui.stipendCourt.split('|')[0]) || 0;
    const commute = ui.commuteOn && ui.input.role !== 'aplikant' ? mileageCost(ui.commuteKm, ui.commuteDays, ui.commuteVehicle, p) : 0;
    return { seniority, onPosition, fnMult, stipendIncrease, commute };
  }, [ui, p]);

  const input: CalcInput = {
    ...ui.input,
    seniorityYears: derived.seniority,
    yearsOnPosition: derived.onPosition,
    functionMultiplier: derived.fnMult,
    stipendIncrease: derived.stipendIncrease,
    commuteReimbursement: derived.commute,
    commuter: ui.input.commuter || (ui.commuteOn && ui.input.role !== 'aplikant'),
    judgeBaseOverride: live.state === 'ok' && live.value ? live.value : undefined,
  };
  const r = calculate(input);
  const role = input.role;
  const firstNet = r.main.months[0]!.net + (r.uni?.months[0]?.net ?? 0);
  const avgNet = (r.main.net + (r.uni?.net ?? 0)) / 12;
  const aplTravel = mileageCost(ui.aplKm, ui.aplTrips, 'carOver900', p);
  const deleg = { km: mileageCost(ui.delegKm, 1, ui.delegVehicle, p, true), diet: domesticPerDiem(ui.delegHours, p) };
  const nextStawka = role === 'sedzia' && ui.useDates ? (() => {
    const list = COURT_STAWKI[input.court];
    const idx = Math.floor(derived.onPosition / 5);
    if (idx >= list.length - 1) return null;
    return { date: anniversary(ui.positionStart, (idx + 1) * 5), stawka: list[idx + 1]! };
  })() : null;
  const nextSeniority = ui.useDates && role !== 'aplikant' && derived.seniority < 20 ? anniversary(ui.serviceStart, Math.max(5, derived.seniority + 1)) : null;

  return (
    <div className="page">
      <PageHeader title="Zarobki" subtitle="Orientacyjny kalkulator: aplikant KSSiP, asesor sądowy, sędzia – z PIT, ZUS, uczelnią i dojazdami" />

      <Section>
        <Segmented<Role>
          label="Stanowisko"
          value={role}
          onChange={(v) => setInput({ role: v })}
          options={[
            { value: 'aplikant', label: 'Aplikant' },
            { value: 'asesor', label: 'Asesor' },
            { value: 'sedzia', label: 'Sędzia' },
          ]}
        />
      </Section>

      <div className="card money-hero" aria-live="polite">
        <div className="t-foot muted">{role === 'aplikant' ? 'Stypendium netto' : 'Wynagrodzenie netto'} – styczeń {year}</div>
        <div className="big">{zl(firstNet)}</div>
        <div className="t-sub muted">
          Brutto {zl(r.breakdown.grossMonthly + (r.uni?.months[0]?.gross ?? 0))} · średnio netto {zl(avgNet)} / mies.
        </div>
        <div className="grid cols-3" style={{ marginTop: 14 }}>
          <div>
            <div className="t-cap muted">Rocznie brutto</div>
            <div className="t-headline num">{zl(r.main.gross + (r.uni?.gross ?? 0), 0)}</div>
          </div>
          <div>
            <div className="t-cap muted">Rocznie netto</div>
            <div className="t-headline num">{zl(r.main.net + (r.uni?.net ?? 0), 0)}</div>
          </div>
          <div>
            <div className="t-cap muted">{r.annual.settlement >= 0 ? 'Zwrot w PIT' : 'Dopłata w PIT'}</div>
            <div className="t-headline num" style={{ color: r.annual.settlement >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {zl(Math.abs(r.annual.settlement), 0)}
            </div>
          </div>
        </div>
      </div>

      <Section title="Rok i parametry">
        <div className="list">
          <SelectRow
            title="Rok"
            value={String(year)}
            onChange={(v) => setInput({ year: Number(v) })}
            options={[...Object.keys(YEARS).map((y) => ({ value: y, label: y })), { value: String(LATEST_KNOWN_YEAR + 1), label: `${LATEST_KNOWN_YEAR + 1} (z API Sejmu)` }]}
          />
          <Row
            title="Podstawa wynagrodzenia sędziów"
            sub={live.state === 'ok' ? live.source : live.state === 'loading' ? 'Pobieram komunikat GUS z API Sejmu…' : p.judgeBaseSource}
            value={zl(live.state === 'ok' && live.value ? live.value : p.judgeBase)}
            chevron={false}
          />
          {p.judgeBaseForecast && live.state !== 'ok' && <Row title="Prognoza" sub="Brak jeszcze komunikatu GUS lub ustawy okołobudżetowej na ten rok – przyjęto ostatnią znaną wartość." chevron={false} />}
          {live.budgetAct && <Row title="Ustawa okołobudżetowa" sub={`${live.budgetAct} – sprawdź, czy nie zmienia podstawy wynagrodzeń sędziów.`} chevron={false} />}
        </div>
      </Section>

      {role === 'sedzia' && (
        <Section title="Stanowisko sędziego" footer="Stawka awansowa po każdych 5 latach na stanowisku (art. 91a § 3); do stażu w SR wlicza się asesurę (§ 4).">
          <div className="list">
            <SelectRow<CourtLevel> title="Sąd" value={input.court} onChange={(v) => setInput({ court: v })} options={(['SR', 'SO', 'SA'] as CourtLevel[]).map((c) => ({ value: c, label: COURT_LABELS[c] }))} />
            <SwitchRow title="Licz staż od dat" sub="Lata i dodatki wyliczą się automatycznie na dziś" checked={ui.useDates} onChange={(v) => set({ useDates: v })} />
            {ui.useDates ? (
              <>
                <DateRow title="Objęcie stanowiska (z asesurą)" value={ui.positionStart} onChange={(v) => set({ positionStart: v })} />
                <DateRow title="Początek stażu pracy (do wysługi)" value={ui.serviceStart} onChange={(v) => set({ serviceStart: v })} />
              </>
            ) : (
              <>
                <NumberRow title="Lata na stanowisku" value={ui.input.yearsOnPosition} onChange={(v) => setInput({ yearsOnPosition: Math.floor(v) })} max={60} suffix="lat" />
                <NumberRow title="Staż pracy do wysługi" value={ui.input.seniorityYears} onChange={(v) => setInput({ seniorityYears: Math.floor(v) })} max={60} suffix="lat" />
              </>
            )}
            <Row
              title={`Stawka ${roman(stawkaFor(input.court, derived.onPosition))} · mnożnik ${JUDGE_MULTIPLIERS[stawkaFor(input.court, derived.onPosition)]!.toFixed(2).replace('.', ',')}`}
              sub={nextStawka ? `Kolejna stawka (${roman(nextStawka.stawka)}) od ${nextStawka.date}` : 'Najwyższa stawka w tym sądzie'}
              value={zl(r.breakdown.baseSalary)}
              chevron={false}
            />
            <Row title={`Dodatek za wysługę: ${r.breakdown.seniorityPct}%`} sub={nextSeniority ? `Kolejny wzrost od ${nextSeniority}` : 'Od 6. roku pracy 5%, +1% rocznie, maks. 20%'} value={zl(r.breakdown.seniorityAmount)} chevron={false} />
          </div>
        </Section>
      )}

      {role === 'asesor' && (
        <Section title="Asesor sądowy" footer="Art. 106y u.s.p.: 80% wynagrodzenia zasadniczego sędziego SR w stawce I, powiększone o należną składkę na ubezpieczenia społeczne; asesor podlega ZUS.">
          <div className="list">
            <SwitchRow title="Licz staż od daty" checked={ui.useDates} onChange={(v) => set({ useDates: v })} />
            {ui.useDates ? (
              <DateRow title="Początek stażu pracy (do wysługi)" value={ui.serviceStart} onChange={(v) => set({ serviceStart: v })} />
            ) : (
              <NumberRow title="Staż pracy do wysługi" value={ui.input.seniorityYears} onChange={(v) => setInput({ seniorityYears: Math.floor(v) })} max={60} suffix="lat" />
            )}
            <SelectRow
              title="Powiększenie o składki"
              value={input.asesorGrossUp}
              onChange={(v) => setInput({ asesorGrossUp: v })}
              options={[
                { value: 'divide', label: 'po potrąceniu składek zostaje 80%' },
                { value: 'add', label: '+13,71% od 80% stawki' },
              ]}
            />
            <Row title="Wynagrodzenie zasadnicze" value={zl(r.breakdown.baseSalary)} chevron={false} />
            <Row title={`Dodatek za wysługę: ${r.breakdown.seniorityPct}%`} value={zl(r.breakdown.seniorityAmount)} chevron={false} />
          </div>
        </Section>
      )}

      {role !== 'aplikant' && (
        <Section title="Funkcja" footer="Mnożnik podstawy z tabeli rozporządzenia MS (t.j. Dz.U. z 2026 r. poz. 206); konkretną wartość w przedziale ustala przełożony.">
          <div className="list">
            <SelectRow title="Funkcja" value={ui.functionId} onChange={(v) => set({ functionId: v, input: { ...ui.input, functionMultiplier: FUNCTIONS.find((f) => f.id === v)?.min ?? 0 } })} options={FUNCTIONS.map((f) => ({ value: f.id, label: f.id === 'none' ? f.label : `${f.label} (${f.min}–${f.max})` }))} />
            {ui.functionId !== 'none' && (
              <NumberRow title="Mnożnik" value={derived.fnMult} onChange={(v) => setInput({ functionMultiplier: v })} step={0.05} min={0} max={1.1} suffix={`= ${zl(r.breakdown.functionAllowance, 0)}`} />
            )}
          </div>
        </Section>
      )}

      {role === 'aplikant' && (
        <Section title="Stypendium aplikanta" footer={`${p.stipend.source}. Podwyższenie wg miejsca zamieszkania – załączniki do rozporządzenia (od 17.01.2026 r.; dla rozpoczynających wcześniej – zasady dotychczasowe). Stypendium nie przysługuje w aplikacji uzupełniającej.`}>
          <div className="list">
            <SelectRow
              title="Okres aplikacji"
              value={input.stipendPhase}
              onChange={(v) => setInput({ stipendPhase: v })}
              options={[
                { value: 'first12', label: `pierwsze 12 miesięcy (${p.stipend.first12} zł)` },
                { value: 'after12', label: `po 12 miesiącach (${p.stipend.after12} zł)` },
              ]}
            />
            <SelectRow
              title="Zajęcia w KSSiP"
              value={ui.stipendCity}
              onChange={(v) => set({ stipendCity: v, stipendCourt: '' })}
              options={[
                { value: 'krakow', label: 'Kraków' },
                { value: 'gdansk', label: 'Gdańsk' },
              ]}
            />
            <SelectRow
              title="Mieszkam na obszarze"
              value={ui.stipendCourt}
              onChange={(v) => set({ stipendCourt: v })}
              options={[{ value: '', label: 'w miejscowości zajęć / poza tabelą (0 zł)' }, ...COURT_OPTIONS(ui.stipendCity)]}
            />
            <Row title="Podwyższenie stypendium" value={zl(derived.stipendIncrease)} chevron={false} />
          </div>
        </Section>
      )}

      {role !== 'aplikant' ? (
        <Section title="Dojazdy do sądu (kilometrówka)" footer={`Art. 95 § 3 u.s.p.: przy zgodzie na zamieszkanie poza siedzibą sądu – zwrot kosztów przejazdu jak w podróży służbowej. Stawki: ${p.mileage.source}.`}>
          <div className="list">
            <SwitchRow title="Mieszkam poza siedzibą sądu" sub="Zwrot kosztów dojazdu + podwyższone koszty uzyskania 300 zł" checked={ui.commuteOn} onChange={(v) => set({ commuteOn: v })} />
            {ui.commuteOn && (
              <>
                <NumberRow title="Odległość w jedną stronę" value={ui.commuteKm} onChange={(v) => set({ commuteKm: v })} suffix="km" max={500} />
                <NumberRow title="Dni dojazdu w miesiącu" value={ui.commuteDays} onChange={(v) => set({ commuteDays: Math.round(v) })} max={31} suffix="dni" />
                <SelectRow title="Pojazd" value={ui.commuteVehicle} onChange={(v) => set({ commuteVehicle: v })} options={VEHICLES} />
                <Row title="Zwrot miesięcznie" sub="Przychód opodatkowany (brak zwolnienia dla dojazdów)" value={zl(derived.commute)} chevron={false} />
              </>
            )}
          </div>
        </Section>
      ) : (
        <Section title="Dojazdy na zjazdy w KSSiP" footer="Porównanie kosztu dojazdu (kilometrówka 1,15 zł/km) z podwyższeniem stypendium.">
          <div className="list">
            <NumberRow title="Odległość do miejsca zajęć" value={ui.aplKm} onChange={(v) => set({ aplKm: v })} suffix="km" max={1200} />
            <NumberRow title="Zjazdy w miesiącu" value={ui.aplTrips} onChange={(v) => set({ aplTrips: v })} max={8} suffix="×" />
            <Row title="Koszt dojazdu (tam i z powrotem)" value={zl(aplTravel)} chevron={false} />
            <Row title={derived.stipendIncrease >= aplTravel ? 'Podwyższenie pokrywa dojazdy' : 'Dopłacasz do dojazdów'} value={zl(derived.stipendIncrease - aplTravel)} chevron={false} />
          </div>
        </Section>
      )}

      <Section title="Delegacja (podróż służbowa)" footer="Zwrot za przejazd prywatnym autem i dieta 45 zł są zwolnione z PIT (art. 21 ust. 1 pkt 16) do limitów z rozporządzeń.">
        <div className="list">
          <NumberRow title="Odległość w jedną stronę" value={ui.delegKm} onChange={(v) => set({ delegKm: v })} suffix="km" max={1000} />
          <NumberRow title="Czas podróży" value={ui.delegHours} onChange={(v) => set({ delegHours: v })} suffix="godz." max={240} />
          <SelectRow title="Pojazd" value={ui.delegVehicle} onChange={(v) => set({ delegVehicle: v })} options={VEHICLES} />
          <Row title="Kilometrówka" value={zl(deleg.km)} chevron={false} />
          <Row title="Dieta" value={zl(deleg.diet)} chevron={false} />
          <Row title="Razem (bez podatku)" value={zl(deleg.km + deleg.diet)} chevron={false} />
        </div>
      </Section>

      <Section title="Praca na uczelni" footer="Sędzia i asesor mogą być zatrudnieni na stanowisku dydaktycznym lub naukowym (art. 86 u.s.p.). Koszty 50% od części wynagrodzenia za utwory, liczone po odjęciu składek ZUS (art. 22 ust. 9 pkt 3), łącznie do 120 000 zł rocznie.">
        <div className="list">
          <SwitchRow title="Pracuję na uczelni (umowa o pracę)" checked={input.uni.enabled} onChange={(v) => setUni({ enabled: v })} />
          {input.uni.enabled && (
            <>
              <NumberRow title="Wynagrodzenie brutto" value={input.uni.grossMonthly} onChange={(v) => setUni({ grossMonthly: v })} suffix="zł/mies." max={100000} />
              <NumberRow title="Część za prawa autorskie" value={Math.round(input.uni.authorShare * 100)} onChange={(v) => setUni({ authorShare: v / 100 })} suffix="%" max={100} />
              <NumberRow title="Miesiące pracy w roku" value={input.uni.months} onChange={(v) => setUni({ months: Math.round(v) })} min={1} max={12} suffix="mies." />
              <SwitchRow title="„Trzynastka” z uczelni publicznej" sub="Dodatkowe wynagrodzenie roczne 8,5%" checked={input.uni.thirteenth} onChange={(v) => setUni({ thirteenth: v })} />
              <SwitchRow title="PIT-2 złożony na uczelni" sub="Zwykle kwotę zmniejszającą stosuje tylko jeden płatnik" checked={input.uni.pit2} onChange={(v) => setUni({ pit2: v })} />
              {r.uni && (
                <>
                  <Row title="Składki ZUS (pracownik)" sub="emerytalna 9,76%, rentowa 1,5%, chorobowa 2,45%" value={zl(r.uni.months[0]!.zusSocial)} chevron={false} />
                  <Row title="Koszty autorskie 50% / mies." value={zl(r.uni.months[0]!.authorKup)} chevron={false} />
                  <Row title="Netto z uczelni / mies." value={zl(r.uni.months[0]!.net)} chevron={false} />
                </>
              )}
            </>
          )}
        </div>
      </Section>

      <Section title="Rozliczenie PIT" footer="Wspólne rozliczenie z małżonkiem lub jako osoba samotnie wychowująca dziecko: podatek = 2 × podatek od połowy dochodów (art. 6 ust. 2 i 4).">
        <div className="list">
          <SelectRow<Filing>
            title="Sposób rozliczenia"
            value={input.filing}
            onChange={(v) => setInput({ filing: v })}
            options={[
              { value: 'single', label: 'Indywidualnie' },
              { value: 'joint', label: 'Wspólnie z małżonkiem' },
              { value: 'singleParent', label: 'Samotny rodzic' },
            ]}
          />
          {input.filing === 'joint' && <NumberRow title="Roczny dochód małżonka" sub="przychód − koszty − składki ZUS" value={input.spouseIncome} onChange={(v) => setInput({ spouseIncome: v })} suffix="zł" max={10000000} />}
          <NumberRow title="Dzieci (małoletnie)" value={input.children} onChange={(v) => setInput({ children: Math.round(v) })} max={12} />
          <NumberRow title="Inne dochody (skala)" value={input.otherIncome} onChange={(v) => setInput({ otherIncome: v })} suffix="zł/rok" max={10000000} />
          <SwitchRow title="PIT-2 u głównego płatnika" sub="Kwota zmniejszająca 300 zł miesięcznie w zaliczce" checked={input.pit2} onChange={(v) => setInput({ pit2: v })} />
          {role !== 'aplikant' && !ui.commuteOn && <SwitchRow title="Podwyższone koszty uzyskania (300 zł)" sub="Mieszkam poza miejscowością zakładu pracy" checked={input.commuter} onChange={(v) => setInput({ commuter: v })} />}
        </div>
      </Section>

      <Section title="Roczne podsumowanie">
        <div className="list">
          <Row title="Dochód do opodatkowania" value={zl(r.annual.income, 0)} chevron={false} />
          {input.filing === 'joint' && <Row title="Dochód małżonka" value={zl(r.annual.spouseIncome, 0)} chevron={false} />}
          <Row title="Podatek wg skali" sub={input.filing !== 'single' ? 'po zastosowaniu wspólnego rozliczenia' : undefined} value={zl(r.annual.taxBeforeRelief, 0)} chevron={false} />
          {r.annual.childRelief > 0 && <Row title="Ulga na dzieci" value={`− ${zl(r.annual.childRelief)}`} chevron={false} />}
          {r.annual.childReliefRefund > 0 && <Row title="Zwrot niewykorzystanej ulgi" value={zl(r.annual.childReliefRefund)} chevron={false} />}
          <Row title="Podatek należny" value={zl(r.annual.tax, 0)} chevron={false} />
          <Row title="Zaliczki pobrane w roku" sub={input.filing === 'joint' ? 'Twoje + szacunkowe zaliczki małżonka' : undefined} value={zl(r.annual.advances + r.annual.spouseAdvances, 0)} chevron={false} />
          <Row title={r.annual.settlement >= 0 ? 'Zwrot podatku' : 'Do dopłaty'} value={zl(Math.abs(r.annual.settlement), 0)} chevron={false} />
          {r.annual.jointBenefit > 0 && <Row title="Korzyść ze wspólnego rozliczenia" value={zl(r.annual.jointBenefit, 0)} chevron={false} />}
        </div>
      </Section>

      <Section title={`Miesiąc po miesiącu – ${r.main.label}`} footer="Po przekroczeniu 120 000 zł dochodu u płatnika zaliczka rośnie z 12% do 32% – dlatego netto spada w drugiej połowie roku.">
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Mies.</th>
                <th>Brutto</th>
                {role === 'asesor' && <th>ZUS</th>}
                <th>Zdrowotna</th>
                <th>Zaliczka PIT</th>
                <th>Netto</th>
              </tr>
            </thead>
            <tbody>
              {r.main.months.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td>{m.gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>
                  {role === 'asesor' && <td>{m.zusSocial.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>}
                  <td>{m.health.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>
                  <td>{m.advance.toLocaleString('pl-PL')}</td>
                  <td>
                    <strong>{m.net.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Rok</td>
                <td>{r.main.gross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>
                {role === 'asesor' && <td>{r.main.zusSocial.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>}
                <td>{r.main.health.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>
                <td>{r.main.advances.toLocaleString('pl-PL')}</td>
                <td>{r.main.net.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <Section title="Uwagi">
        <div className="card pad" style={{ display: 'grid', gap: 8 }}>
          {r.notes.map((n, i) => (
            <div key={i} className="t-sub" style={{ display: 'flex', gap: 8 }}>
              <Icon name="info" size={18} />
              <span>{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Ścieżka kariery">
        <div className="card pad">
          <ol className="timeline">
            <li>
              <div className="t-headline">Konkurs w KSSiP</div>
              <div className="t-sub muted">Test (150 pytań) i praca pisemna (3 kazusy). Lista kwalifikacyjna według sumy punktów.</div>
            </li>
            <li>
              <div className="t-headline">Aplikacja sędziowska – 36 miesięcy</div>
              <div className="t-sub muted">Zajęcia w KSSiP i praktyki; stypendium {p.stipend.first12}–{p.stipend.after12} zł + podwyższenie. Bez ZUS, bez „trzynastki”.</div>
            </li>
            <li>
              <div className="t-headline">Egzamin sędziowski</div>
              <div className="t-sub muted">Wybór stanowiska asesorskiego według miejsca na liście klasyfikacyjnej (art. 33a ustawy o KSSiP).</div>
            </li>
            <li>
              <div className="t-headline">Asesor sądowy</div>
              <div className="t-sub muted">Ok. {zl(calculate({ ...input, role: 'asesor', functionMultiplier: 0, commuteReimbursement: 0, uni: { ...input.uni, enabled: false } }).main.months[0]!.net, 0)} netto; wniosek o powołanie na sędziego przed upływem 36 miesięcy orzekania (art. 106xa u.s.p.).</div>
            </li>
            <li>
              <div className="t-headline">Sędzia sądu rejonowego</div>
              <div className="t-sub muted">
                Stawka I: {zl(JUDGE_MULTIPLIERS[1]! * (input.judgeBaseOverride ?? p.judgeBase))} brutto; kolejne stawki co 5 lat (do V: {zl(JUDGE_MULTIPLIERS[5]! * (input.judgeBaseOverride ?? p.judgeBase))}), plus wysługa do 20%.
              </div>
            </li>
          </ol>
        </div>
      </Section>

      <Notice>
        Kalkulator ma charakter orientacyjny i nie stanowi porady podatkowej. Uwzględnia przepisy ustawy o PIT, u.s.p., ustawy o KSSiP i rozporządzeń w brzmieniu z API Sejmu;
        rzeczywiste wypłaty mogą się różnić (np. zaokrąglenia płatnika, nieobecności, inne ulgi).
      </Notice>
    </div>
  );
}

function roman(n: number) {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n);
}

function DateRow({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="row">
      <span className="row-body">
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
      </span>
      <input className="input" type="date" value={value} max={todayISO()} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}
