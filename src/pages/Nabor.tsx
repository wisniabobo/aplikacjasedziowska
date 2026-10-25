import { Link } from 'react-router-dom';
import { Notice, PageHeader, Row, Section } from '../components/ui';
import { AREAS, NABOR_2026, STAGES } from '../data/exam';
import manifest from '../../scripts/sources/kssip-manifest.json';

const d = (iso: string) => new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Nabor() {
  const reports = manifest.exams.filter((e) => 'report' in e && e.report) as { year: number; report?: string }[];
  const total = NABOR_2026.limits.sedziowska + NABOR_2026.limits.prokuratorska;
  return (
    <div className="page">
      <PageHeader title="Nabór i aplikacja" subtitle="Wszystko, co trzeba wiedzieć o konkursie na aplikację sędziowską w KSSiP" back={{ to: '/', label: 'Start' }} />

      <Section title={`Kalendarz naboru ${NABOR_2026.year}`} footer="Terminy z komunikatów Dyrektora KSSiP nr 19/2026 i 29/2026.">
        <div className="list">
          <Row icon="calendar" title="Zgłoszenia w systemie IRK" sub={`od ${d(NABOR_2026.registration.from)} (13:00) do ${d(NABOR_2026.registration.to)} (13:00) – wyłącznie elektronicznie`} chevron={false} />
          <Row icon="calendar" iconColor="#c2410c" title="Odstąpienie z odzyskaniem 2/3 opłaty" sub={`pisemne oświadczenie do ${d(NABOR_2026.withdrawalDeadline)}`} chevron={false} />
          <Row icon="calendar" iconColor="#0a84ff" title="Dyplom (dla zgłoszonych z zaświadczeniem)" sub={`dostarczenie do ${d(NABOR_2026.docsDeadline)}`} chevron={false} />
          <Row icon="target" iconColor="#5b3cc4" title="I etap – test" sub={d(NABOR_2026.stage1)} chevron={false} />
          <Row icon="case" iconColor="#1d8a3e" title="II etap – praca pisemna" sub={d(NABOR_2026.stage2)} chevron={false} />
        </div>
      </Section>

      <Section title="Najważniejsze liczby">
        <div className="grid cols-2">
          <div className="card stat">
            <div className="value">{NABOR_2026.limits.sedziowska}</div>
            <div className="label">miejsc na aplikacji sędziowskiej (+{NABOR_2026.limits.prokuratorska} prokuratorska)</div>
          </div>
          <div className="card stat">
            <div className="value">{NABOR_2026.fee} zł</div>
            <div className="label">opłata – równowartość minimalnego wynagrodzenia (art. 21 ust. 2)</div>
          </div>
          <div className="card stat">
            <div className="value">{2 * total}</div>
            <div className="label">osób przechodzi do II etapu (2 × suma limitów, art. 18 ust. 2)</div>
          </div>
          <div className="card stat">
            <div className="value">225</div>
            <div className="label">maks. punktów: test 150 + praca pisemna 3 × 25</div>
          </div>
        </div>
      </Section>

      <Section title="Kto może zostać aplikantem" footer="Art. 24 ust. 1 ustawy o KSSiP.">
        <div className="list">
          <Row title="Obywatelstwo polskie, pełnia praw cywilnych i obywatelskich" chevron={false} />
          <Row title="Nieposzlakowana opinia" chevron={false} />
          <Row title="Brak skazania za przestępstwo umyślne ścigane z oskarżenia publicznego lub skarbowe" chevron={false} />
          <Row title="Ukończone wyższe studia prawnicze w Polsce (magister) lub uznane zagraniczne" chevron={false} />
          <Row title="Stan zdrowia pozwalający pełnić obowiązki sędziego albo prokuratora" chevron={false} />
        </div>
      </Section>

      <Section title="Zgłoszenie do konkursu" footer="Art. 17 ust. 4 i 4a ustawy o KSSiP. Zamiast dyplomu można złożyć zaświadczenie o zdanych egzaminach i wyznaczonym terminie egzaminu dyplomowego.">
        <div className="list">
          <Row title="Ankieta personalna" chevron={false} />
          <Row title="Dyplom magistra prawa lub zaświadczenie o zdanym egzaminie magisterskim" chevron={false} />
          <Row title="Dowód uiszczenia opłaty" chevron={false} />
          <Row title="Kopia dowodu osobistego" chevron={false} />
          <Row title="Oświadczenie o korzystaniu z pełni praw" chevron={false} />
        </div>
      </Section>

      <Section title="I etap – test" footer="§ 4 i § 18 rozporządzenia MS z 12.03.2018 r. (t.j. Dz.U. z 2025 r. poz. 1877).">
        <div className="list">
          <Row title="Pytania" value={`${STAGES.test.questions}`} sub={`co najmniej ${STAGES.test.minFromAreas2to8} z dziedzin 2–8`} chevron={false} />
          <Row title="Odpowiedzi" value="3, jedna prawdziwa" chevron={false} />
          <Row title="Czas" value={`${STAGES.test.minutes} minut`} chevron={false} />
          <Row title="Punktacja" value="1 pkt za poprawną" sub="Zmiana zaznaczenia lub kilka zaznaczeń = błędna odpowiedź" chevron={false} />
          <Row title="Zakres – wykaz aktów prawnych" sub="28 aktów z Komunikatu nr 28/2026 – wszystkie w czytniku" to="/ustawy" />
        </div>
      </Section>

      <Section title="Dziedziny testu">
        <div className="list">
          {AREAS.map((a) => (
            <Row key={a.id} title={`${a.no}. ${a.label}`} to={`/nauka/sesja?mode=area&area=${a.id}`} />
          ))}
        </div>
      </Section>

      <Section title="II etap – praca pisemna" footer="Art. 18 ust. 1 pkt 2 ustawy o KSSiP; § 4 ust. 6, § 23 i § 25 rozporządzenia.">
        <div className="list">
          <Row title="Trzy zadania" sub="prawo prywatne (cywilne, rodzinne, postępowanie cywilne, pracy, spółek) · publiczne (konstytucyjne, administracyjne, sądowoadministracyjne, międzynarodowe, UE) · karne" chevron={false} />
          <Row title="Czas" value={`${STAGES.written.minutes} minut`} chevron={false} />
          <Row title="Ocena" value="0–25 pkt / zadanie" sub="średnia z ocen dwóch członków komisji, z pisemnym uzasadnieniem" chevron={false} />
          <Row title="Pomoce" sub="Wyłącznie akty prawne udostępnione przez komisję; w 2026 r. prace pisze się odręcznie" chevron={false} />
          <Row title="Kazusy z lat ubiegłych z kryteriami" to="/kazusy" />
        </div>
      </Section>

      <Section title="Zasady na sali" footer="§ 15–16 rozporządzenia; od 14.10.2025 r. komisja może używać wykrywaczy urządzeń (§ 15 ust. 2a).">
        <div className="list">
          <Row title="Zakaz urządzeń elektronicznych i materiałów" sub="Odmowa poddania się sprawdzeniu = wykluczenie" chevron={false} />
          <Row title="Niezgłoszenie się do rejestracji" sub="Traktowane jako odstąpienie od konkursu (§ 13 ust. 4)" chevron={false} />
          <Row title="Wyjście z sali" sub="Tylko w szczególnych przypadkach, za zgodą komisji i pod nadzorem" chevron={false} />
        </div>
      </Section>

      <Section title="Po konkursie" footer="Art. 22 i 25 ustawy o KSSiP.">
        <div className="list">
          <Row title="Lista kwalifikacyjna" sub="O miejscu decyduje suma punktów z obu etapów; równe wyniki = to samo miejsce" chevron={false} />
          <Row title="Przyjęcie na aplikację" sub="Decyzja Dyrektora KSSiP według kolejności do wyczerpania limitu" chevron={false} />
          <Row title="Odwołanie" sub="Do Ministra Sprawiedliwości w 14 dni, potem skarga do WSA (tylko naruszenie trybu)" chevron={false} />
        </div>
      </Section>

      <Section title="Aplikacja sędziowska" footer="Art. 27, 40b, 41a–41c ustawy o KSSiP; rozporządzenie MS w sprawie stypendium.">
        <div className="list">
          <Row title="Czas trwania" value="36 miesięcy" sub="zajęcia w KSSiP i praktyki pod opieką patrona koordynatora" chevron={false} />
          <Row title="Dni wolne" value="21 dni / rok" sub="+ 30 dni przed egzaminem sędziowskim" chevron={false} />
          <Row title="Stypendium" value="5 766 / 6 366 zł" sub="+ podwyższenie 150–650 zł zależnie od miejsca zamieszkania" to="/kariera" />
          <Row title="Zwrot stypendium" sub="M.in. gdy nie zdasz egzaminu albo nie podejmiesz pracy asesora – chyba że przez 3 z 6 lat pracujesz w sądownictwie lub prokuraturze" chevron={false} />
          <Row title="Egzamin sędziowski" sub="Lista klasyfikacyjna → wybór stanowiska asesorskiego; niezdany egzamin można powtórzyć dwa razy" chevron={false} />
          <Row title="Asesor sądowy, potem sędzia" sub="Asesor orzeka jak sędzia; wniosek o powołanie na sędziego SR przed upływem 36 miesięcy orzekania" chevron={false} />
        </div>
      </Section>

      <Section title="Oficjalne materiały KSSiP">
        <div className="list">
          {NABOR_2026.sources.map((s) => (
            <Row key={s.url} title={s.label} href={s.url} />
          ))}
          {reports.map((r) => (
            <Row key={r.report} title={`Analiza wyników naboru ${r.year}`} sub="Statystyki zdawalności i wyników z dziedzin" href={`${manifest.base}${r.report}`} />
          ))}
        </div>
      </Section>

      <Notice>
        Informacje opracowano na podstawie ustawy o KSSiP i rozporządzenia o naborze w brzmieniu z API Sejmu oraz komunikatów KSSiP. Przed konkursem zawsze sprawdź aktualne ogłoszenia na{' '}
        <a href="https://www.kssip.gov.pl" target="_blank" rel="noopener noreferrer">kssip.gov.pl</a>. Pełne teksty: <Link to="/ustawy/kssip">ustawa o KSSiP</Link>.
      </Notice>
    </div>
  );
}
