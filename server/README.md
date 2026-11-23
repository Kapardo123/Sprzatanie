# Lśni: serwer

Backend aplikacji Lśni. Obsługuje konta, rezerwacje, powiadomienia, czat, zgłoszenia, opinie, weryfikację wykonawców, wyróżnienia i panel zespołu. Serwuje też aplikację (`index.html`, `app.js`, `api.js` z katalogu nadrzędnego). Otwarta z serwera aplikacja sama przechodzi w tryb online.

## Uruchomienie

Wymagany Node.js 22.5 lub nowszy. Baza to wbudowany `node:sqlite`. Jedyna zależność z npm to `mapbox-gl` (pliki biblioteki mapy dla przeglądarki).

```bash
cd server
npm install        # tylko biblioteka Mapbox GL JS
npm start          # http://localhost:8080
npm test           # 24 testy całych ścieżek, w tym integracja z Mapbox na udawanym API
npm run seed       # wyczyść bazę i wgraj dane startowe od nowa
```

Przy pierwszym starcie w trybie deweloperskim wgrywają się dane startowe: 13 wykonawców w Warszawie, rezerwacje, opinie i wyróżnienia. Konta testowe (kod SMS w trybie deweloperskim pokazuje się w konsoli i od razu wpisuje w aplikacji):

| Kto | Telefon |
|---|---|
| Klientka Kasia | 500 100 200 |
| Wykonawczyni Ola | 500 100 300 |
| Zespół Lśni (panel `/admin`) | 500 100 999 |

W trybie deweloperskim wykonawcy z danych startowych sami potwierdzają rezerwacje i odpowiadają w czacie oraz na zgłoszenia. Dzięki temu całą ścieżkę da się przejść bez drugiej osoby. Na produkcji ta symulacja jest wyłączona.

## Co jest zrobione

| Obszar | Jak działa |
|---|---|
| **Konta** | Logowanie kodem SMS (6 cyfr, ważny 5 minut, najwyżej 5 prób). Limit wysyłki: 3 kody na numer w 10 minut i 20 na adres IP na godzinę. Kody i tokeny w bazie tylko jako skróty SHA-256. Sesja ważna 60 dni. |
| **RODO** | Eksport danych (`GET /api/me/export`) i usunięcie konta z anonimizacją (`DELETE /api/me`). |
| **Wyszukiwanie** | Odległość i czas dojazdu od adresu klienta, zasięg wykonawcy i dopłata za dojazd, filtry, sortowanie, najwyżej 2 profile „Promowane” z rotacją. Każde wyszukiwanie zasila statystykę popytu w dzielnicy. |
| **Rezerwacje** | Cena liczona na serwerze. Kontrola wolnych terminów i godzin pracy. Statusy: zapytanie, potwierdzona, w drodze, w trakcie, zakończona, odwołana, odrzucona, nieobecność. Przełożenie, pominięcie wizyty w serii, automatyczna następna wizyta w stałym sprzątaniu, ewidencja późnych odwołań. |
| **Prywatność** | Kod do drzwi wykonawca widzi dopiero 2 godziny przed wizytą. Numery maskowane (PIN do bramki telefonicznej). |
| **Powiadomienia** | W aplikacji, plus SMS dla ważnych zdarzeń (nowe zapytanie, odwołanie, nieobecność, przypomnienie dzień przed). Przypomnienie SMS dostaje też osoba na miejscu. Użytkownik ustawia kanały. |
| **Czat** | Wątek klient–wykonawca. Wykonawca może pisać tylko do swoich klientów. Wiadomości z danymi kontaktowymi są oznaczane. |
| **Zgłoszenia** | Kategoria, opis, zdjęcia (do 4 MB, prywatne), oczekiwane rozwiązanie. Odpowiedź wykonawcy trafia do czatu. Bez odpowiedzi po 24 h zgłoszenie automatycznie przechodzi do zespołu. |
| **Nieobecności** | Wykonawca zgłasza je najwcześniej 15 minut po godzinie wizyty. Po 2 nieobecnościach klient nie może rezerwować. Zespół może zgłoszenie odrzucić. |
| **Opinie** | Tylko po zakończonej wizycie, jedna na wizytę. Automatyczna moderacja: telefon, e-mail, link albo wulgaryzm kierują opinię do ręcznej moderacji. Wykonawca może raz odpowiedzieć publicznie. |
| **Weryfikacja** | Wykonawca przesyła dowód z selfie albo polisę OC. Decyzję podejmuje zespół w panelu albo zewnętrzny dostawca przez webhook podpisany HMAC. |
| **Wyróżnienia** | Cena zależna od popytu w dzielnicy, tylko dzielnice w zasięgu, opłata z kredytu. Gwarancja wyświetleń: po zakończeniu kredyt wraca proporcjonalnie. Liczymy wyświetlenia, wejścia w profil i zapytania. |
| **Kredyt i zaproszenia** | 50 zł na start, 20 zł za klienta z linku `/z/<kod>` po jego pierwszej zakończonej wizycie. |
| **Lista oczekujących** | Zapis spoza obsługiwanego obszaru. Gdy wykonawca zacznie dojeżdżać w okolicę, osoba z listy dostaje powiadomienie. |
| **Panel zespołu** | `/admin`: przegląd, zgłoszenia ze zdjęciami, nieobecności, weryfikacje z podglądem dokumentów, moderacja opinii, blokowanie kont, lista oczekujących, dziennik działań i wysłane SMS-y. Każda decyzja trafia do dziennika. |
| **Dokumenty** | Projekty regulaminu, polityki prywatności i zasad rankingu w `legal/`, dostępne pod `/legal/regulamin`, `/legal/prywatnosc`, `/legal/ranking`. **Wymagają sprawdzenia przez prawnika.** |

