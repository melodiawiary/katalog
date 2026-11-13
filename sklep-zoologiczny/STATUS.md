# STATUS - Sklep zoologiczny + katalog groomerów

Ostatnia aktualizacja: 2026-11-13 (po Etapie 1, Kroku 2)

## NASTĘPNY KROK

Krok 2 jest na `main` (PR #1 zatwierdzony przez Mariusza 2026-11-13). Oba pliki SQL (01, 02) są już w bazie.

**Etap 1, Krok 3: Import z hurtowni (CSV / Excel)** (szablon do pobrania, dopasowanie kolumn zapamiętane
dla hurtowni, dopasowanie kategorii, reguła ceny, podgląd nowe / zmienione / błędy, aktualizacja po EAN,
nowe jako szkice, zdjęcia z linków, import partiami). Szczegóły: `PLAN_BUDOWY.md`.

Jeśli kiedyś trzeba będzie ponownie uruchomić `01`, potem trzeba też ponownie uruchomić `02`
(01 ma starszą wersję `create_order`).

**Etap 1: sklep, który sprzedaje.** Kolejność zmieniona 2026-11-13 po krytyce oczami klienta
(`KRYTYKA_KLIENTA.md` w dokumentach projektu Claude): najpierw sklep, potem salony.
Dalej: import CSV z hurtowni, wyszukiwarka, filtry, sortowanie, karta produktu,
paczkomat z mapy, BLIK / Przelewy24, e-maile, raporty dla księgowego.
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
- **Pliki SQL:** `supabase/schema.sql`, potem po kolei `01_ustawienia.sql`, `02_produkty.sql`, `03_...`
  (każdy można uruchomić ponownie).
- **Adres sklepu:** https://sklep-zoologiczny.vercel.app (panel: `/admin`, ustawienia: `/admin/ustawienia`).
- **Panel admina:** adres sklepu + `/admin` (zakładki: Zamówienia, Produkty, Kategorie, Marki, Hurtownie,
  Ustawienia), logowanie e-mailem właściciela (użytkownik w Supabase Auth,
  dopisany do tabeli `admins`). Hasło Mariusz ustawił 2026-11-13 poleceniem SQL; przy resecie:
  `update auth.users set encrypted_password = extensions.crypt('HASLO', extensions.gen_salt('bf')) where email = '...';`
- **Dostęp Claude do GitHuba:** aplikacja Claude ma dostęp do wszystkich repozytoriów (All repositories),
  ale sesja nie może pisać prosto do `main`. Claude wysyła gałąź i otwiera pull request (przez `gh api`,
  bo GraphQL jest zablokowany), a Mariusz zatwierdza go z telefonu: link do PR -> Merge pull request ->
  Confirm merge. Repo trzeba w sesji podłączyć z prawem zapisu (add_repo, access push).
- **Użytkownik pracuje z telefonu:** zawsze dawać link, CO skopiować (np. surowy plik SQL z
  raw.githubusercontent.com) i link, GDZIE wkleić (np. edytor SQL Supabase), plus co ma się pojawić.

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
- [x] **Etap 1, Krok 1 (2026-11-13): baza produktów 2.0** (`supabase/02_produkty.sql`, przetestowany
      na lokalnym Postgresie: dwukrotne uruchomienie, zamówienia, Omnibus, uprawnienia):
      kategorie drzewem (`categories.parent_id`, gotowe drzewo dla psów i kotów: Karma -> Sucha / Mokra /
      Weterynaryjna, Przysmaki, Zabawki, Spacer, Legowiska, Miski, Pielęgnacja; koty też Żwirki, Drapaki),
      `brands`, cechy (`attributes`, `attribute_values`, `product_attribute_values`: dla kogo, wiek,
      wielkość psa, dieta, smak / białko), `product_variants` (cena, promocja z datami, stan, EAN, SKU,
      ilość netto + jednostka kg / l / szt do ceny za kg), `product_images` (galeria; `products.image_url`
      zostaje jako zdjęcie główne), w `products`: `vat_rate` (karma 8%), `composition`, `analysis`,
      `additives`, `dosage`, `brand_id`; `suppliers` + `variant_suppliers` (kod u hurtowni, cena zakupu,
      stan w hurtowni, hurtownia główna; tylko admin), `price_history` + funkcja `lowest_price_30d`
      + widok `variant_prices` (cena teraz, promocja, najniższa z 30 dni, cena za kg / l),
      funkcja `effective_price` (pole w zapytaniu: `product_variants?select=*,effective_price`).
      `create_order` liczy po wariantach (pozycja `{variant_id, quantity}` albo po staremu `{product_id}`,
      gdy produkt ma jeden wariant), zapisuje wariant, EAN, cenę zakupu i VAT; w `orders` doszły
      `payment_fee` (prowizja) i `shipping_real_cost`. 8 produktów dostało po jednym wariancie.
      W kodzie: kategorie główne + podkategorie na stronie głównej (filtr obejmuje podkategorie),
      okruszki na stronie produktu, drzewo w wyborze kategorii w panelu (`lib/categories.js`).
- [x] **Etap 1, Krok 2 (2026-11-13): panel admina 2.0** (bez nowego SQL):
      formularz produktu (`app/admin/ProductForm.js`, zapis: `app/admin/produkty/actions.js`): marka z listy
      albo nowa z ręki, VAT, warianty jako zwijane karty (nazwa, cena, stan, ilość netto + jednostka z ceną za kg,
      EAN z ostrzeżeniem o złej cyfrze kontrolnej, SKU, promocja z datami w polskiej strefie czasu, hurtownia
      główna + kod + cena zakupu netto z wyliczonym zyskiem zależnie od statusu VAT), galeria (wiele zdjęć,
      zmniejszanie w przeglądarce do 1600 px i wysyłka prosto do Supabase Storage, zdjęcie z linku, kolejność
      strzałkami, pierwsze = główne -> `products.image_url`), cechy jako przyciski, skład / analiza / dodatki /
      dawkowanie; kopia produktu (ukryty szkic bez EAN), usuwanie z potwierdzeniem i sprzątaniem plików.
      Lista produktów: szukanie po nazwie, marce, EAN, SKU, nazwie wariantu i kodzie hurtowni; filtry (widoczne,
      ukryte / szkice, brak na stanie, kończą się, promocje, bez zdjęcia), kategoria z podkategoriami, marka,
      sortowanie, 30 na stronę, szybkie Ukryj / Pokaż. Nowe strony: `/admin/kategorie` (drzewo, dodawanie,
      edycja, przenoszenie, ukrywanie w menu sklepu, usuwanie tylko pustych), `/admin/marki`, `/admin/hurtownie`
      (`app/admin/katalog-actions.js`). Ukryte kategorie znikają z menu sklepu (`app/page.js`).
      Daty i liczby: `lib/admin.js`; dane formularza: `lib/admin-products.js`; `adminClient`: `lib/admin-server.js`.
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
  teraz `02_produkty.sql`). Koszty dostawy są w dwóch miejscach: `lib/shop.js` i ten plik SQL - zmieniać razem.
