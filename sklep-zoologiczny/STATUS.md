# STATUS - Sklep zoologiczny + katalog groomerów

Ostatnia aktualizacja: 2026-11-13 (po Etapie 1, Kroku 6)

## NASTĘPNY KROK

Krok 6 (zamówienie i płatności) jest w pull requeście `krok-6-zamowienie` (do zatwierdzenia przez Mariusza).
Przed zatwierdzeniem: wkleić w Supabase `supabase/06_zamowienie.sql` (nic nie kasuje). Pliki SQL w bazie: 01-05 (06 po wklejeniu).
Potem (Mariusz): zmienna `SUPABASE_SERVICE_ROLE_KEY` na Vercelu (klucz secret z Supabase -> API Keys) + Redeploy,
konto Resend i klucz w `/admin/integracje`, konto testowe Przelewy24 (sandbox) i klucze w `/admin/integracje`.
Test: zalogowany administrator może składać zamówienia testowe przy wyłączonej sprzedaży (oznaczone TEST, do usunięcia).

**Etap 1, Krok 7: Raporty dla księgowego** (zakładka Raporty: sprzedaż, zakup, zysk na zamówieniu / produkcie / miesiącu,
prowizje, dopłaty do dostawy; eksport Excel za miesiąc z podziałem VAT 8% / 23% przy czynnym VAT). Szczegóły: `PLAN_BUDOWY.md`.
Do rozważenia przy kroku 7/8: prowizja Przelewy24 w `orders.payment_fee` (dziś 0), zwroty pieniędzy, koszt pobrania.

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
- **Zmienne na Vercelu:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (od kroku 6, tajna), `NEXT_PUBLIC_SHOP_NAME`
  (ta ostatnia tylko zapasowo). Dane firmy, konto, kontakt: panel `/admin/ustawienia` (tabela `settings`).
- **Pliki SQL:** `supabase/schema.sql`, potem po kolei `01_ustawienia.sql`, `02_produkty.sql`, `03_import.sql`, `04_szukanie.sql`, `05_karta.sql`, `06_zamowienie.sql`
  (każdy można uruchomić ponownie).
- **Adres sklepu:** https://sklep-zoologiczny.vercel.app (panel: `/admin`, ustawienia: `/admin/ustawienia`).
  Strony: `/kategoria/<slug>`, `/szukaj?q=...`, filtry w adresie (np. `?marka=brit,josera&wiek=senior&waga=1-3-kg&cena_od=20&dostepne=1&sort=cena-rosnaco&strona=2`).
