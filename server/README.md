# Lśni: serwer

Backend aplikacji Lśni. Obsługuje konta, rezerwacje, powiadomienia, czat, zgłoszenia, opinie, weryfikację wykonawców, wyróżnienia i panel zespołu. Serwuje też aplikację (`index.html`, `app.js`, `api.js` z katalogu nadrzędnego). Otwarta z serwera aplikacja sama przechodzi w tryb online.

## Uruchomienie

Wymagany Node.js 22.5 lub nowszy. Serwer nie ma zależności z npm: używa wbudowanego `node:sqlite`.

```bash
cd server
npm start          # http://localhost:8080
npm test           # 18 testów całych ścieżek na bazie w pamięci
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
| Mapy | Geometria Warszawy uproszczona (środki dzielnic, obrys miasta, słownik ulic) | Geokodowanie adresów (Google, Mapbox lub Nominatim na własnym serwerze), granice dzielnic z PRG, kafelki map w aplikacji. |

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
| `GET /api/geo/streets` · `/reverse` · `/districts` | wszyscy | Podpowiedzi ulic, adres z punktu, statystyki dzielnic |
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