## Integracje: co trzeba podpiąć na produkcji

| Usługa | Stan | Co zrobić |
|---|---|---|
| SMS | Gotowy moduł SMSAPI.pl | Założyć konto, ustawić `SMS_PROVIDER=smsapi`, `SMSAPI_TOKEN`, zarejestrować nadawcę `SMS_SENDER`. |
| Weryfikacja tożsamości | Ręcznie w panelu działa od razu. Webhook gotowy. | Wybrać dostawcę (np. Veriff, Onfido, Identomat). Ustawić `KYC_WEBHOOK_SECRET`. Dopisać wysyłkę zleceń do dostawcy (wynik wraca na `/api/kyc/webhook`). |
| Numery maskowane | Sesje i PIN-y gotowe | Kupić numer u operatora z IVR (np. Twilio, Vonage). Bramka po wpisaniu PIN-u pyta `POST /api/calls/route` z nagłówkiem `X-Calls-Secret`. |
| Powiadomienia push | Zapis w aplikacji działa. Kanał push nie jest podpięty. | Po przejściu na aplikację natywną: Firebase Cloud Messaging lub APNs w `src/services/notify.js`. |
| E-mail | Nie podpięty | Np. Postmark lub Amazon SES w `src/services/notify.js`. |
| Płatność za wyróżnienia ponad kredyt | API zwraca `402 payment_required` z brakującą kwotą | Podpiąć Przelewy24 albo Stripe i dopisywać wpłatę do `credit_ledger`. |
| Mapy | Gotowa integracja z Mapbox (opis niżej) | Założyć konto Mapbox i ustawić `MAPBOX_TOKEN`. Opcjonalnie: prawdziwe granice dzielnic w `DATA_DIR/dzielnice-warszawy.geojson`. |

## Mapy (Mapbox)

Po ustawieniu `MAPBOX_TOKEN` aplikacja online pokazuje prawdziwą mapę Mapbox zamiast schematu, a serwer używa API Mapbox:

| Gdzie | Co daje | API Mapbox |
|---|---|---|
| Wybór adresu | Podpowiedzi prawdziwych adresów z numerami, adres pod pinezką przy przesuwaniu mapy, zapis z dokładnymi współrzędnymi | Search / Geocoding v6 (forward, reverse) |
| Wyniki, profil, wycena, rezerwacja | Odległość i czas dojazdu po prawdziwych drogach. Od nich zależy zasięg i dopłata za dojazd. | Matrix (do 24 wykonawców w jednym zapytaniu) |
| Śledzenie dojazdu | Trasa po ulicach i auto przesuwające się po niej, czas do przyjazdu | Directions |
| Trasa dnia wykonawcy | Kolejne wizyty po drogach, kilometry i czasy odcinków | Directions (do 25 punktów) |
| Mapy w aplikacji | Mapa okolicy z warstwami dzielnic, wyszukiwarka z pinezkami i zasięgiem, „Szukaj w tym obszarze”, obszar pracy, wyróżnienia. Jasny i ciemny styl zależnie od motywu. | Mapbox GL JS v3, style `light-v11` / `dark-v11` |
| Podglądy na ekranie głównym i w ogłoszeniu | Lekki obrazek zamiast pełnej mapy | Static Images |

**Jak to chroni limity i działa bez przerw:**
- Każda odpowiedź Mapbox trafia do pamięci podręcznej w bazie: adresy na 30 dni, trasy na godzinę, czasy dojazdu na 10 minut.
- Każde zapytanie ma limit czasu `MAPBOX_TIMEOUT_MS` (domyślnie 2,5 s). Gdy Mapbox nie odpowie, serwer liczy odległość w linii prostej × 1,3, a aplikacja oznacza wynik jako szacunek.
- Trasy są dostępne tylko dla zalogowanych.
- Bez tokenu wszystko działa jak wcześniej, na schematycznej mapie.

**Tokeny.** Utwórz w panelu Mapbox dwa tokeny:
- `MAPBOX_TOKEN`: publiczny (`pk.…`) z ograniczeniem do adresu Twojej domeny (URL restrictions). Trafia do przeglądarki.
- `MAPBOX_SERVER_TOKEN`: osobny, bez ograniczenia adresu, z zakresami do geokodowania i tras. Używa go tylko serwer. Jeśli go nie ustawisz, serwer użyje `MAPBOX_TOKEN`.

