# Lśni

Marketplace usług sprzątania: klienci znajdują i rezerwują wykonawców w okolicy, a wykonawcy publikują ogłoszenia i przyjmują zlecenia. Repozytorium zawiera aplikację (makietę z warstwą online) i backend.

## Uruchomienie

**Z serwerem (tryb online):** prawdziwe konta, baza danych i rezerwacje. Wymaga Node.js 22.5 lub nowszego.

```bash
cd server
npm start
# aplikacja: http://localhost:8080   panel zespołu: http://localhost:8080/admin
```

Logowanie kodem SMS. W trybie deweloperskim kod pojawia się w konsoli i sam wpisuje się w aplikacji. Konta testowe: klientka **500 100 200**, wykonawczyni **500 100 300**, zespół **500 100 999**. Szczegóły, integracje i wdrożenie opisuje [server/README.md](server/README.md).

**Bez serwera (tryb demo):** otwórz `index.html` w przeglądarce. Dane są przykładowe i zapisują się tylko w przeglądarce.

Na komputerze aplikacja wyświetla się w ramce telefonu, a na telefonie na pełnym ekranie. W trybie demo przełącznik „Tryb klienta / Tryb wykonawcy” jest w panelu po lewej, a w aplikacji w zakładce Profil.

## Co działa

**Klient**
- Odkrywanie: kategorie usług, wolne terminy jeszcze dziś, polecani w okolicy, najbliższa wizyta
- Wyszukiwanie z filtrami (stawka, ocena, OC, własne środki, eco, zwierzęta, faktura VAT, wolne dziś) i sortowaniem
- Profil wykonawcy: statystyki, weryfikacja, cennik, dostępność na 7 dni, zakres standardu, opinie
- Rezerwacja w 4 krokach: zakres (metraż, pokoje, łazienki, dodatki) z wyceną na żywo, termin i cykliczność z rabatem, adres i sposób wejścia, podsumowanie z kwotą do zapłaty na miejscu
- Zlecenia: status na osi czasu (z symulacją „w drodze”), odwołanie z zasadami 24 h, zatwierdzenie usługi, ocena z napiwkiem, ponowne zamówienie
- Dodanie zlecenia (opis, zdjęcia, termin, budżet), na które wykonawcy przysyłają oferty na żywo; porównanie ofert (najtańsza, najwyżej oceniana, najszybciej) i wybór jednej
- Sprzątanie na żywo: checklista pokój po pokoju odhaczana w trakcie wizyty, a po zakończeniu raport z czasem pracy i uwagami wykonawcy
- Czat z wykonawcą z szybkimi odpowiedziami
- Ulubieni wykonawcy

**Wykonawca**
- Panel: zarobki w tygodniu, nowe zapytania (przyjmij lub odrzuć z możliwością cofnięcia), statystyki ogłoszenia, lista rzeczy do uzupełnienia w profilu
- Giełda zleceń w okolicy: wysłanie oferty z ceną (z kwotą po prowizji), terminem i wiadomością
- Grafik: zlecenia na dany dzień i stała dostępność w tygodniu
- Edytor ogłoszenia z podglądem na żywo: usługi, stawka na tle średniej w dzielnicy, prognoza zarobków, obszar dojazdu, udogodnienia, zdjęcia, weryfikacja

Dane są przykładowe i zapisują się w `localStorage` przeglądarki. Link „Zresetuj dane demo” przywraca stan początkowy.

## Model biznesowy (na start)

- **Klient nic nie płaci w aplikacji.** Rezerwuje termin, a z wykonawcą rozlicza się na miejscu: gotówką, BLIK-iem na telefon lub przelewem.
- **Wykonawca nie płaci prowizji ani abonamentu.** Płaci tylko za **wyróżnienie**: wyższą pozycję w wybranych dzielnicach z oznaczeniem „Promowane”, najwyżej 2 profile naraz.
- **Cena wyróżnienia zależy od popytu w dzielnicy**, np. Mokotów około 37 zł/tydz., Targówek około 13 zł/tydz. Każde wyróżnienie ma gwarancję liczby wyświetleń, a jeśli nie zostanie spełniona, kredyt wraca.
- **Kredyt na wyróżnienia:** 50 zł na start oraz 20 zł za każdego własnego klienta, którego wykonawca przyprowadzi do aplikacji swoim linkiem lub kodem QR. W ten sposób wykonawcy ściągają klientów.
- Ekran „Jak ustalamy kolejność” wyjaśnia ranking i oznaczenie „Promowane” (wymóg przejrzystości wobec konsumentów).