- **Panel admina:** adres sklepu + `/admin` (zakładki: Zamówienia, Produkty, Kategorie, Marki, Hurtownie,
  Import, Zgłoszenia, Powiadomienia, Ustawienia, Integracje), logowanie e-mailem właściciela (użytkownik w Supabase Auth,
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
- [x] **Etap 1, Krok 3 (2026-11-13): import z hurtowni** (`supabase/03_import.sql`, przetestowany na lokalnym
      Postgresie; panel `/admin/import`, kod: `app/admin/import/` + `lib/import.js`). Kreator na telefon w 6 krokach:
      plik CSV (UTF-8 lub Windows-1250, separator ; , tab |) albo Excel .xlsx (biblioteka `read-excel-file`, czytane
      w przeglądarce), szablon `/admin/import/szablon`; dopasowanie kolumn zgadywane po nagłówkach i zapamiętane
      dla hurtowni; kategorie hurtowni -> nasze (zapamiętane) + kategoria domyślna; reguła ceny: zakup netto + VAT +
      narzut %, końcówka ,99 / ,90 / pełne zł, opcjonalnie cena sugerowana z pliku, VAT z pliku albo automatycznie
      (karma / przysmaki / pokarm 8%, reszta 23%); opcje: aktualizuj ceny, stan sklepu = stan hurtowni, stan 0 dla
      pozycji spoza pliku. Podgląd (nowe / zmienione ze zmianami cena, stan, zakup / bez zmian / błędy z numerem
      wiersza) liczy baza bez zapisu. Zapis partiami po 100 wierszy (funkcja `import_batch`, każdy wiersz osobno,
      błąd jednego nie psuje reszty), potem zdjęcia z linków (serwer pobiera, `sharp` zmniejsza do 1600 px JPEG,
      wysyła do bucketu `produkty/import/...`; tylko produkty bez zdjęć). Rozpoznawanie: po EAN, bez EAN po kodzie
      hurtowni. Istniejące: cena, stan, cena zakupu, stan i kod w hurtowni (nazwy, opisy, zdjęcia, kategorie,
      promocje bez zmian). Nowe: ukryte szkice; wiersze z tym samym "kodem grupy" = warianty jednego produktu
      (też dopisywane do istniejącego produktu). Nowe marki zakładane same. Zmiany cen idą do historii (trigger).
      Ustawienia i wynik ostatniego importu: `suppliers.import_settings` (columns, categories, default_category,
      rule, last_import). Błąd EAN z Excela (5,9E+12), zgubione zero z przodu i duplikaty w pliku są wyłapywane.
- [x] **Etap 1, Krok 4 (2026-11-13): szukanie i przeglądanie** (`supabase/04_szukanie.sql`, przetestowany na lokalnym
      Postgresie i w przeglądarce na 5000 produktów, ok. 150 ms na zapytanie). Baza: rozszerzenia `unaccent` + `pg_trgm`,
      w `products` kolumny `search_name` (nazwa, marka, ścieżka kategorii, cechy), `search_doc` (+ warianty, EAN, opis),
      `search_tsv`, liczone triggerem `products_zz_search` (odświeżają je też zmiany marek, kategorii, cech, wariantów);
      tabela `search_synonyms` (psa -> pies, kotów -> kot, szczeniak -> szczenię...); funkcja `search_products`
      (szukanie: każde słowo musi pasować początkiem albo z literówką, bez polskich znaków, bez "dla / z / do", EAN / SKU;
      filtry: kategoria z podkategoriami, marka, cechy, cena, waga opakowania, dostępne, promocje; liczniki przy filtrach
      liczone bez własnego filtra; sortowanie: trafność, popularne (sprzedaż z 90 dni), nowości, cena, nazwa;
      niedostępne zawsze na końcu; stronicowanie po 24; "może chodziło o..." przy pustym wyniku), `search_suggest`
      (podpowiedzi: kategorie, marki, 6 produktów), tabela `product_requests` + funkcja `request_product`
      ("Nie mamy? Napisz, sprowadzimy", limit 5 zgłoszeń dziennie z jednego e-maila).
      Kod: wyszukiwarka z podpowiedziami w nagłówku (`components/SearchBox.js`, strzałki / Enter / Esc),
      `/kategoria/[slug]` (okruszki, podkategorie, opis), `/szukaj`, strona główna = wszystkie produkty z filtrami;
      wspólna lista `components/browse/Listing.js` (filtry `FilterPanel.js`: na telefonie wysuwany od dołu panel
      z "Pokaż wyniki", na komputerze kolumna z lewej działająca od razu; `SortSelect.js`, `ProductCard.js`
      z ceną "od", przekreśloną ceną i najniższą z 30 dni, ceną za kg, "Wybierz: 3 warianty"; `RequestForm.js`);
      parsowanie adresu: `lib/browse.js`. Stare adresy `/?kategoria=` i `/?q=` przekierowują.
      Panel: `/admin/prosby` (zgłoszenia, status, notatka, odpowiedź e-mailem), licznik nowych w menu.
- [x] **Etap 1, Krok 5 (2026-11-13): karta produktu** (`supabase/05_karta.sql`, przetestowany na lokalnym Postgresie
      i w przeglądarce, telefon i komputer). Baza: funkcja `product_page(slug)` (wszystko jednym zapytaniem: produkt, marka,
      warianty z ceną teraz / regularną / najniższą z 30 dni / za kg, galeria, cechy, podobne; administrator widzi też
      ukryte produkty jako podgląd), `similar_products` (ta sama lub siostrzana kategoria, wspólne cechy, marka, podobna cena,
      tylko dostępne; wynik w kształcie jak `search_products`, z `variant_id`), tabela `stock_alerts` + funkcja
      `request_stock_alert` ("Powiadom o dostępności", limit 10 dziennie z adresu), w `settings`: `ship_cutoff` (godzina
      graniczna, domyślnie 13:00) i `ship_handling_days` (dni na przygotowanie paczki).
      Kod: `app/produkt/[slug]/page.js` + `components/product/` (`Gallery.js`: przesuwanie palcem, kropki, miniatury,
      strzałki, powiększenie; `BuyBox.js`: wybór wariantu, cena i stan zmieniają się na miejscu, wariant w adresie `?wariant=ID`,
      -%, Omnibus, cena za kg, "ostatnie sztuki" przy stanie <= 3, ilość, "Do koszyka" z linkiem do koszyka, brakująca kwota
      do darmowej dostawy; `ShipTime.js` + `lib/shipping-time.js`: "Zamów w ciągu X, a wyślemy dziś" / "Wyślemy jutro",
      polskie święta i weekendy; `NotifyForm.js`; `ProductTabs.js`: Opis / Skład / Analiza / Dawkowanie / Szczegóły z EAN),
      podobne produkty w przewijanym rzędzie, dane dla Google (JSON-LD `Product` albo `ProductGroup` z wariantami, EAN jako
      gtin13, okruszki `BreadcrumbList`, tytuł, opis, canonical, Open Graph; adres z `lib/site.js`: domena z ustawień,
      inaczej adres Vercela). Koszyk na wariantach (`components/CartProvider.js`): pozycja `key` = `v:<wariant>` albo
      `p:<produkt>` (produkt z jednym wariantem), stare koszyki przerabiane same; koszyk i zamówienie pobierają aktualne
      ceny i stany (`app/koszyk/actions.js` -> `refreshCart`, `components/useCartRefresh.js`), niedostępne pozycje blokują
      zamówienie; do `create_order` idzie `{variant_id, quantity}`. Panel: `/admin/powiadomienia` (czekający klienci według
      wariantu, "Napisz do wszystkich" otwiera pocztę z adresami w UDW, "oznacz jako powiadomione"; licznik w menu =
      warianty już na stanie), ustawienia wysyłki w `/admin/ustawienia`.
- [x] **Etap 1, Krok 6 (2026-11-13): zamówienie i płatności** (`supabase/06_zamowienie.sql`, przetestowany na lokalnym
      Postgresie: dwukrotne uruchomienie, zamówienia, anulowanie, uprawnienia; zamówienie przetestowane w przeglądarce na telefonie
      z zastępczym API). Baza: w `orders` kolumny `locker_id`, `locker_desc`, `payment_status` (nieoplacone / oplacone / przy_odbiorze),
      `paid_at`, `is_test`, `tracking_number`, `status_changed_at`; tabele `payments` (każda próba zapłaty Przelewy24),
      `email_log` (dziennik e-maili), `integrations` (klucze Resend / Przelewy24 / token InPost, jeden wiersz, tylko admin);
      funkcje `shop_features()` (czy jest P24, token mapy - bez kluczy), `payment_paid()` (tylko service_role);
      triggery: status "Opłacone" ustawia płatność, anulowanie oddaje towar na stan (cofnięcie zdejmuje), usunąć można tylko
      zamówienie testowe (towar wraca). `create_order`: płatność `p24`, paczkomat bez adresu (wymagany kod), telefon 9 cyfr,
      administrator przy wyłączonej sprzedaży składa zamówienie testowe. `get_order` z płatnością, paczkomatem, numerem przesyłki.
      Kod: zamówienie (`app/zamowienie/CheckoutForm.js`): paczkomat (domyślnie) / kurier z terminem dostawy przy każdej opcji
      i w podsumowaniu, mapa paczkomatów `components/checkout/LockerPicker.js` (Leaflet + OpenStreetMap, punkty z publicznego API
      InPost przez `/api/paczkomaty` - szukanie po adresie (Nominatim), kodzie pocztowym, kodzie paczkomatu, "blisko mnie";
      z tokenem Geowidget oficjalna mapa InPost), zapamiętany ostatni paczkomat i dane klienta, przycisk "Zamawiam z obowiązkiem zapłaty".
      Przelewy24 (`lib/p24.js`, `lib/payments.js`): rejestracja -> przekierowanie, powiadomienie `/api/p24/status` (podpis, kwota,
      weryfikacja), zapasowe sprawdzanie po powrocie klienta i w cronie, "Zapłać teraz / ponownie" na stronie zamówienia
      (`components/checkout/PaymentWatcher.js`). E-maile przez Resend (`lib/mail.js`, `lib/mail-templates.js`, `lib/order-mail.js`):
      potwierdzenie + kopia dla sklepu, płatność przyjęta, wysłane (z numerem i linkiem śledzenia InPost), zrealizowane, anulowane,
      "Produkt znów dostępny" automatycznie po zapisie produktu, po imporcie, przyciskiem w `/admin/powiadomienia` i codziennie
      (`/api/cron`, `vercel.json`, 7:00 UTC). Panel: zamówienia z paczkomatem, płatnością, numerem przesyłki, dziennikiem e-maili,
      "Wyślij ponownie potwierdzenie", filtry Nieopłacone / Testowe, usuwanie testowych; nowa strona `/admin/integracje`
      (klucze zamaskowane, e-mail testowy, test połączenia z P24). Klient serwisowy: `lib/supabase/service.js`.
- [x] Plan rozwoju i mapa myśli (`MAPA_MYSLI.md` + tablica), przebudowane 2026-11-13 po krytyce klienta.

## Do zrobienia

- [ ] **Etap 1: sklep, który sprzedaje:** marka, cechy, warianty (2 / 7 / 12 kg), kategorie drzewem,
      wyszukiwarka (marka, opis, literówki, podpowiedzi), filtry, sortowanie, stronicowanie, karta produktu
      (galeria, skład, dawkowanie, EAN, cena za kg, Omnibus), "Powiadom o dostępności", paczkomat z mapy,
      BLIK / Przelewy24, e-mail z potwierdzeniem, regulamin.
      Zaplecze: raporty (zysk, VAT 8% / 23%) i eksport Excel
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
- [ ] Później (gdy produktów będzie > 20 tys.): przyspieszyć `search_products` (np. cechy produktu zapisane w kolumnie
      zamiast liczenia przy każdym zapytaniu). Synonimy można dopisywać w tabeli `search_synonyms` (na razie bez panelu).
- [ ] Drobne: wyłączyć w Supabase "Allow new users to sign up" (do czasu etapu 2); Vercel Pro przed sprzedażą.

## Ważne zasady w kodzie

- Ceny, koszty dostawy i stany liczy baza (funkcja `create_order`, aktualna wersja w najnowszym pliku SQL,
  teraz `06_zamowienie.sql`). Koszty dostawy są w dwóch miejscach: `lib/shop.js` i ten plik SQL - zmieniać razem.
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
- Koszyk trzyma warianty (`variant_id`); pozycja tylko z `product_id` jest dozwolona, gdy produkt ma jeden wariant
  (szybkie "Do koszyka" na liście: `search_products` nie zwraca `variant_id`, `similar_products` zwraca).
- "Powiadom o dostępności": automat `runStockAlerts` (`lib/order-mail.js`) - po zapisie produktu, po imporcie, w cronie
  i przyciskiem; ręczne pisanie z `/admin/powiadomienia` zostaje.
- Klucze usług są w tabeli `integrations` (panel `/admin/integracje`), nie w zmiennych Vercela. Jedyna tajna zmienna na Vercelu:
  `SUPABASE_SERVICE_ROLE_KEY` (używana tylko w `lib/supabase/service.js`, nigdy w kodzie przeglądarki). Bez niej sklep działa,
  ale nie wychodzą e-maile do klientów i nie ma płatności online.
- Kwoty dla Przelewy24 w groszach; podpisy sha384 z JSON-a w stałej kolejności pól (`lib/p24.js`). Każda próba zapłaty
  ma nowy `session_id` (`payments`); księguje tylko `payment_paid()` po weryfikacji w P24.
- Prawdziwych zamówień nie da się usunąć (księgowość) - tylko anulować; anulowanie oddaje towar na stan.
- Paczkomat: kod w `orders.locker_id`, adres paczkomatu w `locker_desc`; pola adresu klienta zostają puste.
- Godzina wysyłki i święta: `lib/shipping-time.js` (liczone w przeglądarce, strefa Europe/Warsaw).
- Zapis produktu w panelu to kilka zapytań po kolei (produkt, warianty, hurtownia, cechy, galeria).
  Najpierw usuwane są skasowane warianty (zwalnia EAN), potem zmiany. Daty promocji niezmienione
  w formularzu zostają co do sekundy (żeby nie robić szumu w historii cen).
- Import (`import_batch` w `03_import.sql`) dostaje wiersze już przeliczone w `lib/import.js` (cena z reguły,
  VAT, kategoria); baza tylko dopasowuje i zapisuje. Nowe pola produktu do importu: dodać w `FIELDS`
  i `buildRows` (`lib/import.js`) oraz w funkcji SQL. Zdjęcia z importu tylko dla produktów bez zdjęć.
- Opcja "stan 0 dla pozycji spoza pliku" działa tylko na wariantach, dla których ta hurtownia jest główna,
  i tylko po pełnym, nieprzerwanym zapisie.
- Szukanie i filtry liczy baza (`search_products` w `04_szukanie.sql`), kod tylko czyta adres (`lib/browse.js`)
  i rysuje wynik. Nowy filtr: dodać w funkcji SQL (`base` / `scored` / `facets`), w `parseBrowse` / `rpcFilters`
  i w `FilterPanel.js`. Cechy z tabeli `attributes` (filterable) pokazują się w filtrach same, kod cechy = nazwa w adresie.
  Funkcje szukania mają `set jit = off` (z JIT zapytanie trwało 2 s zamiast 0,15 s).
- Przedziały wagi są w dwóch miejscach: `weight_bucket` w `04_szukanie.sql` i `WEIGHTS` w `lib/browse.js`.
- Po każdym etapie aktualizować ten plik w repo i w dokumentach projektu Claude.
