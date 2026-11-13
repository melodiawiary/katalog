# STATUS - Sklep zoologiczny + katalog groomerów

Ostatnia aktualizacja: 2026-11-13 (po Etapie 1, Kroku 0)

## NASTĘPNY KROK

**Etap 1, Krok 1: Baza produktów 2.0** (plik `supabase/02_produkty.sql`: kategorie drzewem, marki, cechy,
warianty, galeria, skład / dawkowanie, hurtownie, historia cen, cena zakupu i VAT; `create_order` po wariantach).
Szczegóły kroków: `PLAN_BUDOWY.md`. Uwaga: aktualna funkcja `create_order` jest w `01_ustawienia.sql`
(z blokadą sprzedaży) - w `02` przenieść ją razem z tą blokadą.

Krok 0 zrobiony w kodzie 2026-11-13. **Mariusz musi jeszcze wkleić `supabase/01_ustawienia.sql` w Supabase**
(do tego czasu sklep też działa w trybie "przed startem", ale panel pokaże komunikat o braku tabeli).

**Etap 1: sklep, który sprzedaje.** Kolejność zmieniona 2026-11-13 po krytyce oczami klienta
(`KRYTYKA_KLIENTA.md` w dokumentach projektu Claude): najpierw sklep, potem salony.
Zacząć od bazy: marka, cechy produktu, warianty, hurtownie, cena zakupu, EAN, historia cen, stawka VAT
(nowy plik SQL, np. `supabase/02_produkty_cechy.sql`), potem import CSV z hurtowni, wyszukiwarka, filtry,
sortowanie, karta produktu, paczkomat z mapy, BLIK / Przelewy24, e-maile, raporty dla księgowego.
Pełny plan: `MAPA_MYSLI.md` (w tym folderze i w dokumentach projektu Claude).
Tablica z mapą myśli: https://claude.ai/artifact/9yrgVbMTMZvu52PGc9Zd5Y

## Gdzie co jest

- **Kod:** GitHub `melodiawiary/katalog`, folder `sklep-zoologiczny` (gałąź `main`). Repo jest publiczne.
- **Technologia:** Next.js 15 (App Router, JavaScript) + Supabase + Vercel.
- **Baza:** Supabase, organizacja Dzialkowo, projekt "Sklep zoologiczny",
  adres `https://jetdtaijauawrsyobycl.supabase.co` (id: `jetdtaijauawrsyobycl`), region Europe, plan Free.
  Zmiany w bazie: wklejać SQL w https://supabase.com/dashboard/project/jetdtaijauawrsyobycl/sql/new
- **Hosting:** Vercel, zespół Dzialkowo, projekt `sklep-zoologiczny`, Root Directory = `sklep-zoologiczny`.
  Każdy push do `main` automatycznie aktualizuje sklep.
