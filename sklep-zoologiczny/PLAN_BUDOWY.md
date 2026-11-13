# Plan budowy (zgodny z MAPA_MYSLI.md)

Utworzony: 2026-11-13. Sklep będzie działał na firmie brata Mariusza (dopisanie sklepu później).
Zasada: budujemy wszystko teraz, a dane firmy i konta zewnętrzne (płatności, InPost) podłączamy na końcu.
Do tego czasu sklep działa w trybie "przed startem": wszystko widać i da się testować, ale nie da się kupić.

Każdy krok = osobna sesja pracy, kończy się działającą wersją na Vercelu i aktualizacją STATUS.md.
Legenda: [Claude] robię ja · [Mariusz] potrzebne działanie z telefonu (wklejenie SQL, założenie konta itd.)

---

## ETAP 1: sklep, który sprzedaje

### Krok 0. Furtka na dane firmy (tryb "przed startem") - ZROBIONE 2026-11-13 (`supabase/01_ustawienia.sql`)
- [Claude] Tabela `ustawienia` (jeden wiersz) edytowana w panelu: nazwa firmy, imię i nazwisko właściciela,
  NIP, REGON, adres, e-mail, telefon, numer konta, status VAT (zwolniony / czynny), numer wpisu
  do rejestru paszowego, nazwa sklepu, domena.
- [Claude] Przełącznik **"Sprzedaż włączona"**. Wyłączony = pasek "Sklep wkrótce", koszyk działa,
  ale przycisk "Zamawiam" jest zablokowany. Włączyć się da dopiero, gdy wszystkie wymagane dane są wpisane
  (panel pokazuje listę braków).
- [Claude] Stopka, strona "Dziękujemy" (dane do przelewu), maile i regulaminy biorą dane z ustawień,
  nie ze zmiennych Vercela.
- [Claude] Usunięcie opcji "odbiór osobisty".
- [Mariusz] Wkleić SQL w Supabase.

### Krok 1. Baza produktów 2.0 - ZROBIONE 2026-11-13 (`supabase/02_produkty.sql`)
Zmiany względem planu: stawka VAT jest na produkcie (warianty jednego produktu mają tę samą),
a cena zakupu w tabeli `variant_suppliers` (wariant + hurtownia), żeby klienci nie mogli jej odczytać.
- [Claude] Plik `supabase/02_produkty.sql` (można uruchamiać wielokrotnie, nie kasuje danych):
  - kategorie drzewem (kategoria nadrzędna), np. Pies -> Karma -> Sucha
  - marki
  - cechy produktu: gatunek, wiek, wielkość psa, dieta, smak / białko
  - **warianty**: każdy produkt ma 1 lub więcej wariantów (2 kg / 7 kg / 12 kg, S / M / L),
    a wariant ma własną cenę, stan, EAN, wagę lub objętość (do ceny za kg), cenę zakupu i stawkę VAT
  - galeria zdjęć (wiele na produkt)
  - skład, analiza, dawkowanie
  - hurtownie i kod produktu u hurtowni
  - historia cen (Omnibus), cena promocyjna z datami
  - przy zamówieniu zapisywane: cena zakupu, stawka VAT, prowizja (do raportów)
- [Claude] Przeniesienie obecnych 8 produktów na nowy układ (każdy dostaje 1 wariant).
- [Claude] Funkcja `create_order` liczy po wariantach.
- [Mariusz] Wkleić SQL w Supabase.

### Krok 2. Panel admina 2.0 - ZROBIONE 2026-11-13 (bez nowego SQL)
Dodatkowo: kopia produktu, hurtownia i cena zakupu z wyliczeniem zysku w wariancie, zdjęcia z linku,
zmniejszanie zdjęć w telefonie przed wysłaniem, szukanie po EAN / kodzie hurtowni, ukrywanie kategorii.
- [Claude] Edycja produktu: marka, cechy, warianty w tabelce, galeria, skład / dawkowanie, promocja.
- [Claude] Drzewo kategorii i marki do edycji.
- [Claude] Lista produktów z wyszukiwaniem i filtrem (szkic / aktywny / brak w magazynie).

### Krok 3. Import z hurtowni (CSV / Excel) - ZROBIONE 2026-11-13 (`supabase/03_import.sql`, panel `/admin/import`)
Dodatkowo: Excel .xlsx, polskie kodowanie Windows-1250, warianty z "kodu grupy", opcja "stan 0 dla pozycji spoza
pliku", wyłapywanie EAN zepsutych przez Excel. Ustawienia hurtowni w `suppliers.import_settings` (bez nowej tabeli).
- [Claude] Szablon CSV do pobrania z panelu.
- [Claude] Wgranie pliku -> dopasowanie kolumn (zapamiętane dla hurtowni) -> dopasowanie kategorii ->
  reguła ceny (np. +35%, końcówka ,99) -> podgląd (nowe / zmienione / błędy) -> zapis.
