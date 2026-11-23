# Scenariusze użycia Lśni

Dziesięć sytuacji z życia: kto korzysta z aplikacji, co chce zrobić i czego do tego potrzebuje. Każdy scenariusz przeszedłem w makiecie krok po kroku. Status mówi, co z tego wynikło:

- **Działało:** makieta obsługiwała scenariusz już wcześniej.
- **Dodane:** brakowało czegoś ważnego, więc zostało zbudowane w tej rundzie.
- **Na później:** wymaga prawdziwego backendu albo nie jest potrzebne na start.

Model biznesowy w tle: klient nic nie płaci w aplikacji i rozlicza się z wykonawcą na miejscu. Wykonawca płaci tylko za wyróżnienia.

---

## 1. Pierwsza rezerwacja na jutro

**Kto:** Kasia, 34 lata, Mokotów, mieszkanie 54 m². Pierwszy raz zamawia sprzątanie.

**Sytuacja:** w sobotę przychodzą goście, a ona nie ma czasu sprzątać. Wieczorem w tramwaju szuka kogoś na jutro rano.

**Kroki:** otwiera aplikację, wybiera „Mieszkanie”, przegląda profile, czyta opinie, sprawdza „Przed i po”, rezerwuje na 10:00 i wraca do aplikacji, gdy wykonawca potwierdzi.

**Potrzeby:**
- widzieć cenę przed rezerwacją, a nie „do ustalenia”,
- wiedzieć, że wykonawca jest sprawdzony,
- dostać potwierdzenie i przypomnienie,
- nie szukać potwierdzenia po całej aplikacji.

**Status:**
- Działało: wyszukiwanie, profil, wycena i rezerwacja.
- **Dodane: centrum powiadomień.** Dzwonek na ekranie głównym był atrapą. Teraz zbiera potwierdzenia, przypomnienia dzień przed wizytą, nowe oferty, odpowiedzi na zgłoszenia i prośby o ocenę. Ma licznik nieprzeczytanych i ustawienia przypomnień.

## 2. Sprzątanie u mamy, która nie używa aplikacji

**Kto:** Ania, 41 lat, zamawia sprzątanie dla mamy (82 lata) na ul. Odyńca.

**Sytuacja:** Ania pracuje, więc drzwi otworzy mama. Wykonawca musi wiedzieć, kogo zastanie, a mama musi wiedzieć, kto przyjdzie.

**Potrzeby:**
- rezerwacja pod innym adresem,
- osoba na miejscu z imieniem i telefonem,
- przypomnienie SMS dla tej osoby z imieniem wykonawcy.

**Status:**
- Działało: zapisane adresy, w tym „Mieszkanie mamy”.
- **Dodane: „Kto będzie na miejscu?”** w rezerwacji, z imieniem i telefonem osoby na miejscu. Po wybraniu adresu mamy pole wypełnia się samo. Informacja jest widoczna w szczegółach zlecenia.

## 3. Stałe sprzątanie i urlop

**Kto:** Michał, Ursynów, sprzątanie co 2 tygodnie u tej samej osoby od pół roku.

**Sytuacja:** wyjeżdża na tydzień w góry, a jedna wizyta wypada w czasie wyjazdu. Następną chce przesunąć o dzień.

**Potrzeby:**
- pominąć jedną wizytę bez rezygnowania z całej serii,
- przełożyć wizytę na inny wolny termin,
- żeby wykonawca od razu się o tym dowiedział.

**Status:**
- **Dodane:** przycisk „Przełóż” był atrapą. Teraz otwiera wybór nowego dnia i godziny z wolnych terminów wykonawcy, a dla wizyt cyklicznych dodatkowo „Pomiń tę wizytę”. Wykonawca dostaje informację, a potwierdzenie przychodzi jako powiadomienie.

## 4. Coś poszło nie tak

**Kto:** Kasia po wizycie.

**Sytuacja:** łazienka jest posprzątana niedokładnie i pękł wazon na półce.

