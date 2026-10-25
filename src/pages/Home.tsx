import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Notice, PageHeader, Ring, Row, Section } from '../components/ui';
import { NABOR_2026 } from '../data/exam';
import { loadActIndex, loadDataUpdated, loadExamIndex, loadQuestionStats, useAsync } from '../lib/data';
import { fetchActMeta } from '../lib/eli/api';
import { dueIds, streak, todayKey, useProgress } from '../lib/storage/progress';

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

function daysUntil(iso: string, now = new Date()): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(`${iso}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function Countdown() {
  const d1 = daysUntil(NABOR_2026.stage1);
  const d2 = daysUntil(NABOR_2026.stage2);
  const next = d1 >= 0 ? { days: d1, label: 'I etap – test', date: NABOR_2026.stage1, detail: '150 pytań · 3 odpowiedzi · 150 minut' } : d2 >= 0 ? { days: d2, label: 'II etap – praca pisemna', date: NABOR_2026.stage2, detail: '3 kazusy · 180 minut · 0–25 pkt za każdy' } : null;
  if (!next) {
    return (
      <div className="card countdown">
        <div>
          <div className="t-headline">Nabór {NABOR_2026.year + 1}</div>
          <p className="muted t-sub" style={{ margin: '4px 0 0' }}>Termin zostanie ogłoszony zarządzeniem Ministra Sprawiedliwości (zwykle wiosną). Czas na systematyczną naukę.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card countdown" aria-label={`Do ${next.label} pozostało ${next.days} dni`}>
      <div style={{ textAlign: 'center', minWidth: 84 }}>
        <div className="days">{next.days}</div>
        <div className="t-foot muted">{next.days === 1 ? 'dzień' : 'dni'}</div>
      </div>
      <div style={{ borderLeft: '0.5px solid var(--separator)', paddingLeft: 16 }}>
        <div className="t-foot" style={{ color: 'var(--tint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Nabór {NABOR_2026.year} · {next.label}
        </div>
        <div className="t-title3" style={{ margin: '2px 0' }}>{fmtDate(next.date)}</div>
        <div className="t-sub muted">{next.detail}</div>
      </div>
    </div>
  );
}

function SejmStatus() {
  const updated = useAsync(loadDataUpdated, []);
  const index = useAsync(loadActIndex, []);
  const [state, setState] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [changed, setChanged] = useState<{ slug: string; short: string; remote: string }[]>([]);
  const check = async () => {
    if (!index.data) return;
    setState('checking');
    try {
      const eliActs = index.data.filter((a) => a.eli.startsWith('DU/'));
      const results = await Promise.all(
        eliActs.map(async (a) => {
          const m = await fetchActMeta(a.eli);
          return { a, remote: m.changeDate ?? '' };
        }),
      );
      setChanged(results.filter((r) => r.remote.slice(0, 10) > a10(r.a.changeDate)).map((r) => ({ slug: r.a.slug, short: r.a.short, remote: r.remote.slice(0, 10) })));
      setState('done');
    } catch {
      setState('error');
    }
  };
  return (
    <Section
      title="Ustawy z API Sejmu"
      footer={updated.data ? `Teksty ujednolicone pobrane ${new Date(updated.data.updatedAt).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short' })}. Aktualizacja automatyczna codziennie.` : undefined}
    >
      <div className="list">
        <Row icon="refresh" title={state === 'checking' ? 'Sprawdzam zmiany w Sejmie…' : 'Sprawdź, czy są nowsze teksty'} onClick={state === 'checking' ? undefined : check} chevron={false} />
        {state === 'done' && changed.length === 0 && <Row title="Wszystkie ustawy są aktualne" sub="Zgodne z danymi API ELI Kancelarii Sejmu." chevron={false} />}
        {state === 'error' && <Row title="Nie udało się połączyć z API Sejmu" sub="Sprawdź połączenie z internetem i spróbuj ponownie." chevron={false} />}
        {changed.map((c) => (
          <Row key={c.slug} title={c.short} sub={`Zmiana w API Sejmu z ${c.remote} – otwórz, aby pobrać najnowszy tekst`} to={`/ustawy/${c.slug}?aktualizuj=1`} />
        ))}
      </div>
    </Section>
  );
}

const a10 = (s: string) => (s ?? '').slice(0, 10);

