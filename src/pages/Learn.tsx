import { useMemo } from 'react';
import { PageHeader, Row, Section } from '../components/ui';
import { ACTS } from '../data/acts';
import { AREAS } from '../data/exam';
import { loadExamIndex, loadQuestionStats, useAsync } from '../lib/data';
import { KIND_LABELS, type QuestionKind } from '../lib/questions/generator';
import { dueIds, useProgress } from '../lib/storage/progress';

const AREA_COLORS = ['#5b3cc4', '#0a84ff', '#0f7b8a', '#c2410c', '#9a6700', '#c4271b', '#a21caf', '#1d8a3e', '#475569', '#2563eb'];

export default function Learn() {
  const progress = useProgress();
  const stats = useAsync(loadQuestionStats, []);
  const exams = useAsync(loadExamIndex, []);
  const due = useMemo(() => dueIds(progress).length, [progress]);
  const wrong = useMemo(() => Object.values(progress.cards).filter((c) => c.w > 0 && c.b < 3).length, [progress]);
  const kinds = useMemo(() => {
    const out: Partial<Record<QuestionKind, number>> = {};
    for (const a of Object.values(stats.data?.perAct ?? {})) for (const [k, v] of Object.entries(a.kinds)) out[k as QuestionKind] = (out[k as QuestionKind] ?? 0) + (v ?? 0);
    return out;
  }, [stats.data]);
  const officialCount = exams.data?.reduce((s, e) => s + e.verified, 0) ?? 0;
  const size = progress.settings.sessionSize;

  return (
    <div className="page">
      <PageHeader title="Nauka" subtitle="Wybierz tryb – postęp i powtórki zapisują się automatycznie" />
      <Section title="Tryby">
        <div className="list">
          <Row icon="shuffle" title="Szybka sesja" sub={`${size} pytań ze wszystkich dziedzin w proporcjach jak na teście`} to="/nauka/sesja?mode=mix" />
          <Row icon="refresh" iconColor="#0a84ff" title="Powtórki" sub="System Leitnera: pytania, które trzeba odświeżyć" value={due || undefined} to="/nauka/sesja?mode=review" />
          <Row icon="warning" iconColor="#c4271b" title="Moje błędy" sub="Pytania, na które odpowiadasz źle" value={wrong || undefined} to="/nauka/sesja?mode=wrong" />
          <Row icon="timer" iconColor="#1d8a3e" title="Symulacja egzaminu" sub="150 pytań · 150 minut · wynik i analiza dziedzin" to="/nauka/egzamin/symulacja" />
          <Row icon="doc" iconColor="#9a6700" title="Oficjalne testy KSSiP" sub={`21 testów z lat 2010–2026 · ${officialCount.toLocaleString('pl-PL')} pytań ze zweryfikowanym kluczem`} to="/nauka/testy" />
          <Row icon="star" iconColor="#a21caf" title="Losowe pytania oficjalne" sub="Mieszanka z wszystkich lat" to="/nauka/sesja?mode=official" />
        </div>
      </Section>

      <Section title="Według dziedziny (§ 4 rozporządzenia)">
        <div className="list">
          {AREAS.map((a, i) => (
            <Row
              key={a.id}
              icon="target"
              iconColor={AREA_COLORS[i]}
              title={`${a.no}. ${a.label}`}
              sub={a.acts.map((s) => ACTS.find((x) => x.slug === s)?.abbr).join(' · ')}
              to={`/nauka/sesja?mode=area&area=${a.id}`}
            />
          ))}
        </div>
      </Section>

      <Section title="Według ustawy z wykazu">
        <div className="list">
          {ACTS.filter((a) => a.wykazNo).map((a) => (
            <Row
              key={a.slug}
              title={a.short}
              sub={a.abbr}
              value={stats.data ? (stats.data.perAct[a.slug]?.total ?? 0).toLocaleString('pl-PL') : undefined}
              to={`/nauka/sesja?mode=act&act=${a.slug}`}
            />
          ))}
        </div>
      </Section>

      <Section title="Według rodzaju zagadnienia" footer="Terminy, kwoty, właściwość sądu i większości głosów to klasyki testu KSSiP.">
        <div className="list">
          {(Object.keys(KIND_LABELS) as QuestionKind[]).map((k) => (
            <Row key={k} title={KIND_LABELS[k]} value={kinds[k] ? kinds[k]!.toLocaleString('pl-PL') : undefined} to={`/nauka/sesja?mode=kind&kind=${k}`} />
          ))}
        </div>
      </Section>
    </div>
  );
}
