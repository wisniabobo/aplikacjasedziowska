import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ACT_BY_SLUG } from '../data/acts';
import { loadAct, useAsync } from '../lib/data';
import type { ActArticle } from '../lib/eli/types';
import { Icon } from './Icon';
import { Loading } from './ui';

function highlight(text: string, needle?: string) {
  if (!needle) return text;
  const i = text.indexOf(needle);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{needle}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

export function ArticleBody({ art, mark, lineIndex, query }: { art: ActArticle; mark?: string; lineIndex?: number; query?: string }) {
  return (
    <>
      {art.lines.map((ln, i) => (
        <div key={i} className={`unit l${ln.lvl}`}>
          {ln.mark && <span className="mk">{ln.mark}</span>}
          {i === lineIndex ? highlight(ln.text, mark) : query ? highlightQuery(ln.text, query) : ln.text}
        </div>
      ))}
      {art.notes?.map((n, i) => (
        <div key={`n${i}`} className="art-note">
          {n}
        </div>
      ))}
    </>
  );
}

export function highlightQuery(text: string, q: string) {
  if (!q || q.length < 2) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let pos = 0;
  let k = 0;
  for (;;) {
    const i = lower.indexOf(needle, pos);
    if (i < 0) break;
    parts.push(text.slice(pos, i), <span key={k++} className="hl">{text.slice(i, i + needle.length)}</span>);
    pos = i + needle.length;
  }
  parts.push(text.slice(pos));
  return parts;
}

/** Fragment ustawy jako wyjaśnienie pytania – zawsze w aktualnym brzmieniu z API Sejmu. */
export function ArticleSnippet({ act, artId, artNum, mark, lineIndex }: { act: string; artId?: string; artNum?: string; mark?: string; lineIndex?: number }) {
  const def = ACT_BY_SLUG[act];
  const doc = useAsync(() => loadAct(act), [act]);
  if (!def) return null;
  if (doc.loading) return <Loading lines={2} />;
  if (!doc.data) return null;
  const art = doc.data.articles.find((a) => (artId ? a.id === artId : a.num === artNum));
  if (!art) {
    return (
      <p className="t-sub muted" style={{ margin: 0 }}>
        Art. {artNum} {def.abbr} – brak w aktualnym tekście (przepis mógł zostać zmieniony lub uchylony).
      </p>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <strong>
          Art. {art.num} {def.abbr}
          {art.title ? ` – ${art.title}` : ''}
        </strong>
        <Link to={`/ustawy/${act}/${art.id}`} className="t-foot" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          W ustawie <Icon name="chevron" size={14} />
        </Link>
      </div>
      <div style={{ fontFamily: 'var(--font-serif)' }}>
        <ArticleBody art={art} mark={mark} lineIndex={lineIndex} />
      </div>
      <p className="t-cap muted" style={{ margin: '8px 0 0' }}>
        Brzmienie aktualne – stan na {doc.data.meta.textDate ?? doc.data.meta.changeDate?.slice(0, 10)} ({doc.data.meta.textType === 'U' ? 'tekst ujednolicony Kancelarii Sejmu' : 'tekst urzędowy'}).
      </p>
    </div>
  );
}
