import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArticleBody } from '../components/ArticleView';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading, Notice, PageHeader, Row, Section, Sheet, useToast } from '../components/ui';
import { ACT_BY_SLUG } from '../data/acts';
import { invalidateAct, loadAct, useAsync } from '../lib/data';
import { openPdfInBrowser } from '../lib/eli/browserPdf';
import { buildActFromEli } from '../lib/eli/buildAct';
import type { ActDoc, TocNode } from '../lib/eli/types';
import { clearGeneratedCache } from '../lib/questions/pool';
import { idbDelete, idbSet } from '../lib/storage/idb';
import { toggleBookmark, useProgress } from '../lib/storage/progress';

const WINDOW = 120;

function flattenToc(nodes: TocNode[], depth = 0, out: { node: TocNode; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ node: n, depth });
    flattenToc(n.children, depth + 1, out);
  }
  return out;
}

function TocList({ nodes, slug, onPick }: { nodes: TocNode[]; slug: string; onPick?: () => void }) {
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.id}>
          {n.firstArt ? (
            <Link to={`/ustawy/${slug}/${n.firstArt}`} onClick={onPick}>
              <strong style={{ fontWeight: 600 }}>{n.label}</strong>
              {n.title ? ` – ${n.title}` : ''}
            </Link>
          ) : (
            <span className="t-sub muted" style={{ display: 'block', padding: '6px 10px' }}>
              {n.label}
              {n.title ? ` – ${n.title}` : ''}
            </span>
          )}
          {n.children.length > 0 && <TocList nodes={n.children} slug={slug} onPick={onPick} />}
        </li>
      ))}
    </ul>
  );
}