- Cena i stan są w wariantach (`product_variants`). `products.price` i `products.stock` liczy baza
  (najniższa cena i suma sztuk aktywnych wariantów) - do list i sortowania; nie edytować ich w nowym kodzie.
  Wyjątek przejściowy: przy produkcie z jednym wariantem zmiana `products.price` / `stock` przechodzi
  na wariant (stary formularz panelu). Triggery pilnują tego z `pg_trigger_depth()`.
- Ceny zakupu są tylko w `variant_suppliers` (niedostępne dla klientów). Nie dodawać ich do tabel,
  które czyta sklep (RLS nie ukrywa pojedynczych kolumn).
- Wymagane dane firmy są sprawdzane w dwóch miejscach: `lib/settings-fields.js` i funkcja `settings_missing`
  w `01_ustawienia.sql` - zmieniać razem.
- Pliki SQL piszemy tak, żeby można je było uruchamiać ponownie (nie kasują danych).
- Kategorie sklepu zostają wszystkie; nacisk na psy i koty.
- Nie trzymać w repo haseł ani kluczy (repo jest publiczne).
- Sklep (strona produktu, koszyk) wciąż dodaje do koszyka produkt, nie wariant: produkt z kilkoma
  aktywnymi wariantami da się zamówić dopiero po kroku 5 (wybór wariantu na karcie produktu).
  Do tego czasu sprzedaż i tak jest wyłączona.
- Zapis produktu w panelu to kilka zapytań po kolei (produkt, warianty, hurtownia, cechy, galeria).
  Najpierw usuwane są skasowane warianty (zwalnia EAN), potem zmiany. Daty promocji niezmienione
  w formularzu zostają co do sekundy (żeby nie robić szumu w historii cen).
- Po każdym etapie aktualizować ten plik w repo i w dokumentach projektu Claude.
