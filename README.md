# Lśni

Klikalna makieta aplikacji mobilnej: marketplace usług sprzątania. Klienci znajdują i rezerwują wykonawców, a wykonawcy publikują ogłoszenia i przyjmują zlecenia.

## Uruchomienie

Bez instalacji i bez budowania. Otwórz `index.html` w przeglądarce albo wystaw katalog dowolnym serwerem:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Na komputerze aplikacja wyświetla się w ramce telefonu, a na telefonie na pełnym ekranie. Przełącznik „Tryb klienta / Tryb wykonawcy” jest w panelu po lewej, a w aplikacji w zakładce Profil.

## Co działa

**Klient**
- Odkrywanie: kategorie usług, wolne terminy jeszcze dziś, polecani w okolicy, najbliższa wizyta
- Wyszukiwanie z filtrami (stawka, ocena, OC, własne środki, eco, zwierzęta, faktura VAT, wolne dziś) i sortowaniem
- Profil wykonawcy: statystyki, weryfikacja, cennik, dostępność na 7 dni, zakres standardu, opinie
- Rezerwacja w 4 krokach: zakres (metraż, pokoje, łazienki, dodatki) z wyceną na żywo, termin i cykliczność z rabatem, adres i sposób wejścia, płatność BLIK lub kartą
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

## Interakcje

- Brudna szyba na ekranie głównym: przetrzyj ją palcem, a pod spodem jest kod rabatowy
- Suwak „przed i po” na profilu wykonawcy
- Płatność i zwolnienie płatności przeciągnięciem ściągaczki
- Mapa wykonawców w wyszukiwarce (przełącznik Lista / Mapa)
- Arkusze zamykane przeciągnięciem w dół, krótka wibracja na telefonie przy ważnych akcjach

Ilustracje kategorii, okładek, kuchni i panoramy Warszawy są rysowane w SVG i biorą kolory z motywu, więc działają też w trybie ciemnym.

## Pliki

- `index.html`: układ i style (tokeny kolorów dla jasnego i ciemnego motywu)
- `app.js`: dane, ekrany i nawigacja (czysty JavaScript)
- Ikony: [Lucide](https://lucide.dev) z CDN, fonty: Bricolage Grotesque i Onest z Google Fonts
