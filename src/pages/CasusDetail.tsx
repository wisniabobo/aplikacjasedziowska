import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading, Notice, PageHeader, Row, Section, Segmented } from '../components/ui';
import { loadCasus, useAsync, type CasusPart } from '../lib/data';
import { saveCasusAnswer, useProgress } from '../lib/storage/progress';

const AREA_ORDER = ['prywatnego', 'cywilnego', 'publicznego', 'administracyjnego', 'karnego'];

function areaKey(p: CasusPart): string {
  const a = p.area ?? '';
  if (a === 'cywilnego') return 'prywatnego';
  if (a === 'administracyjnego') return 'publicznego';
  return a || 'inne';
}

const AREA_NAME: Record<string, string> = { prywatnego: 'Prawo prywatne', publicznego: 'Prawo publiczne', karnego: 'Prawo karne', inne: 'Zadania' };

const fmt = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function CasusDetail() {
  const { id = '' } = useParams();
  const doc = useAsync(() => loadCasus(id), [id]);
  const progress = useProgress();
  const tasks = useMemo(() => (doc.data?.tasks ?? []).filter((t) => t.title !== 'Wprowadzenie' || doc.data!.tasks.length === 1), [doc.data]);
  const keys = useMemo(() => {
    const ks = tasks.map(areaKey);
    return [...new Set(ks)].sort((a, b) => AREA_ORDER.indexOf(a) - AREA_ORDER.indexOf(b));
  }, [tasks]);
  const [tab, setTab] = useState<string>('');
  const [showCriteria, setShowCriteria] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (keys.length && !keys.includes(tab)) setTab(keys[0]!);
  }, [keys, tab]);
  useEffect(() => {
    setShowCriteria(false);
  }, [tab]);
  useEffect(() => {
    if (timerStart === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [timerStart]);

  const task = tasks.find((t) => areaKey(t) === tab);
  const criteria = useMemo(() => {
    const parts = doc.data?.criteria.flatMap((c) => c.parts) ?? [];
    const matched = parts.filter((p) => areaKey(p) === tab);
    return matched.length ? matched : parts.length && keys.length <= 1 ? parts : [];
  }, [doc.data, tab, keys.length]);
  const answerKey = `${id}:${tab}`;
  const remaining = timerStart ? 180 * 60 - (now - timerStart) / 1000 : null;

  return (
    <div className="page">
      <PageHeader title={doc.data ? `Kazusy ${doc.data.year}` : 'Kazusy'} subtitle={doc.data?.label} back={{ to: '/kazusy', label: 'Kazusy' }} />
      {doc.loading && <Loading lines={8} />}
      {doc.error ? <ErrorBox error={doc.error} retry={doc.reload} /> : null}
      {doc.data && (
        <>
          {keys.length > 1 && (
            <Section>
              <Segmented label="Zadanie" value={tab} onChange={setTab} options={keys.map((k) => ({ value: k, label: AREA_NAME[k] ?? k }))} />
            </Section>
          )}
          <Section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {timerStart === null ? (
                <button type="button" className="btn small" onClick={() => setTimerStart(Date.now())}>
                  <Icon name="timer" size={16} /> Start 180 minut
                </button>
              ) : (
                <>
                  <span className={`badge ${remaining !== null && remaining < 600 ? 'red' : 'tint'} num`} style={{ fontSize: 14 }}>
                    <Icon name="clock" size={14} /> {fmt(Math.max(0, remaining ?? 0))}
                  </span>
                  <button type="button" className="btn small plain" onClick={() => setTimerStart(null)}>
                    Zatrzymaj
                  </button>
                </>
              )}
              <a className="btn small plain" href={doc.data.source.tasks} target="_blank" rel="noopener noreferrer">
                Oryginał (PDF) <Icon name="external" size={14} />
              </a>
            </div>
          </Section>
          {task ? (
            <Section title={task.title}>
              <div className="card pad casus-text">
                {task.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Section>
          ) : (
            <Notice kind="warn">Nie udało się wyodrębnić treści zadania – otwórz oryginalny plik PDF.</Notice>
          )}
          <Section title="Twoje rozwiązanie" footer="Zapisuje się automatycznie na tym urządzeniu.">
            <textarea
              className="answer-box"
              value={progress.casus[answerKey] ?? ''}
              onChange={(e) => saveCasusAnswer(answerKey, e.target.value)}
              placeholder="Wskaż podstawę prawną, zakwalifikuj stan faktyczny, uzasadnij odpowiedzi na pytania z zadania…"
              aria-label="Twoje rozwiązanie"
            />
            <p className="t-cap muted" style={{ margin: '6px 4px 0' }}>
              Słowa: {((progress.casus[answerKey] ?? '').trim().match(/\S+/g) ?? []).length}
            </p>
          </Section>
          <Section title="Kryteria oceny KSSiP">
            {!showCriteria ? (
              <button type="button" className="btn block" onClick={() => setShowCriteria(true)} disabled={!criteria.length}>
                {criteria.length ? 'Pokaż kryteria i punktację' : 'Brak kryteriów dla tego zadania'}
              </button>
            ) : (
              <div className="card pad">
                {criteria.map((c, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div className="t-headline" style={{ marginBottom: 6 }}>{c.title}</div>
                    {c.paragraphs.map((p, j) => (
                      <p key={j} className="t-sub" style={{ margin: '0 0 8px', fontWeight: /\(\s*\d+\s*(do|-|–)\s*\d+\s*pkt|\bpkt\b/.test(p) && p.length < 40 ? 600 : 400 }}>
                        {p}
                      </p>
                    ))}
                  </div>
                ))}
                {doc.data.criteria.map((c) => (
                  <Row key={c.source} title="Kryteria – oryginał (PDF)" href={c.source} />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