**Granice dzielnic.** Domyślnie są przybliżone: obszary wokół środków dzielnic przycięte do obrysu miasta. Żeby mieć prawdziwe granice, zapisz plik GeoJSON dzielnic Warszawy (np. z PRG lub OpenStreetMap, z właściwością `name` taką jak w aplikacji, np. „Praga-Płd.”) jako `DATA_DIR/dzielnice-warszawy.geojson`.

**Koszty.** Mapbox ma darmowe limity miesięczne dla każdego z tych API (szczegóły w cenniku Mapbox). Pamięć podręczna i jedno zapytanie Matrix na wyszukiwanie mocno ograniczają zużycie.

Biblioteka Mapbox GL JS jest serwowana z `node_modules` pod `/vendor/`. Gdy jej nie ma, aplikacja pobiera ją z oficjalnego CDN Mapbox.

## Konfiguracja

Skopiuj `.env.example` i uzupełnij. Na produkcji (`NODE_ENV=production`) serwer nie wystartuje bez `OTP_PEPPER`, `KYC_WEBHOOK_SECRET` i `CALLS_SECRET`, a kody SMS nigdy nie wracają w odpowiedzi API.

## Wdrożenie

```bash
docker build -t lsni .          # w katalogu głównym repozytorium
docker run -p 8080:8080 -v lsni-data:/data --env-file server/.env lsni
```

Baza i przesłane pliki leżą w `DATA_DIR` (w kontenerze `/data`). Rób kopie zapasowe tego katalogu.

SQLite wystarczy na start w jednym mieście i na jednym serwerze. Przy kilku instancjach przejdź na PostgreSQL. Cały SQL jest w modułach `src/routes/*` i `src/db.js`, a składnia jest w większości przenośna.

## API w skrócie

Wszystkie odpowiedzi są w JSON. Błędy mają postać `{ "error": { "code", "message" } }`, z komunikatami po polsku. Uwierzytelnianie: nagłówek `Authorization: Bearer <token>`.

| Metoda i ścieżka | Kto | Opis |
|---|---|---|
| `POST /api/auth/code` · `POST /api/auth/verify` · `POST /api/auth/logout` | wszyscy | Logowanie kodem SMS (`ref` = kod zaproszenia) |
| `GET/PATCH/DELETE /api/me` · `GET /api/me/export` | zalogowany | Konto, ustawienia powiadomień, RODO |
| `POST /api/addresses` · `DELETE /api/addresses/:id` | zalogowany | Adresy (tylko w Warszawie) |
| `GET /api/providers` · `GET /api/providers/:id` · `GET /api/providers/:id/slots` | wszyscy | Wyszukiwanie, profil, wolne terminy |
| `POST /api/quote` | wszyscy | Wycena z dopłatą za dojazd |
| `GET /api/config` | wszyscy | Token publiczny Mapbox i style map |
| `GET /api/geo/search` · `/reverse` · `/districts` · `/districts/shapes` | wszyscy | Wyszukiwanie adresów, adres z punktu, statystyki i granice dzielnic |
| `GET /api/geo/route` · `GET /api/bookings/:id/route` | zalogowany | Trasa po drogach |
| `POST /api/bookings` · `GET /api/bookings` · `GET /api/bookings/:id` | zalogowany | Rezerwacje (`?as=provider` dla wykonawcy) |
| `POST /api/bookings/:id/cancel` · `/reschedule` · `/skip` · `/call` | klient | Odwołanie, zmiana terminu, pominięcie, numer maskowany |
| `POST /api/bookings/:id/accept` · `/decline` · `/status` · `/noshow` | wykonawca | Obsługa zlecenia |
| `GET /api/threads` · `GET/POST /api/threads/:peer/messages` | zalogowany | Czat |
| `GET /api/notifications` · `POST /api/notifications/read` | zalogowany | Powiadomienia |
| `POST /api/reports` · `POST /api/reports/:id/answer` · `/resolve` | klient / wykonawca | Zgłoszenia |
| `POST /api/reviews` · `POST /api/reviews/:id/reply` · `GET /api/pro/reviews` | klient / wykonawca | Opinie |
| `POST /api/pro/profile` · `GET /api/pro/me` · `GET /api/pro/dashboard` · `GET /api/pro/day` | wykonawca | Profil, panel, trasa dnia |
| `PATCH /api/pro/availability` · `POST /api/pro/online` · `POST /api/pro/verification` | wykonawca | Dostępność, weryfikacja |
| `GET/POST /api/pro/boosts` · `GET /api/pro/invite` | wykonawca | Wyróżnienia, kredyt, zaproszenia |
| `GET /api/invite/:code` · `POST /api/waitlist` · `GET /api/legal/:doc` | wszyscy | Zaproszenie, lista oczekujących, dokumenty |
| `GET/POST /api/admin/*` | zespół | Panel zespołu |
| `POST /api/kyc/webhook` · `POST /api/calls/route` | integracje | Webhook weryfikacji (HMAC), bramka telefoniczna |