## Lokalizacja

Aplikacja ma uproszczony model Warszawy w kilometrach: 12 dzielnic (komórki Woronoja przycięte do granic miasta), Wisłę, główne ulice i parki. Mapy są rysowane w SVG, bez zewnętrznych usług. Można je przesuwać, przybliżać kółkiem albo dwoma palcami.

**Klient**
- Wybór adresu: wyszukiwarka ulic, zapisane adresy i wskazywanie miejsca pinezką na mapie. Przy każdym adresie widać, ilu wykonawców tam dojeżdża.
- Odległość i czas dojazdu każdego wykonawcy liczone od wybranego adresu. Wykonawcy poza zasięgiem są ukryci, a ci tuż za granicą zasięgu pokazują dopłatę za dojazd, która trafia do wyceny.
- Mapa okolicy z warstwami: wykonawcy, ceny, wolne terminy dziś i popyt. Po dotknięciu dzielnicy widać jej statystyki i najlepiej ocenianych wykonawców.
- Wyszukiwarka z mapą: zasięg wybranego wykonawcy, „Szukaj w tym obszarze”, filtr odległości.
- Śledzenie dojazdu wykonawcy na mapie z odliczaniem czasu. Po dojeździe zlecenie samo przechodzi w „W trakcie”.

**Wykonawca**
- Edytor obszaru pracy: baza (dotknij mapy), promień dojazdu, dopłata za dalsze zlecenia, dzielnice w zasięgu, liczba mieszkańców, zapytania, konkurencja, szacowany potencjał i podpowiedź, gdzie warto się rozszerzyć.
- Odległość od bazy przy zapytaniach i zleceniach z giełdy.
- Trasa dnia w grafiku: kolejność wizyt, kilometry i czas jazdy między zleceniami.

## Interakcje

- Brudna szyba na ekranie głównym: przetrzyj ją palcem, a pod spodem jest kod rabatowy
- Intro przy pierwszym uruchomieniu: ściągaczka zgarnia brud z logo, potem wybór roli (link „Pokaż intro” w panelu bocznym)
- Pora dnia: powitanie, nagłówek i panorama za szybą zmieniają się rano, w dzień, wieczorem i w nocy (podgląd: „Pora dnia” w panelu bocznym)
- Płynne przejścia między ekranami (View Transitions), awatar przelatuje z karty do profilu
- Profil wykonawcy z paralaksą okładki i zwijanym paskiem z nazwą
- Pociągnij w dół na ekranie głównym, żeby odświeżyć
- Bańki mydlane do przekłuwania po rezerwacji
- Suwak „przed i po” na profilu wykonawcy
- Rezerwacja i zakup wyróżnienia przeciągnięciem ściągaczki
- Mapa wykonawców w wyszukiwarce (przełącznik Lista / Mapa)
- Arkusze zamykane przeciągnięciem w dół, krótka wibracja na telefonie przy ważnych akcjach

Ilustracje kategorii, okładek, kuchni i panoramy Warszawy są rysowane w SVG i biorą kolory z motywu, więc działają też w trybie ciemnym.

## Scenariusze

Plik [SCENARIUSZE.md](SCENARIUSZE.md) opisuje 10 sytuacji z życia klientów i wykonawców, co każda z nich wymaga i co zostało na ich podstawie dodane do makiety.

## Pliki

- `index.html`: układ i style (tokeny kolorów dla jasnego i ciemnego motywu)
- `app.js`: dane, ekrany i nawigacja (czysty JavaScript). Na końcu jest warstwa trybu online.
- `api.js`: klient API, który wykrywa serwer i przechowuje sesję
- `server/`: backend (Node.js, SQLite, bez zależności z npm), panel zespołu, dokumenty prawne, testy
- `Dockerfile`: aplikacja i serwer w jednym kontenerze
- `SCENARIUSZE.md`: scenariusze użycia i to, co z nich wynikło
- Ikony: [Lucide](https://lucide.dev) z CDN, fonty: Bricolage Grotesque i Onest z Google Fonts
