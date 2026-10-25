import { ErrorBox, Loading, Notice, PageHeader, Row, Section } from '../components/ui';
import { STAGES } from '../data/exam';
import { loadCasusIndex, useAsync } from '../lib/data';
import { useProgress } from '../lib/storage/progress';

export default function CasusList() {
  const idx = useAsync(loadCasusIndex, []);
  const progress = useProgress();
  return (
    <div className="page">
      <PageHeader title="Kazusy" subtitle="II etap konkursu: praca pisemna z kryteriami oceny KSSiP" />
      <Section title="Jak wygląda II etap">
        <div className="list">
          <Row title="Zadania" value="3 kazusy" sub="prawo prywatne · prawo publiczne · prawo karne" chevron={false} />
          <Row title="Czas" value={`${STAGES.written.minutes} minut`} chevron={false} />
          <Row title="Ocena" value="0–25 pkt za zadanie" sub="średnia ocen dwóch członków komisji (§ 25 rozporządzenia)" chevron={false} />
          <Row title="Materiały" value="tylko akty od komisji" sub="w 2026 r. prace wyłącznie odręcznie (zarządzenie nr 710/2026)" chevron={false} />
        </div>
      </Section>
      {idx.loading && <Loading lines={6} />}
      {idx.error ? <ErrorBox error={idx.error} retry={idx.reload} /> : null}
      {idx.data && (
        <Section title="Zestawy z lat ubiegłych">
          <div className="list">
            {idx.data.map((c) => {
              const written = Object.keys(progress.casus).filter((k) => k.startsWith(`${c.id}:`) && progress.casus[k]!.trim()).length;
              return (
                <Row
                  key={c.id}
                  title={`${c.year} · ${c.kind === 'ogolna' ? 'aplikacja ogólna' : 'aplikacja sędziowska i prokuratorska'}`}
                  sub={`${c.tasks.length ? c.tasks.join(' · ') : 'Zadania w jednym dokumencie'}${c.hasCriteria ? ' · z kryteriami oceny' : ''}${written ? ` · Twoje odpowiedzi: ${written}` : ''}`}
                  to={`/kazusy/${c.id}`}
                />
              );
            })}
          </div>
        </Section>
      )}
      <Notice>
        Treści zadań i kryteriów oceny pochodzą z dokumentów opublikowanych przez KSSiP (rozpoznanie tekstu ze skanów). Kryteria pokazują, za co komisja przyznaje punkty –
        porównaj z nimi własne rozwiązanie. Odnośniki do oryginalnych plików PDF znajdziesz w każdym zestawie.
      </Notice>
    </div>
  );
}