- **Zmienne na Vercelu:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SHOP_NAME`
  (ta ostatnia tylko zapasowo). Dane firmy, konto, kontakt: panel `/admin/ustawienia` (tabela `settings`).
- **Pliki SQL:** `supabase/schema.sql`, potem po kolei `01_ustawienia.sql`, `02_...` (każdy można uruchomić ponownie).
- **Adres sklepu:** https://sklep-zoologiczny.vercel.app (panel: `/admin`, ustawienia: `/admin/ustawienia`).
- **Panel admina:** adres sklepu + `/admin`, logowanie e-mailem właściciela (użytkownik w Supabase Auth,
  dopisany do tabeli `admins`). Hasło Mariusz ustawił 2026-11-13 poleceniem SQL; przy resecie:
  `update auth.users set encrypted_password = extensions.crypt('HASLO', extensions.gen_salt('bf')) where email = '...';`
- **Dostęp Claude do GitHuba:** aplikacja Claude ma dostęp do wszystkich repozytoriów (All repositories),
  więc Claude sam wysyła zmiany.
- **Użytkownik pracuje z telefonu:** instrukcje krok po kroku, linki bezpośrednie do ekranów Supabase/Vercel.

## Co jest zrobione

- [x] Sklep: katalog z kategoriami i wyszukiwarką, strona produktu, koszyk, zamówienie
      (kurier 15,99 / paczkomat 12,99 / odbiór 0 zł, darmowa dostawa od 200 zł; przelew lub pobranie),
      strona "Dziękujemy" z danymi do przelewu.
- [x] Panel admina: zamówienia ze zmianą statusu, dodawanie/edycja/usuwanie produktów ze zdjęciami.
- [x] Baza: `supabase/schema.sql` uruchomiony w Supabase (tabele, RLS, uprawnienia, funkcje `create_order`
      i `get_order`, bucket `produkty` na zdjęcia, 5 kategorii, 8 przykładowych produktów).
- [x] Konto administratora utworzone i dodane do `admins`.
- [x] Wdrożenie na Vercel działa (produkty wczytują się z Supabase).
- [x] **Etap 1, Krok 0 (2026-11-13):** tabela `settings` (dane firmy, NIP, REGON, konto, status VAT, rejestr
      paszowy, nazwa, domena) + panel `/admin/ustawienia` z listą braków; przełącznik "Sprzedaż włączona"
      (baza nie pozwoli go włączyć bez kompletu danych i nie przyjmie zamówienia przy wyłączonej sprzedaży);
      pasek "Sklep wkrótce", zablokowany przycisk "Zamawiam"; stopka i dane do przelewu z ustawień;
      usunięty odbiór osobisty. SQL: `supabase/01_ustawienia.sql`.
- [x] Plan rozwoju i mapa myśli (`MAPA_MYSLI.md` + tablica), przebudowane 2026-11-13 po krytyce klienta.

## Do zrobienia

- [ ] **Etap 1: sklep, który sprzedaje:** marka, cechy, warianty (2 / 7 / 12 kg), kategorie drzewem,
      wyszukiwarka (marka, opis, literówki, podpowiedzi), filtry, sortowanie, stronicowanie, karta produktu
      (galeria, skład, dawkowanie, EAN, cena za kg, Omnibus), "Powiadom o dostępności", paczkomat z mapy,
      BLIK / Przelewy24, e-mail z potwierdzeniem, regulamin.
      Zaplecze: import z hurtowni (CSV, dopasowanie kolumn i kategorii, reguła ceny, podgląd, szkice,
      aktualizacja po EAN, zdjęcia z linków), historia cen, raporty (zysk, VAT 8% / 23%) i eksport Excel
      dla księgowego.
- [ ] **Formalności przed sprzedażą (Mariusz):** firma (JDG lub dopisanie do istniejącej), wpis do rejestru
      paszowego w powiatowym inspektoracie weterynarii, decyzja z księgowym o VAT (zwolnienie do 240 000 zł/rok)
      i formie podatku, umowa z hurtownią (zgoda na zdjęcia i opisy, częstotliwość aktualizacji stanów).
- [ ] Etap 2: konto klienta do zakupów: historia, "Zamów ponownie", moje zwierzęta, przypomnienie o karmie,
      opinie o produktach.
- [ ] Etap 3: katalog groomerów + mapa (PostGIS, OpenStreetMap), panel admina do salonów;
      publicznie dopiero z 20-30 salonami z Trójmiasta. SQL np. `supabase/03_miejsca.sql`.
- [ ] Etap 4: opinie o salonach, ranking i odznaki, nowa strona główna (sklep + salony, zapis do Akademii).
- [ ] Etap 5: konta salonów, odpowiedzi na opinie.
- [ ] Etap 6: Akademia.
- [ ] Drobne: wyłączyć w Supabase "Allow new users to sign up" (do czasu etapu 2); Vercel Pro przed sprzedażą.

## Ważne zasady w kodzie

- Ceny, koszty dostawy i stany liczy baza (funkcja `create_order`, aktualna wersja w najnowszym pliku SQL,
  teraz `01_ustawienia.sql`). Koszty dostawy są w dwóch miejscach: `lib/shop.js` i ten plik SQL - zmieniać razem.
- Wymagane dane firmy są sprawdzane w dwóch miejscach: `lib/settings-fields.js` i funkcja `settings_missing`
  w `01_ustawienia.sql` - zmieniać razem.
- Pliki SQL piszemy tak, żeby można je było uruchamiać ponownie (nie kasują danych).
- Kategorie sklepu zostają wszystkie; nacisk na psy i koty.
- Nie trzymać w repo haseł ani kluczy (repo jest publiczne).
- Po każdym etapie aktualizować ten plik w repo i w dokumentach projektu Claude.