function Hero({ total }: { total: number }) {
  const points = [
    'Oficjalne testy KSSiP z lat 2010–2026 z kluczem i podstawą prawną',
    `${total ? total.toLocaleString('pl-PL') : '13 000'}+ pytań z aktualnego brzmienia przepisów`,
    'Symulacja egzaminu, powtórki i analiza słabych dziedzin',
    'Kazusy z kryteriami oceny i 28 ustaw z wykazu w jednym miejscu',
  ];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <h2 id="hero-title">Zdaj konkurs na aplikację sędziowską</h2>
      <p>Wszystko, czego potrzebujesz do I i II etapu konkursu w KSSiP – ucz się codziennie po kilkanaście minut i obserwuj, jak rośnie wynik.</p>
      <ul>
        {points.map((p) => (
          <li key={p}>
            <Icon name="check" size={20} />
            {p}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/nauka/sesja?mode=mix" className="btn primary">
          <Icon name="play" size={18} /> Zacznij naukę
        </Link>
        <Link to="/nauka/egzamin/symulacja" className="btn ghost">
          Sprawdź się w symulacji
        </Link>
      </div>
    </section>
  );
}


export function Home() {
  const progress = useProgress();
  const stats = useAsync(loadQuestionStats, []);
  const exams = useAsync(loadExamIndex, []);
  const today = progress.daily[todayKey()] ?? { a: 0, c: 0 };
  const due = useMemo(() => dueIds(progress).length, [progress]);
  const totals = useMemo(() => {
    const all = Object.values(progress.daily);
    const a = all.reduce((s, d) => s + d.a, 0);
    const c = all.reduce((s, d) => s + d.c, 0);
    return { a, c, learned: Object.values(progress.cards).filter((x) => x.b >= 3).length };
  }, [progress]);
  const official = exams.data?.reduce((s, e) => s + e.count, 0) ?? 0;
  const verified = exams.data?.reduce((s, e) => s + e.verified, 0) ?? 0;
  const generated = stats.data?.total ?? 0;
  const st = streak(progress);

  return (
    <div className="page">
      <PageHeader
        title="Start"
        subtitle="Przygotowanie do konkursu na aplikację sędziowską"
        actions={
          <Link to="/ustawienia" className="icon-btn" aria-label="Ustawienia i dane">
            <Icon name="gear" size={22} />
          </Link>
        }
      />
      {totals.a < 30 && (
        <Section>
          <Hero total={generated} />
        </Section>
      )}
      <Section>
        <Countdown />
      </Section>

      <Section title="Dzisiaj">
        <div className="card pad" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Ring value={today.a / Math.max(1, progress.settings.dailyGoal)} label={`Dzienny cel: ${today.a} z ${progress.settings.dailyGoal}`} size={72}>
            {today.a}
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-headline">
              {today.a >= progress.settings.dailyGoal ? 'Cel na dziś osiągnięty' : `Cel: ${progress.settings.dailyGoal} pytań`}
            </div>
            <div className="t-sub muted">
              {today.a ? `Poprawnie ${Math.round((today.c / today.a) * 100)}%` : 'Zacznij od krótkiej sesji'} · seria {st} {st === 1 ? 'dzień' : 'dni'}
            </div>
          </div>
          <Link to="/nauka/sesja?mode=mix" className="btn primary">
            <Icon name="play" size={18} />
            Ucz się
          </Link>
        </div>
      </Section>

      <Section title="Szybki start">
        <div className="grid cols-2">
          <Link to="/nauka/sesja?mode=review" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value">{due}</div>
            <div className="label">Powtórki na dziś</div>
          </Link>
          <Link to="/nauka/egzamin/symulacja" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value">150</div>
            <div className="label">Symulacja egzaminu (150 min)</div>
          </Link>
          <Link to="/nauka/testy" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value">{exams.data ? exams.data.length : '–'}</div>
            <div className="label">Oficjalne testy KSSiP</div>
          </Link>
          <Link to="/kazusy" className="card stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="value">14</div>
            <div className="label">Zestawy kazusów z kryteriami</div>
          </Link>
        </div>
      </Section>

      <Section title="Nabór 2026" footer="Dane z zarządzenia Ministra Sprawiedliwości z 29.05.2026 r. i komunikatów Dyrektora KSSiP.">
        <div className="list">
          <Row icon="info" title="Wszystko o naborze i aplikacji" sub={`Limit: ${NABOR_2026.limits.sedziowska} miejsc (sędziowska) · opłata ${NABOR_2026.fee} zł`} to="/nabor" />
          <Row icon="book" iconColor="#0a84ff" title="Wykaz 28 aktów prawnych na test" sub="Komunikat nr 28/2026 – teksty z API Sejmu" to="/ustawy" />
          <Row icon="money" iconColor="#30a14e" title="Ile zarabia aplikant, asesor i sędzia" sub="Kalkulator z PIT, ZUS, uczelnią i kilometrówką" to="/kariera" />
        </div>
      </Section>

      <Section title="Baza pytań">
        <div className="grid cols-3">
          <div className="card stat">
            <div className="value">{(official + generated).toLocaleString('pl-PL')}</div>
            <div className="label">pytań łącznie</div>
          </div>
          <div className="card stat">
            <div className="value">{official.toLocaleString('pl-PL')}</div>
            <div className="label">z oficjalnych testów ({verified.toLocaleString('pl-PL')} ze zweryfikowanym kluczem)</div>
          </div>
          <div className="card stat">
            <div className="value">{generated.toLocaleString('pl-PL')}</div>
            <div className="label">z aktualnych przepisów</div>
          </div>
        </div>
        <p className="section-foot">
          Twoje odpowiedzi: {totals.a.toLocaleString('pl-PL')}{totals.a ? ` (${Math.round((totals.c / totals.a) * 100)}% poprawnie)` : ''} · opanowane pytania: {totals.learned.toLocaleString('pl-PL')}.
        </p>
      </Section>

      {progress.exams.length > 0 && (
        <Section title="Ostatnie egzaminy próbne">
          <div className="list">
            {progress.exams.slice(0, 5).map((e) => (
              <Row
                key={e.id}
                title={e.label}
                sub={new Date(e.date).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}
                value={<span className="num">{e.score}/{e.total}</span>}
                chevron={false}
              />
            ))}
          </div>
        </Section>
      )}

      <SejmStatus />

      <Notice>
        Pytania „z przepisów” powstają z aktualnego tekstu ustaw: poprawna jest odpowiedź zgodna z brzmieniem przepisu. Pytania oficjalne pochodzą z testów KSSiP
        i odpowiadają stanowi prawnemu z dnia egzaminu – przy każdym widzisz rok i podstawę prawną z klucza.
      </Notice>
    </div>
  );
}
