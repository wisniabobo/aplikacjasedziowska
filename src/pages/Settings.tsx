import { useRef } from 'react';
import { NumberRow, PageHeader, Row, Section, SwitchRow, useToast } from '../components/ui';
import { idbDelete, idbKeys } from '../lib/storage/idb';
import { getProgress, importProgress, resetProgress, updateSettings, useProgress } from '../lib/storage/progress';

export default function Settings() {
  const progress = useProgress();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(getProgress(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aplikacja-sedziowska-postepy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="page">
      <PageHeader title="Ustawienia" subtitle="Nauka, dane i informacje o aplikacji" back={{ to: '/', label: 'Start' }} />
      <Section title="Nauka">
        <div className="list">
          <NumberRow title="Dzienny cel" value={progress.settings.dailyGoal} onChange={(v) => updateSettings({ dailyGoal: Math.max(5, Math.round(v)) })} min={5} max={500} suffix="pytań" />
          <NumberRow title="Pytań w sesji" value={progress.settings.sessionSize} onChange={(v) => updateSettings({ sessionSize: Math.max(5, Math.round(v)) })} min={5} max={150} />
          <SwitchRow
            title="Pytania z kluczem do weryfikacji"
            sub="Dołączaj pytania oficjalne, których klucza nie potwierdziły obie metody odczytu"
            checked={progress.settings.includeUnverified}
            onChange={(v) => updateSettings({ includeUnverified: v })}
          />
        </div>
      </Section>
      <Section title="Twoje dane" footer="Postępy są przechowywane wyłącznie na tym urządzeniu. Eksport pozwala przenieść je na inne urządzenie.">
        <div className="list">
          <Row title="Eksportuj postępy (JSON)" onClick={exportData} chevron={false} />
          <Row title="Importuj postępy" onClick={() => file.current?.click()} chevron={false} />
          <Row
            title="Usuń ustawy pobrane z Sejmu na urządzeniu"
            sub="Wrócą wersje z serwera aplikacji"
            onClick={async () => {
              const keys = await idbKeys();
              await Promise.all(keys.map((k) => idbDelete(k)));
              toast(`Usunięto ${keys.length} zapisanych tekstów`);
            }}
            chevron={false}
          />
          <Row
            title="Wyzeruj postępy nauki"
            sub="Usuwa odpowiedzi, powtórki, wyniki egzaminów i zakładki"
            onClick={() => {
              if (window.confirm('Usunąć wszystkie postępy? Tej operacji nie można cofnąć.')) {
                resetProgress();
                toast('Postępy wyzerowane');
              }
            }}
            chevron={false}
          />
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            toast(importProgress(await f.text()) ? 'Zaimportowano postępy' : 'Nieprawidłowy plik');
            e.target.value = '';
          }}
        />
      </Section>
      <Section title="Źródła danych">
        <div className="list">
          <Row title="API ELI Kancelarii Sejmu" sub="Teksty ujednolicone ustaw, komunikaty GUS (Monitor Polski)" href="https://api.sejm.gov.pl/eli_pl.html" />
          <Row title="Krajowa Szkoła Sądownictwa i Prokuratury" sub="Testy, klucze, kazusy, kryteria oceny, komunikaty o naborze" href="https://www.kssip.gov.pl" />
          <Row title="Urząd Publikacji UE" sub="Wersje skonsolidowane TUE i TFUE" href="https://op.europa.eu" />
          <Row title="Rada Europy" sub="Tekst Konwencji o ochronie praw człowieka" href="https://www.echr.coe.int" />
          <Row title="Kod źródłowy" sub="github.com/wisniabobo/aplikacjasedziowska" href="https://github.com/wisniabobo/aplikacjasedziowska" />
        </div>
      </Section>
    </div>
  );
}
