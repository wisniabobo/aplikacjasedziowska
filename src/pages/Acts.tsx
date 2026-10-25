import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading, Notice, PageHeader, Row, Section } from '../components/ui';
import { ACT_BY_SLUG, GROUP_LABELS } from '../data/acts';
import { loadActIndex, loadDataUpdated, useAsync } from '../lib/data';
import type { ActGroup } from '../lib/eli/types';
import { useProgress } from '../lib/storage/progress';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const artNumFromId = (id: string) => id.replace(/^a/, '').replace(/_(\d+)/g, (_, d: string) => [...d].map((c) => SUP[Number(c)]).join('')).replace(/-/g, '–');

const GROUP_ORDER: ActGroup[] = ['ustroj', 'cywilne', 'pracy', 'gospodarcze', 'karne', 'administracyjne', 'ue'];

export default function Acts() {
  const idx = useAsync(loadActIndex, []);
  const updated = useAsync(loadDataUpdated, []);
  const progress = useProgress();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (idx.data ?? []).filter((a) => !needle || `${a.short} ${a.title} ${a.abbr}`.toLowerCase().includes(needle));
  }, [idx.data, q]);

  return (
    <div className="page">
      <PageHeader title="Ustawy" subtitle="Wykaz aktów prawnych objętych testem w 2026 r. – najnowsze teksty z API Sejmu" />
      <Section>
        <div className="search-wrap">
          <Icon name="search" size={18} />
          <input className="search" type="search" placeholder="Szukaj ustawy (np. k.p.c., prokuraturze)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Szukaj ustawy" />
        </div>
      </Section>

      {progress.bookmarks.length > 0 && !q && (
        <Section title="Zakładki">
          <div className="list">
            {progress.bookmarks.slice(0, 8).map((b) => {
              const [slug = '', artId = ''] = b.split(':');
              const def = ACT_BY_SLUG[slug];
              return <Row key={b} icon="bookmark" title={`Art. ${artNumFromId(artId)} ${def?.abbr ?? slug}`} sub={def?.short} to={`/ustawy/${slug}/${artId}`} />;
            })}
          </div>
        </Section>
      )}

      {idx.loading && <Loading lines={8} />}
      {idx.error ? <ErrorBox error={idx.error} retry={idx.reload} /> : null}
      {GROUP_ORDER.map((g) => {
        const items = filtered.filter((a) => a.group === g);
        if (!items.length) return null;
        return (
          <Section key={g} title={GROUP_LABELS[g]}>
            <div className="list">
              {items.map((a) => (
                <Row
                  key={a.slug}
                  title={a.short}
                  sub={`${a.wykazNo ? `poz. ${a.wykazNo} wykazu · ` : 'poza wykazem · '}${a.articles.toLocaleString('pl-PL')} art.${a.textDate ? ` · stan na ${a.textDate}` : ''}`}
                  value={a.abbr}
                  to={`/ustawy/${a.slug}`}
                />
              ))}
            </div>
          </Section>
        );
      })}
      <Notice>
        Teksty ujednolicone Kancelarii Sejmu (API ELI) są aktualizowane automatycznie
        {updated.data ? ` – ostatnio ${new Date(updated.data.updatedAt).toLocaleDateString('pl-PL', { dateStyle: 'long' })}` : ''}. W każdej ustawie możesz też pobrać najnowszą wersję bezpośrednio z Sejmu.
        Tekst ujednolicony ma charakter informacyjny; moc prawną mają teksty ogłoszone w Dzienniku Ustaw.
      </Notice>
    </div>
  );
}