export default function ActReader() {
  const { slug = '', artId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const def = ACT_BY_SLUG[slug];
  const doc = useAsync(() => loadAct(slug), [slug]);
  const progress = useProgress();
  const [query, setQuery] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const [start, setStart] = useState(0);
  const [updating, setUpdating] = useState<'idle' | 'working' | 'error'>('idle');
  const [updateMsg, setUpdateMsg] = useState('');

  const d: ActDoc | undefined = doc.data;
  const headingsAt = useMemo(() => {
    const m = new Map<string, TocNode[]>();
    if (!d) return m;
    for (const { node } of flattenToc(d.toc)) {
      if (!node.firstArt) continue;
      const arr = m.get(node.firstArt) ?? [];
      arr.push(node);
      m.set(node.firstArt, arr);
    }
    return m;
  }, [d]);

  const targetIndex = useMemo(() => (d && artId ? d.articles.findIndex((a) => a.id === artId) : -1), [d, artId]);

  useEffect(() => {
    if (targetIndex >= 0) setStart(Math.max(0, targetIndex - 20));
    else setStart(0);
  }, [targetIndex, slug]);

  useEffect(() => {
    if (!artId || targetIndex < 0) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(artId);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        el.classList.add('flash');
        window.setTimeout(() => el.classList.remove('flash'), 1800);
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [artId, targetIndex, start]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!d || needle.length < 2) return null;
    const num = needle.replace(/^art\.?\s*/, '');
    return d.articles.filter((a) => a.num.toLowerCase() === num || (a.title ?? '').toLowerCase().includes(needle) || a.lines.some((l) => l.text.toLowerCase().includes(needle)));
  }, [d, query]);

  const update = async () => {
    if (!def || def.source.kind !== 'eli') return;
    setUpdating('working');
    setUpdateMsg('Pobieram tekst ujednolicony z API Sejmu…');
    try {
      const fresh = await buildActFromEli(def, openPdfInBrowser, { withPending: true });
      await idbSet(`act:${slug}`, fresh);
      invalidateAct(slug);
      clearGeneratedCache(slug);
      setUpdating('idle');
      setUpdateMsg('');
      toast(`Zaktualizowano: stan na ${fresh.meta.textDate ?? fresh.meta.changeDate.slice(0, 10)}`);
      doc.reload();
    } catch (e) {
      setUpdating('error');
      setUpdateMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const resetLocal = async () => {
    await idbDelete(`act:${slug}`);
    invalidateAct(slug);
    clearGeneratedCache(slug);
    doc.reload();
    toast('Przywrócono wersję z serwera aplikacji');
  };

  if (!def) {
    return (
      <div className="page">
        <PageHeader title="Nie znaleziono ustawy" back={{ to: '/ustawy', label: 'Ustawy' }} />
        <Notice kind="warn">Tej ustawy nie ma w wykazie aplikacji.</Notice>
      </div>
    );
  }

  const visible = matches ?? d?.articles.slice(start, start + WINDOW) ?? [];
  const eliLink = def.source.kind === 'eli' ? `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=W${def.source.eli.replace(/^DU\/(\d+)\/(\d+)$/, (_, y: string, p: string) => `DU${y}${p.padStart(7, '0')}`)}` : def.source.kind === 'eu' ? 'https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX:12016M/TXT' : def.source.url;

  return (
    <div className="page wide">
      <PageHeader
        title={def.short}
        subtitle={def.title}
        back={{ to: '/ustawy', label: 'Ustawy' }}
        actions={
          <button type="button" className="icon-btn hide-desktop" onClick={() => setTocOpen(true)} aria-label="Spis treści">
            <Icon name="list" size={22} />
          </button>
        }
      />
      {doc.loading && <Loading lines={10} />}
      {doc.error ? <ErrorBox error={doc.error} retry={doc.reload} /> : null}
      {d && (
        <div className="reader">
          <aside className="reader-toc card pad hide-mobile" aria-label="Spis treści">
            <div className="t-headline" style={{ marginBottom: 8 }}>Spis treści</div>
            {d.toc.length ? <TocList nodes={d.toc} slug={slug} /> : <p className="t-sub muted">Akt bez podziału na jednostki.</p>}
          </aside>
          <div>
            <Section>
              <div className="list">
                <Row
                  icon="calendar"
                  title={`Stan prawny: ${d.meta.textDate ?? d.meta.changeDate.slice(0, 10)}`}
                  sub={d.meta.basedOn ? `Opracowano na podstawie: ${d.meta.basedOn}` : d.meta.textType === 'EU' ? 'Wersja skonsolidowana traktatów' : undefined}
                  chevron={false}
                />
                {d.meta.pendingChanges?.map((c) => (
                  <Row key={c.eli} icon="clock" iconColor="#c2410c" title={`Zmiana wejdzie w życie ${c.entryIntoForce ?? ''}`} sub={c.title} href={`https://api.sejm.gov.pl/eli/acts/${c.eli}/text.pdf`} />
                ))}
                {def.source.kind === 'eli' && (
                  <Row
                    icon="refresh"
                    iconColor="#0a84ff"
                    title={updating === 'working' ? updateMsg : 'Pobierz najnowszy tekst z Sejmu'}
                    sub={updating === 'error' ? `Błąd: ${updateMsg}` : params.get('aktualizuj') ? 'W API Sejmu jest nowsza wersja tego aktu.' : 'Tekst ujednolicony z API ELI, przetwarzany w przeglądarce'}
                    onClick={updating === 'working' ? undefined : () => void update()}
                    chevron={false}
                  />
                )}
                <Row icon="external" iconColor="#64748b" title="Źródło urzędowe" sub={def.source.kind === 'eli' ? `ISAP / ELI: ${def.source.eli}` : 'Urząd Publikacji UE / Rada Europy'} href={eliLink} />
                {d.meta.local && (
                  <Row icon="info" iconColor="#94a3b8" title="Wersja zapisana na urządzeniu" sub="Pobrana z Sejmu w przeglądarce – możesz wrócić do wersji z aplikacji" onClick={() => void resetLocal()} chevron={false} />
                )}
              </div>
            </Section>

            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', padding: '8px 0' }}>
              <div className="search-wrap">
                <Icon name="search" size={18} />
                <input className="search" type="search" placeholder={`Szukaj w ${def.abbr} (słowo lub numer artykułu)`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Szukaj w ustawie" />
              </div>
              {matches && (
                <p className="t-foot muted" style={{ margin: '6px 4px 0' }}>
                  Wyniki: {matches.length}
                </p>
              )}
            </div>

            <article className="card pad act-text" lang="pl">
              {!matches && start > 0 && (
                <button type="button" className="btn small" onClick={() => setStart((s) => Math.max(0, s - WINDOW))}>
                  Pokaż wcześniejsze artykuły
                </button>
              )}
              {visible.map((a) => {
                const heads = !matches ? headingsAt.get(a.id) : undefined;
                const bm = progress.bookmarks.includes(`${slug}:${a.id}`);
                return (
                  <Fragment key={a.id}>
                    {heads?.map((h) => (
                      <div key={h.id} className="act-heading">
                        <span className="lbl">{h.label}</span>
                        {h.title && <span className="ttl">{h.title}</span>}
                      </div>
                    ))}
                    <section id={a.id} className={`art${a.repealed ? ' repealed' : ''}`}>
                      <div className="art-head">
                        <span className="art-num">{a.id.startsWith('zal') ? a.num : `Art. ${a.num}.`}</span>
                        {a.title && <span className="art-title">{a.title}</span>}
                        <span className="art-actions">
                          <button
                            type="button"
                            aria-pressed={bm}
                            aria-label={bm ? 'Usuń zakładkę' : 'Dodaj zakładkę'}
                            onClick={() => {
                              toggleBookmark(`${slug}:${a.id}`);
                              toast(bm ? 'Usunięto zakładkę' : 'Dodano zakładkę');
                            }}
                          >
                            <Icon name="bookmark" size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label="Kopiuj link do artykułu"
                            onClick={() => {
                              const url = `${window.location.origin}${window.location.pathname}#/ustawy/${slug}/${a.id}`;
                              void navigator.clipboard?.writeText(`Art. ${a.num} ${def.abbr} – ${url}`).then(() => toast('Skopiowano odnośnik'));
                            }}
                          >
                            <Icon name="share" size={18} />
                          </button>
                        </span>
                      </div>
                      <ArticleBody art={a} query={matches ? query : undefined} />
                    </section>
                  </Fragment>
                );
              })}
              {!matches && d.articles.length > start + WINDOW && (
                <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={() => setStart((s) => s + WINDOW)}>
                  Pokaż kolejne artykuły ({Math.min(WINDOW, d.articles.length - start - WINDOW)})
                </button>
              )}
              {matches && matches.length === 0 && <p className="muted">Brak wyników dla „{query}”.</p>}
            </article>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => navigate(`/nauka/sesja?mode=act&act=${slug}`)}>
                <Icon name="learn" size={18} /> Pytania z tej ustawy
              </button>
            </div>
          </div>
        </div>
      )}
      <Sheet open={tocOpen} onClose={() => setTocOpen(false)} title="Spis treści">
        <div className="reader-toc">{d && <TocList nodes={d.toc} slug={slug} onPick={() => setTocOpen(false)} />}</div>
      </Sheet>
    </div>
  );
}