**Potrzeby:**
- zgłosić problem ze zdjęciami,
- powiedzieć, czego oczekuje: poprawki, kontaktu albo tylko poinformowania,
- widzieć, co dzieje się ze zgłoszeniem.

Lśni nie pośredniczy w płatnościach, więc nie zwraca pieniędzy. Może za to przekazać zgłoszenie, pilnować 24 godzin na odpowiedź i uwzględniać zgłoszenia w pozycji wykonawcy w wynikach.

**Status:**
- **Dodane: formularz zgłoszenia** z rodzajem problemu, opisem, zdjęciami i oczekiwanym rozwiązaniem. W zleceniu pojawia się status zgłoszenia (wysłane → wykonawca odpowiedział → rozwiązane). Odpowiedź wykonawcy przychodzi w czacie.

## 5. Klient z zaproszenia od wykonawcy

**Kto:** pani Ewa, stała klientka Marty od 3 lat. Do tej pory umawiały się SMS-ami.

**Sytuacja:** Marta wysyła jej link do Lśni. Pani Ewa nie zna aplikacji i nie chce szukać innych wykonawców.

**Potrzeby:**
- strona z linku pokazuje od razu Martę, a nie wyszukiwarkę,
- jasne „co się zmienia, a co nie”: płatność bez zmian, dochodzi kalendarz i przypomnienia,
- rezerwacja jednym przyciskiem.

**Status:**
- **Dodane: ekran zaproszenia po stronie klienta.** Ten przepływ był kluczowy dla strategii pozyskiwania klientów, a wcześniej istniała tylko strona wykonawcy. Można go otworzyć z panelu bocznego, a wykonawca może z ekranu zaproszeń podejrzeć, co zobaczy klient.

## 6. Klient spoza obsługiwanego obszaru

**Kto:** Paweł mieszka w małej miejscowości pod Olsztynem.

**Sytuacja:** pobrał aplikację po poleceniu znajomej, ale nikt do niego nie dojeżdża. (Wcześniej przykładem były Ząbki, ale od kiedy aplikacja działa w całej Polsce, Ząbki to zwykły obszar z własnymi wykonawcami.)

**Potrzeby:**
- uczciwa informacja zamiast pustej listy,
- możliwość zapisania się, żeby dostać wiadomość, gdy usługa ruszy w jego okolicy.

To ważne przy starcie w całym kraju naraz, bo z listy oczekujących widać, w których miastach brakuje wykonawców i gdzie ich szukać najpierw.

**Status:**
- **Dodane: lista oczekujących.** Działa w wynikach i przy wyborze miejsca na mapie, gdy nikt nie dojeżdża pod wybrany adres. Lista zapisuje obszar (np. „Olsztyn (okolice)”), a zespół widzi w panelu, gdzie czeka najwięcej osób.

## 7. Wykonawca ustala szczegóły przed wizytą

**Kto:** Ola, wykonawczyni z Mokotowa.

**Sytuacja:** jutro ma nowego klienta. Chce zapytać o kod do domofonu i miejsce do zaparkowania.

**Potrzeby:**
- czat z klientem po stronie wykonawcy,
- szybkie odpowiedzi typu „Jestem w drodze” czy „Proszę o kod”,
- czat dostępny prosto z grafiku.

**Status:**
- **Dodane: działający czat wykonawcy.** Wcześniej w trybie wykonawcy był tylko komunikat zastępczy. Teraz są wątki z klientami, szybkie odpowiedzi, odpowiedzi klienta i przycisk „Czat” w grafiku.

## 8. Klient nie otwiera drzwi

**Kto:** Ola przyjechała na 9:00 na Mokotów. Nikt nie otwiera, telefon milczy.

**Potrzeby:**
- zgłosić nieobecność z zapisem czasu i miejsca,
- żeby to nie obniżyło jej oceny,
- żeby klient z powtarzającymi się nieobecnościami nie mógł dalej rezerwować bez konsekwencji.

