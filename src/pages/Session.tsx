import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { QuestionView } from '../components/QuestionView';
import { ErrorBox, Loading, Notice, PageHeader, ProgressBar, Ring, Row, Section } from '../components/ui';
import { ACT_BY_SLUG } from '../data/acts';
import { AREA_LABEL, type AreaId } from '../data/exam';
import { useAsync } from '../lib/data';
import { KIND_LABELS, type QuestionKind } from '../lib/questions/generator';
import { buildSession, type SessionMode, type UIQuestion } from '../lib/questions/pool';
import { getProgress, recordAnswer, useProgress } from '../lib/storage/progress';

const TITLES: Record<SessionMode, string> = {
  mix: 'Szybka sesja',
  act: 'Ustawa',
  area: 'Dziedzina',
  kind: 'Zagadnienie',
  review: 'Powtórki',
  wrong: 'Moje błędy',
  official: 'Pytania oficjalne',
  new: 'Nowe pytania',
};

export default function Session() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const progress = useProgress();
  const mode = (params.get('mode') ?? 'mix') as SessionMode;
  const act = params.get('act') ?? undefined;
  const area = (params.get('area') ?? undefined) as AreaId | undefined;
  const kind = (params.get('kind') ?? undefined) as QuestionKind | undefined;
  const [round, setRound] = useState(0);
  const session = useAsync(
    () => buildSession({ mode, act, area, kind, size: getProgress().settings.sessionSize, includeUnverified: getProgress().settings.includeUnverified }, getProgress()),
    [mode, act, area, kind, round],
  );
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ q: UIQuestion; ok: boolean }[]>([]);

  useEffect(() => {
    setIdx(0);
    setSelected(null);
    setAnswers([]);
  }, [session.data]);

  const qs = session.data ?? [];
  const q = qs[idx];
  const done = qs.length > 0 && idx >= qs.length;
  const reveal = selected !== null;

  const choose = useCallback(
    (i: number) => {
      if (!q || selected !== null) return;
      setSelected(i);
      const ok = i === q.correct;
      recordAnswer(q.id, ok);
      setAnswers((a) => [...a, { q, ok }]);
    },
    [q, selected],
  );
  const next = useCallback(() => {
    setSelected(null);
    setIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      const map: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
      if (k in map && selected === null && q && map[k]! < q.options.length) {
        e.preventDefault();
        choose(map[k]!);
      } else if ((k === 'enter' || k === ' ' || k === 'arrowright') && selected !== null) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, next, selected, q]);

  const subtitle = useMemo(() => {
    if (mode === 'act' && act) return ACT_BY_SLUG[act]?.short;
    if (mode === 'area' && area) return AREA_LABEL[area];
    if (mode === 'kind' && kind) return KIND_LABELS[kind];
    return undefined;
  }, [mode, act, area, kind]);

  const correctCount = answers.filter((a) => a.ok).length;

  if (session.loading) {
    return (
      <div className="page">
        <PageHeader title={TITLES[mode]} subtitle={subtitle} back={{ to: '/nauka', label: 'Nauka' }} />
        <div className="card qcard">
          <Loading lines={6} />
          <p className="t-foot muted" style={{ marginTop: 12 }}>Przygotowuję pytania z aktualnych tekstów ustaw…</p>
        </div>
      </div>
    );
  }
  if (session.error) {
    return (
      <div className="page">
        <PageHeader title={TITLES[mode]} back={{ to: '/nauka', label: 'Nauka' }} />
        <ErrorBox error={session.error} retry={session.reload} />
      </div>
    );
  }
  if (qs.length === 0) {
    return (
      <div className="page">
        <PageHeader title={TITLES[mode]} subtitle={subtitle} back={{ to: '/nauka', label: 'Nauka' }} />
        <div className="card empty">
          <Icon name={mode === 'review' ? 'check' : 'info'} size={36} />
          <p className="t-headline" style={{ marginTop: 10 }}>{mode === 'review' ? 'Brak powtórek na teraz' : mode === 'wrong' ? 'Nie masz jeszcze błędów do poprawy' : 'Brak pytań w tym trybie'}</p>
          <p className="t-sub">{mode === 'review' ? 'Wróć później albo rozpocznij nową sesję – pytania wrócą zgodnie z harmonogramem powtórek.' : 'Rozpocznij szybką sesję, aby zebrać pytania.'}</p>
          <Link to="/nauka/sesja?mode=mix" className="btn primary" style={{ marginTop: 8 }}>
            Szybka sesja
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((correctCount / answers.length) * 100);
    return (
      <div className="page">
        <PageHeader title="Podsumowanie" subtitle={subtitle ?? TITLES[mode]} back={{ to: '/nauka', label: 'Nauka' }} />
        <div className="card pad" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring value={correctCount / answers.length} size={88} label={`Wynik ${pct}%`}>
            {pct}%
          </Ring>
          <div>
            <div className="t-title2 num">
              {correctCount} / {answers.length}
            </div>
            <div className="muted t-sub">{pct >= 80 ? 'Bardzo dobrze – tak trzymaj.' : pct >= 60 ? 'Nieźle. Błędne pytania wrócą w powtórkach.' : 'Warto powtórzyć te przepisy w czytniku ustaw.'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, margin: '16px 0 26px', flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" onClick={() => setRound((r) => r + 1)}>
            <Icon name="refresh" size={18} /> Kolejna sesja
          </button>
          <button type="button" className="btn" onClick={() => navigate('/nauka')}>
            Wróć do trybów
          </button>
        </div>
        {answers.some((a) => !a.ok) && (
          <Section title="Do powtórki">
            <div className="list">
              {answers
                .filter((a) => !a.ok)
                .map(({ q: wq }) => (
                  <Row
                    key={wq.id}
                    title={wq.source === 'official' ? wq.text!.slice(0, 120) + (wq.text!.length > 120 ? '…' : '') : `${wq.label}: ${wq.options[wq.correct]}`}
                    sub={wq.source === 'official' ? `${wq.label} · poprawna: ${'ABCD'[wq.correct]}. ${wq.options[wq.correct]}` : 'Odpowiedź z treści przepisu'}
                    to={wq.act && wq.artId ? `/ustawy/${wq.act}/${wq.artId}` : wq.refs?.[0] ? `/ustawy/${wq.refs[0].act}` : undefined}
                  />
                ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={TITLES[mode]} subtitle={subtitle} back={{ to: '/nauka', label: 'Nauka' }} />
      <div className="session-bar">
        <span className="t-foot muted num" aria-live="polite">
          {idx + 1} / {qs.length}
        </span>
        <ProgressBar value={idx / qs.length} label="Postęp sesji" />
        <span className="t-foot num" style={{ color: 'var(--green)' }}>
          {correctCount} ✓
        </span>
      </div>
      {q && <QuestionView key={q.id} q={q} selected={selected} reveal={reveal} onSelect={choose} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 10 }}>
        <span className="t-cap muted hide-mobile">
          Klawisze: <span className="kbd">1</span> <span className="kbd">2</span> <span className="kbd">3</span> wybór · <span className="kbd">Enter</span> dalej
        </span>
        <button type="button" className="btn primary" onClick={next} disabled={!reveal} style={{ marginLeft: 'auto', minWidth: 140 }}>
          {idx + 1 === qs.length ? 'Zakończ' : 'Dalej'}
          <Icon name="chevron" size={18} />
        </button>
      </div>
      {progress.settings.includeUnverified && (
        <div style={{ marginTop: 16 }}>
          <Notice kind="warn">Włączone są pytania oficjalne z kluczem do weryfikacji (Ustawienia).</Notice>
        </div>
      )}
    </div>
  );
}
