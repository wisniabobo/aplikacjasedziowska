import { ErrorBox, Loading, Notice, PageHeader, Row, Section } from '../components/ui';
import { loadExamIndex, useAsync, type ExamIndexEntry } from '../lib/data';
import { useProgress } from '../lib/storage/progress';

const KIND_LABEL: Record<ExamIndexEntry['kind'], string> = {
  'sedziowska-prokuratorska': 'Aplikacja sędziowska i prokuratorska',
  ogolna: 'Aplikacja ogólna (do 2016 r.)',
  uzupelniajaca: 'Aplikacja uzupełniająca sędziowska',
};

export default function Exams() {
  const idx = useAsync(loadExamIndex, []);
  const progress = useProgress();
  const best = (id: string) => {
    const tries = progress.exams.filter((e) => e.examId === id);
    if (!tries.length) return undefined;
    const b = tries.reduce((m, e) => (e.score / e.total > m.score / m.total ? e : m));
    return `${b.score}/${b.total}`;
  };
  return (
    <div className="page">
      <PageHeader title="Oficjalne testy" subtitle="Testy I etapu konkursów KSSiP z kluczami odpowiedzi" back={{ to: '/nauka', label: 'Nauka' }} />
      <Section>
        <Notice>
          Treść pytań i klucze pochodzą ze skanów opublikowanych przez KSSiP (rozpoznanie tekstu + kontrola klucza dwiema metodami i zgodnością podstawy prawnej).
          Pytania z niezweryfikowanym kluczem są oznaczone. Odpowiedzi odpowiadają stanowi prawnemu z dnia egzaminu.
        </Notice>
      </Section>
      {idx.loading && <Loading lines={6} />}
      {idx.error ? <ErrorBox error={idx.error} retry={idx.reload} /> : null}
      {idx.data &&
        (['sedziowska-prokuratorska', 'ogolna', 'uzupelniajaca'] as const).map((kind) => {
          const list = (idx.data ?? []).filter((e) => e.kind === kind);
          return (
          <Section key={kind} title={KIND_LABEL[kind]} footer={kind === 'uzupelniajaca' ? 'Test na aplikację uzupełniającą obejmuje te same dziedziny prawa – dobra dodatkowa praktyka.' : undefined}>
            <div className="list">
              {list.map((e) => (
                  <Row
                    key={e.id}
                    title={`${e.year}`}
                    sub={`${e.count} pytań · klucz zweryfikowany: ${e.verified}${best(e.id) ? ` · najlepszy wynik ${best(e.id)}` : ''}`}
                    to={`/nauka/egzamin/${e.id}`}
                  />
                ))}
            </div>
          </Section>
          );
        })}
    </div>
  );
}