**Status:**
- **Dodane: „Klient nie otworzył”** przy zleceniu w grafiku. Zgłoszenie ma instrukcję (odczekaj 15 minut, zadzwoń), zapisuje czas i odległość od adresu, a zlecenie dostaje oznaczenie.
- Na później: blokada rezerwacji po dwóch nieobecnościach wymaga backendu.

## 9. Wykonawca chce się wyróżnić w mieście obok

**Kto:** Ola z Warszawy chce więcej klientów w Piasecznie.

**Kroki:** otwiera Wyróżnienia i widzi, że Piaseczno jest poza jej zasięgiem. Zmienia zasięg w Obszarze pracy, wraca i kupuje wyróżnienie z kredytu.

**Status:**
- Działało: komunikat o mieście poza zasięgiem, edytor zasięgu, ceny zależne od popytu, kredyt i gwarancja wyświetleń.

## 10. Biuro szuka stałej firmy sprzątającej

**Kto:** biuro rachunkowe na Woli, 120 m², sprzątanie 3 razy w tygodniu po 18:00.

**Potrzeby:**
- faktura VAT,
- wykonawca z polisą OC,
- stałe terminy po godzinach,
- docelowo kilka osób z firmy z dostępem do jednego konta.

**Status:**
- Działało: filtr „Faktura VAT” i „Polisa OC”, giełda zleceń z opisem, płatność na fakturę.
- Na później: konto firmowe z kilkoma użytkownikami i zbiorcze zestawienia.

---

## Niespójności znalezione przy okazji

Przy przechodzeniu scenariuszy wyszły teksty, które zostały z czasów płatności w aplikacji:

- w Wiadomościach: „płać tylko w aplikacji… zwrot pieniędzy”,
- po odwołaniu wizyty: „pieniądze wracają na konto”.

Oba są poprawione.

## Backend: co zostało zrobione

Pozycje, które makieta potrzebowała od serwera. Szczegóły są w [server/README.md](server/README.md).

| Obszar | Stan |
|---|---|
| Konta | **Zrobione.** Logowanie kodem SMS, limity prób, sesje, eksport danych i usunięcie konta (RODO). |
| Powiadomienia | **Zrobione:** w aplikacji i SMS, w tym przypomnienie dla osoby na miejscu. **Do podpięcia:** push i e-mail (wymagają aplikacji natywnej i dostawcy poczty). |
| Weryfikacja | **Zrobione:** przesyłanie dokumentów, decyzja w panelu zespołu, webhook dostawcy z podpisem HMAC. **Do podpięcia:** konto u dostawcy (np. Veriff, Onfido). |
| Telefon | **Zrobione:** sesje z PIN-em i endpoint dla bramki telefonicznej. **Do podpięcia:** numer u operatora z IVR. |
| Zgłoszenia | **Zrobione:** zgłoszenia ze zdjęciami, odpowiedź wykonawcy, eskalacja po 24 h, nieobecności i panel zespołu do ich obsługi. |
| Opinie | **Zrobione:** automatyczna moderacja, moderacja w panelu, publiczne odpowiedzi wykonawców. |
| Mapa | **Zrobione:** Mapbox (prawdziwa mapa, wyszukiwanie adresów, czasy dojazdu po drogach, trasy) w całej Polsce, z podziałem na ok. 115 miast (bez dzielnic). **Do podpięcia:** dokładne granice z PRG. |
| Prawo | **Projekty gotowe:** regulamin, polityka prywatności i zasady rankingu w `server/legal/`. **Wymagają sprawdzenia przez prawnika.** DAC7 do potwierdzenia z księgową. |
| Płatności za wyróżnienia | **Do podpięcia:** zakup z kredytu działa. Dopłata ponad kredyt zwraca kwotę do zapłaty i czeka na operatora (Przelewy24 lub Stripe). |
| Giełda zleceń z ofertami | **Na później:** w trybie online działa jeszcze lokalnie (dane demo). |