- [Claude] Rozpoznawanie produktów po EAN, nowe jako szkice, aktualizacja ceny i stanu bez ruszania opisów,
  zdjęcia pobierane z linków i zmniejszane.
- [Claude] Import partiami (limit czasu funkcji na Vercelu), zmiany cen zapisywane w historii.

### Krok 4. Szukanie i przeglądanie (to, co klient robi najpierw) - ZROBIONE 2026-11-13 (`supabase/04_szukanie.sql`)
Dodatkowo: synonimy i odmiana (psa -> pies), szukanie po EAN, liczniki przy każdym filtrze, filtr wagi opakowania,
sortowanie po popularności, panel `/admin/prosby` ze zgłoszeniami "sprowadzimy".
- [Claude] Wyszukiwarka w bazie: nazwa + marka + opis, bez polskich znaków, z tolerancją literówek
  (Postgres: wyszukiwanie pełnotekstowe + podobieństwo słów).
- [Claude] Podpowiedzi przy wpisywaniu (produkty i marki).
- [Claude] Pusty wynik: "może chodziło o..." + formularz "nie mamy? napisz, sprowadzimy".
- [Claude] Strony kategorii z drzewem, filtry (marka, wiek, wielkość psa, dieta, waga, cena, dostępne,
  promocje), sortowanie, stronicowanie, filtry w adresie strony (da się wysłać link).
- [Claude] Wygodne na telefonie (filtry w wysuwanym panelu).

### Krok 5. Karta produktu
- [Claude] Galeria, wybór wariantu (cena i stan zmieniają się na miejscu), cena za kg / litr,
  przy promocji najniższa cena z 30 dni, skład / analiza / dawkowanie w zakładkach.
- [Claude] "Wysyłka dziś / jutro" zamiast liczby sztuk, "Powiadom o dostępności" (zapis e-maila).
- [Claude] Podobne produkty, dane do Google (tytuł, opis, cena, dostępność).

### Krok 6. Zamówienie i płatności
- [Claude] Paczkomat wybierany z mapy InPost (przy paczkomacie bez pełnego adresu),
  termin dostawy przed złożeniem zamówienia.
- [Claude] E-mail z potwierdzeniem zamówienia i zmiany statusu (np. przez Resend).
- [Claude] Przelewy24 (BLIK, szybkie przelewy, karty) w trybie testowym; pobranie zostaje.
- [Mariusz] Konto Resend (darmowe), później konta firmowe: Przelewy24 i InPost (wymagają danych firmy,
  więc do kroku 8 działają testowo).

### Krok 7. Raporty dla księgowego
- [Claude] Zakładka Raporty: sprzedaż, koszty zakupu, zysk na zamówieniu / produkcie / miesiącu,
  najlepsze produkty, prowizje i dopłaty do dostawy.
- [Claude] "Pobierz dla księgowego": Excel ze sprzedażą za miesiąc; przy czynnym VAT podział 8% / 23%
  (zależnie od statusu VAT w ustawieniach).

### Krok 8. Start sprzedaży (gdy firma jest gotowa)
- [Claude] Regulamin sklepu, polityka prywatności, cookies, zwroty: szablony uzupełniane danymi
  z ustawień (do sprawdzenia przez prawnika / księgowego).
- [Claude] Baner zgody na cookies, test pełnego zakupu na koncie testowym.
- [Mariusz] Dopisanie sklepu do firmy brata, wpis do rejestru paszowego (PIW), decyzja o VAT
  z księgowym, umowa z hurtownią, nazwa i domena, Vercel Pro, konta Przelewy24 i InPost w trybie produkcyjnym.
- [Mariusz] Wpisanie danych firmy w panelu -> "Sprzedaż włączona".

---

## ETAP 2: konto klienta do zakupów
Logowanie e-mailem i Google, zakup też bez konta, historia, "Zamów ponownie", moje zwierzęta,
przypomnienie o karmie, opinie o produktach, "kupowane razem".

## ETAP 3: katalog groomerów i mapa
Plik `supabase/03_miejsca.sql`, profile, cennik wg rasy i wielkości, mapa OpenStreetMap, "w pobliżu",
filtry, panel admina do salonów. Publicznie dopiero z 20-30 salonami z Trójmiasta.

## ETAP 4: opinie o salonach, ranking, nowa strona główna (+ zapis do Akademii)
## ETAP 5: konta salonów, odpowiedzi na opinie
## ETAP 6: Akademia
