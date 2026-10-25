# Sędzia – nauka do konkursu na aplikację sędziowską KSSiP

**https://sedzia.wisnia.dev**

Aplikacja webowa (PWA) do przygotowania się do konkursu na aplikację sędziowską w Krajowej Szkole Sądownictwa i Prokuratury.

## Co zawiera

| Moduł | Zawartość |
| --- | --- |
| Oficjalne testy | 21 testów I etapu konkursów KSSiP z lat 2010–2026 (aplikacja ogólna, sędziowska i prokuratorska, uzupełniająca) – 3 063 pytania, z czego ponad 91% z kluczem potwierdzonym i kompletną treścią; podstawa prawna z klucza powiązana z aktualnym brzmieniem przepisu |
| Pytania z przepisów | ok. 13 200 pytań generowanych w przeglądarce z aktualnych tekstów ustaw (terminy, kwoty, właściwość sądu, organy, większości głosów, sankcje, skutki prawne, forma i tryb) – zawsze zgodnych z wersją z API Sejmu |
| Nauka | sesje według dziedzin z § 4 rozporządzenia, ustaw i zagadnień, powtórki w systemie Leitnera, lista błędów, symulacja egzaminu (150 pytań, 150 minut) |
| Ustawy | 28 aktów z wykazu na test 2026 (Komunikat nr 28/2026 Dyrektora KSSiP) + ustawa o KSSiP – teksty ujednolicone z API ELI Kancelarii Sejmu, TUE/TFUE z Urzędu Publikacji UE, EKPCz z tekstu Rady Europy; spis treści, wyszukiwarka, zakładki, aktualizacja z Sejmu bezpośrednio w przeglądarce |
| Kazusy | zadania II etapu z lat 2010–2025 z oficjalnymi kryteriami oceny, odliczanie 180 minut, miejsce na własne rozwiązanie |
| Nabór | terminy 2026, wymagania, zasady obu etapów, kwalifikacja, przebieg aplikacji, stypendium, egzamin sędziowski |
| Zarobki | kalkulator: aplikant (stypendium + podwyższenie wg miejsca zamieszkania), asesor (art. 106y u.s.p., ZUS), sędzia (stawki SR/SO/SA, wysługa, funkcje); PIT z rozliczeniem wspólnym, ulgą na dzieci, uczelnią z kosztami 50%, kilometrówka i delegacje; podstawa na nowy rok pobierana z komunikatu GUS przez API Sejmu |

## Uruchomienie

```bash
npm ci
npm run dev          # tryb deweloperski
npm test             # testy jednostkowe (parser ustaw, generator pytań, kalkulator)
npm run build        # build + prerender stron dla wyszukiwarek (dist/)
```

## Dane

```bash
npm run data:acts       # pobiera najnowsze teksty ustaw (API ELI, UE, Rada Europy)
npm run data:questions  # statystyki pytań generowanych z ustaw
```

Testy i kazusy KSSiP są skanami – narzędzia w `tools/ocr/` (macOS Vision) rozpoznają tekst, a klucze odczytują z siatki tabeli z korektą pochylenia skanu. Klucz uznaje się za potwierdzony, gdy zgadzają się dwie niezależne metody odczytu albo wiersz tabeli jest wyznaczony jednoznacznie.

## Wdrożenie

Serwer: nginx (`deploy/nginx-sedzia.wisnia.dev.conf`), aktualizacja codzienna przez `deploy/update.sh` (cron): pobranie kodu, ustaw z API Sejmu, build i atomowa podmiana `/var/www/sedzia`.

## Źródła

- API ELI Kancelarii Sejmu – https://api.sejm.gov.pl/eli_pl.html
- Krajowa Szkoła Sądownictwa i Prokuratury – https://www.kssip.gov.pl
- Urząd Publikacji UE – Dz.Urz. UE C 202 z 7.6.2016
- Rada Europy – tekst Konwencji o ochronie praw człowieka

Teksty ujednolicone mają charakter informacyjny; moc prawną mają akty ogłoszone w dziennikach urzędowych. Kalkulator ma charakter orientacyjny.

Aby włączyć GitHub Actions, skopiuj pliki z `deploy/github-actions/` do `.github/workflows/` (wymaga tokenu z uprawnieniem `workflow`, np. `gh auth refresh -s workflow`).
