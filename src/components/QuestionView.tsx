import { ACT_BY_SLUG } from '../data/acts';
import { AREA_SHORT } from '../data/exam';
import { KIND_LABELS } from '../lib/questions/generator';
import type { UIQuestion } from '../lib/questions/pool';
import { ArticleSnippet } from './ArticleView';
import { Icon } from './Icon';

const LETTERS = ['A', 'B', 'C'] as const;

export function QuestionText({ q }: { q: UIQuestion }) {
  if (q.source === 'official') return <p className="q-text">{q.text}</p>;
  const def = q.act ? ACT_BY_SLUG[q.act] : undefined;
  const before = q.before ?? '';
  // kontekst jednostki nadrzędnej (zdanie wprowadzające) oddzielamy wizualnie
  const ctxEnd = before.lastIndexOf(' … ');
  const ctx = ctxEnd >= 0 ? before.slice(0, ctxEnd + 3) : '';
  const lead = ctxEnd >= 0 ? before.slice(ctxEnd + 3) : before;
  return (
    <p className="q-text">
      <span className="q-context">Zgodnie z {def?.short ?? 'ustawą'}: </span>
      {ctx && <span className="q-context">{ctx}</span>}
      {lead}
      <span className="blank" aria-label="luka">
        {' ? '}
      </span>
      {q.after}
    </p>
  );
}

export function QuestionMeta({ q, hideSource }: { q: UIQuestion; hideSource?: boolean }) {
  return (
    <div className="q-meta">
      {!hideSource && <span className={`badge ${q.source === 'official' ? 'tint' : ''}`}>{q.source === 'official' ? q.label : 'Z przepisów'}</span>}
      {q.area && <span className="badge">{AREA_SHORT[q.area]}</span>}
      {q.kind && <span className="badge">{KIND_LABELS[q.kind]}</span>}
      {q.source === 'official' && !q.verified && <span className="badge orange">Klucz do weryfikacji</span>}
    </div>
  );
}

interface Props {
  q: UIQuestion;
  selected: number | null;
  reveal: boolean;
  onSelect: (i: number) => void;
  showExplanation?: boolean;
}

export function QuestionView({ q, selected, reveal, onSelect, showExplanation = true }: Props) {
  return (
    <div className="card qcard">
      <QuestionMeta q={q} />
      <QuestionText q={q} />
      <div className="options" role="radiogroup" aria-label="Odpowiedzi">
        {q.options.map((opt, i) => {
          let cls = 'option';
          if (reveal) {
            if (i === q.correct) cls += ' correct';
            else if (i === selected) cls += ' wrong';
          } else if (i === selected) cls += ' selected';
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === selected}
              className={cls}
              onClick={() => onSelect(i)}
              disabled={reveal}
            >
              <span className="letter" aria-hidden="true">
                {reveal && i === q.correct ? <Icon name="check" size={16} /> : reveal && i === selected ? <Icon name="x" size={16} /> : LETTERS[i]}
              </span>
              <span>
                <span className="visually-hidden">{LETTERS[i]}. </span>
                {opt}
                {reveal && i === q.correct && <span className="visually-hidden"> – poprawna odpowiedź</span>}
              </span>
            </button>
          );
        })}
      </div>
      {reveal && showExplanation && <Explanation q={q} />}
    </div>
  );
}

export function Explanation({ q }: { q: UIQuestion }) {
  if (q.source === 'generated' && q.act) {
    return (
      <div className="explain">
        <ArticleSnippet act={q.act} artId={q.artId} mark={q.options[q.correct]} lineIndex={q.line} />
      </div>
    );
  }
  return (
    <div className="explain">
      <div style={{ marginBottom: q.refs?.length ? 10 : 0 }}>
        <strong>Podstawa prawna z klucza KSSiP:</strong> {q.basis || 'brak w kluczu'}
        {q.year && (
          <div className="t-foot muted" style={{ marginTop: 4 }}>
            Pytanie z konkursu w {q.year} r. – odpowiedź według stanu prawnego z dnia egzaminu.
          </div>
        )}
        {!q.verified && (
          <div className="t-foot" style={{ marginTop: 4, color: 'var(--orange)' }}>
            Klucz odczytany automatycznie ze skanu – sprawdź w oryginale KSSiP przed zapamiętaniem.
          </div>
        )}
      </div>
      {q.refs?.slice(0, 2).map((r) => (
        <div key={`${r.act}-${r.art}`} style={{ borderTop: '0.5px solid var(--separator)', paddingTop: 10, marginTop: 10 }}>
          <ArticleSnippet act={r.act} artNum={r.art} />
        </div>
      ))}
    </div>
  );
}
