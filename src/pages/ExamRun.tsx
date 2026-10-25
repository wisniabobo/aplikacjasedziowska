import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Explanation, QuestionText, QuestionMeta, QuestionView } from '../components/QuestionView';
import { ErrorBox, Loading, Notice, PageHeader, ProgressBar, Row, Section, Segmented, Sheet, SwitchRow } from '../components/ui';
import { AREAS, AREA_SHORT, STAGES } from '../data/exam';
import { loadExam, useAsync } from '../lib/data';
import { buildSimulation, fromOfficial, type UIQuestion } from '../lib/questions/pool';
import { addExamAttempt, getProgress, recordAnswer } from '../lib/storage/progress';

type Phase = 'intro' | 'run' | 'result';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export default function ExamRun() {
  const { id = 'symulacja' } = useParams();
  const isSim = id === 'symulacja';
  const [phase, setPhase] = useState<Phase>('intro');
  const [officialShare, setOfficialShare] = useState<'0' | '50' | '100'>('50');
  const [timed, setTimed] = useState(true);
  const [seed, setSeed] = useState(0);
  const exam = useAsync(() => (isSim ? Promise.resolve(null) : loadExam(id)), [id]);

  const [questions, setQuestions] = useState<UIQuestion[] | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<unknown>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [cur, setCur] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const finishedRef = useRef(false);

  const totalSec = STAGES.test.minutes * 60;
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const remaining = totalSec - elapsed;

  const start = async () => {
    setBuilding(true);
    setBuildError(null);
    try {
      let qs: UIQuestion[];
      if (isSim) {
        qs = await buildSimulation({ officialShare: Number(officialShare) / 100, includeUnverified: getProgress().settings.includeUnverified });
      } else {
        const ex = exam.data!;
        qs = ex.questions.map((q) => fromOfficial(ex, q)).filter((x): x is UIQuestion => x !== null);
      }
      setQuestions(qs);
      setAnswers(qs.map(() => null));
      setCur(0);
      setStartedAt(Date.now());
      finishedRef.current = false;
      setPhase('run');
    } catch (e) {
      setBuildError(e);
    } finally {
      setBuilding(false);
    }
  };

  const finish = useCallback(() => {
    if (!questions || finishedRef.current) return;
    finishedRef.current = true;
    const byArea: Record<string, { ok: number; total: number }> = {};
    let score = 0;
    questions.forEach((q, i) => {
      const a = answers[i];
      const ok = a === q.correct;
      if (ok) score++;
      const key = q.area ?? 'inne';
      byArea[key] ??= { ok: 0, total: 0 };
      byArea[key].total++;
      if (ok) byArea[key].ok++;
      if (a !== null && a !== undefined) recordAnswer(q.id, ok);
    });
    addExamAttempt({
      id: `${Date.now()}`,
      kind: isSim ? 'simulation' : 'official',
      examId: isSim ? undefined : id,
      label: isSim ? 'Symulacja egzaminu' : exam.data?.label ?? id,
      date: Date.now(),
      score,
      total: questions.length,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      byArea,
    });
    setPhase('result');
    window.scrollTo(0, 0);
  }, [questions, answers, isSim, id, exam.data, startedAt]);

  useEffect(() => {
    if (phase !== 'run') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('beforeunload', onBefore);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'run' && timed && remaining <= 0) finish();
  }, [phase, timed, remaining, finish]);

  useEffect(() => {
    if (phase !== 'run') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, a: 0, b: 1, c: 2 };
      if (k in map) setAnswers((arr) => arr.map((v, i) => (i === cur ? map[k]! : v)));
      else if (k === 'arrowright') setCur((c) => Math.min((questions?.length ?? 1) - 1, c + 1));
      else if (k === 'arrowleft') setCur((c) => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, cur, questions]);

  const answeredCount = answers.filter((a) => a !== null).length;
  const result = useMemo(() => {
    if (!questions || phase !== 'result') return null;
    const score = questions.reduce((s, q, i) => s + (answers[i] === q.correct ? 1 : 0), 0);
    const areas = AREAS.map((a) => {
      const idxs = questions.map((q, i) => (q.area === a.id ? i : -1)).filter((i) => i >= 0);
      return { area: a, total: idxs.length, ok: idxs.filter((i) => answers[i] === questions[i]!.correct).length };
    }).filter((x) => x.total > 0);
    return { score, areas };
  }, [questions, answers, phase]);

  const title = isSim ? 'Symulacja egzaminu' : exam.data ? `Test KSSiP ${exam.data.year}` : 'Test KSSiP';

  if (phase === 'intro') {
    return (
      <div className="page">
        <PageHeader title={title} subtitle={isSim ? '150 pytań w proporcjach z § 4 rozporządzenia' : exam.data?.label} back={{ to: isSim ? '/nauka' : '/nauka/testy', label: isSim ? 'Nauka' : 'Testy' }} />
        {!isSim && exam.loading && <Loading lines={4} />}
        {!isSim && exam.error ? <ErrorBox error={exam.error} retry={exam.reload} /> : null}
        {(isSim || exam.data) && (
          <>
            <Section title="Zasady jak na konkursie">
              <div className="list">
                <Row title="Liczba pytań" value={isSim ? '150' : String(exam.data!.questions.filter((q) => q.correct).length)} chevron={false} />
                <Row title="Odpowiedzi" value="3, jedna prawidłowa" chevron={false} />
                <Row title="Czas" value={`${STAGES.test.minutes} minut`} chevron={false} />
                <Row title="Punktacja" value="1 pkt za poprawną" chevron={false} />
              </div>
            </Section>
            <Section title="Ustawienia">
              <div className="list">
                {isSim && (
                  <div className="row" style={{ display: 'block' }}>
                    <div className="row-title" style={{ marginBottom: 8 }}>Udział pytań z oficjalnych testów</div>
                    <Segmented
                      label="Udział pytań oficjalnych"
                      value={officialShare}
                      onChange={setOfficialShare}
                      options={[
                        { value: '0', label: 'Tylko z przepisów' },
                        { value: '50', label: 'Pół na pół' },
                        { value: '100', label: 'Głównie oficjalne' },
                      ]}
                    />
                  </div>
                )}
                <SwitchRow title="Odliczanie czasu" sub="Po 150 minutach test zakończy się automatycznie" checked={timed} onChange={setTimed} />
              </div>
            </Section>
            {!isSim && exam.data && (
              <Section>
                <Notice>
                  Stan prawny z {exam.data.year} r. – część odpowiedzi może być dziś nieaktualna. Oryginał:{' '}
                  <a href={exam.data.source.test} target="_blank" rel="noopener noreferrer">test (PDF)</a> ·{' '}
                  <a href={exam.data.source.key} target="_blank" rel="noopener noreferrer">klucz (PDF)</a>.
                </Notice>
              </Section>
            )}
            {buildError ? <ErrorBox error={buildError} /> : null}
            <button type="button" className="btn primary block" onClick={() => void start()} disabled={building} key={seed}>
              {building ? 'Przygotowuję pytania…' : 'Rozpocznij'}
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'result' && result && questions) {
    const pct = Math.round((result.score / questions.length) * 100);
    return (
      <div className="page">
        <PageHeader title="Wynik" subtitle={title} back={{ to: isSim ? '/nauka' : '/nauka/testy', label: isSim ? 'Nauka' : 'Testy' }} />
        <div className="card money-hero">
          <div className="t-foot muted">Twój wynik</div>
          <div className="big">
            {result.score} <span className="muted" style={{ fontSize: 24 }}>/ {questions.length}</span>
          </div>
          <div className="t-sub muted">
            {pct}% · czas {fmt((Date.now() - startedAt) / 1000)} · bez odpowiedzi: {answers.filter((a) => a === null).length}
          </div>
          <p className="t-foot" style={{ margin: '10px 0 0' }}>
            Do II etapu przechodzi tylu najlepszych kandydatów, ile wynosi dwukrotność sumy limitów (art. 18 ust. 2 ustawy o KSSiP) – w 2026 r. 2 × (210 + 150) = 720 osób.
          </p>
        </div>
        <Section title="Wynik według dziedzin">
          <div className="card pad" style={{ display: 'grid', gap: 12 }}>
            {result.areas.map(({ area, ok, total }) => (
              <div key={area.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="t-sub">
                  <span>{AREA_SHORT[area.id]}</span>
                  <span className="num muted">
                    {ok}/{total}
                  </span>
                </div>
                <ProgressBar value={ok / total} label={`${AREA_SHORT[area.id]}: ${ok} z ${total}`} />
              </div>
            ))}
          </div>
        </Section>
        <Section title="Przegląd odpowiedzi" footer="Dotknij numeru, aby zobaczyć pytanie z wyjaśnieniem.">
          <div className="card pad">
            <div className="qgrid">
              {questions.map((q, i) => (
                <button key={q.id} type="button" className={answers[i] === q.correct ? 'ok' : 'bad'} onClick={() => setReviewIdx(i)} aria-label={`Pytanie ${i + 1}: ${answers[i] === q.correct ? 'poprawnie' : 'błędnie'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </Section>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setPhase('intro');
              setSeed((s) => s + 1);
            }}
          >
            <Icon name="refresh" size={18} /> Jeszcze raz
          </button>
        </div>
        <Sheet open={reviewIdx !== null} onClose={() => setReviewIdx(null)} title={reviewIdx !== null ? `Pytanie ${reviewIdx + 1}` : ''}>
          {reviewIdx !== null && (
            <QuestionView q={questions[reviewIdx]!} selected={answers[reviewIdx] ?? null} reveal onSelect={() => {}} />
          )}
        </Sheet>
      </div>
    );
  }

  const q = questions?.[cur];
  return (
    <div className="page">
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', paddingTop: 'calc(var(--safe-t) + 6px)', paddingBottom: 8, marginTop: -8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge tint num" style={{ fontSize: 14 }} aria-live="off">
            <Icon name="clock" size={14} /> {timed ? fmt(remaining) : fmt(elapsed)}
          </span>
          <span className="t-foot muted num">
            {answeredCount}/{questions?.length ?? 0} odpowiedzi
          </span>
          <button type="button" className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setNavOpen(true)}>
            <Icon name="list" size={16} /> Pytania
          </button>
          <button
            type="button"
            className="btn small primary"
            onClick={() => {
              const left = (questions?.length ?? 0) - answeredCount;
              if (left === 0 || window.confirm(`Bez odpowiedzi: ${left}. Zakończyć test?`)) finish();
            }}
          >
            Zakończ
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar value={answeredCount / Math.max(1, questions?.length ?? 1)} label="Udzielone odpowiedzi" />
        </div>
      </div>
      {q && (
        <div className="card qcard" style={{ marginTop: 8 }}>
          <div className="t-foot muted" style={{ marginBottom: 6 }}>
            Pytanie {cur + 1} z {questions!.length}
          </div>
          <QuestionMeta q={q} hideSource={!isSim} />
          <QuestionText q={q} />
          <div className="options" role="radiogroup" aria-label="Odpowiedzi">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={answers[cur] === i}
                className={`option${answers[cur] === i ? ' selected' : ''}`}
                onClick={() => setAnswers((arr) => arr.map((v, j) => (j === cur ? (v === i ? null : i) : v)))}
              >
                <span className="letter" aria-hidden="true">{'ABC'[i]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}>
          <Icon name="back" size={18} /> Poprzednie
        </button>
        <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setCur((c) => Math.min(questions!.length - 1, c + 1))} disabled={!questions || cur === questions.length - 1}>
          Następne <Icon name="chevron" size={18} />
        </button>
      </div>
      <Sheet open={navOpen} onClose={() => setNavOpen(false)} title="Nawigator pytań">
        <div className="qgrid">
          {questions?.map((qq, i) => (
            <button
              key={qq.id}
              type="button"
              className={`${answers[i] !== null ? 'answered' : ''}${i === cur ? ' current' : ''}`}
              onClick={() => {
                setCur(i);
                setNavOpen(false);
              }}
              aria-label={`Pytanie ${i + 1}${answers[i] !== null ? ', odpowiedziano' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </Sheet>
      {reviewIdx !== null && questions && <Explanation q={questions[reviewIdx]!} />}
    </div>
  );
}
