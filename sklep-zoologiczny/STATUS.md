# STATUS - Sklep zoologiczny + katalog groomerów

Ostatnia aktualizacja: 2026-11-14 (Etap 3: baza, panel i strony publiczne `/salony` gotowe; zostaje zebranie salonów i włączenie katalogu)

## NASTĘPNY KROK

**Etap 3 (katalog groomerów i mapa), część 1 - BAZA: ZROBIONE 2026-11-14** (`supabase/09_miejsca.sql` wykonany w bazie przez Claude, przetestowany na danych próbnych z cofnięciem:
slug automatyczny, szukanie w pobliżu z promieniem i zasięgiem groomera mobilnego, cena "od" dla usługi i wielkości psa, otwarte teraz, ukryte i szkice niewidoczne dla klienta,
blokada włączenia katalogu przed 20 opublikowanymi miejscami, `place_private` zablokowane dla klientów). Baza jest pusta (0 miejsc), katalog WYŁĄCZONY (`places_config.public_enabled = false`).
**Etap 3, część 2a - PANEL ADMINA: ZROBIONE 2026-11-14** (commit `311d0ed`, bez nowego SQL, build przeszedł; zapis miejsca z godzinami, cennikiem i danymi prywatnymi sprawdzony na bazie w transakcji z cofnięciem; formularza w przeglądarce jeszcze nie klikano).
Kod: `app/admin/miejsca/` (`page.js` lista z filtrami, szybkie Publikuj / Ukryj, przełącznik katalogu z licznikiem opublikowanych; `nowe/`, `[id]/`; `PlaceForm.js` formularz: adres -> pinezka przez Nominatim (`geocodeAddress`), przeciąganie pinezki / klik na mapie uzupełnia puste pola adresu (`reverseGeocode`), godziny (do kilku przedziałów dziennie, kopiowanie pon -> wt-pt), cennik, udogodnienia, notatki prywatne (`place_private`);
`zgloszenia/` zgłoszenia `place_requests` ze statusem, notatką i przyciskiem "Utwórz szkic z tego zgłoszenia"; `actions.js`, `loader.js`), `lib/places.js` (stałe: rodzaje, statusy, wielkości, dni tygodnia), link "Salony" z licznikiem nowych zgłoszeń w menu. Slug nie jest edytowalny (liczy go baza).
Groomer mobilny wymaga zasięgu dojazdu w km. Słowniki usług i udogodnień nadal bez panelu (tabele `service_defs`, `feature_defs`).
**Etap 3, część 2b - STRONY PUBLICZNE: ZROBIONE 2026-11-14** (bez nowego SQL, build przeszedł, strony sprawdzone lokalnie bez danych; z danymi jeszcze nie klikane).
Kod: `app/salony/page.js` (mapa Leaflet + lista obok siebie, na telefonie jedno pod drugim; liczy baza `search_places`, do 200 wyników), `components/places/PlacesFilters.js` (adres -> pozycja przez `/api/geokoduj` (Nominatim, cache), "Salony blisko mnie", filtry w adresie: `q, miasto, rodzaj, gatunek, usluga, wielkosc, cena_max, otwarte, udogodnienia, lat, lng, gdzie, promien, sort`),
`components/places/PlacesMap.js`, `app/salony/[slug]/page.js` (profil z `place_page`: opis, cennik wg usług, godziny z oznaczonym dniem dzisiejszym, kontakt, mapa, trasa Google, najbliższe salony, dane `PetGroomer` dla Google),
`app/salony/polec/page.js` + `components/places/PlaceRequestForm.js` + `app/salony/actions.js` (zgłoszenia: poleć / popraw / usuń przez `submit_place_request`, z pułapką na roboty), `lib/places-browse.js`.
Link "Salony" w nagłówku pojawia się dopiero po włączeniu katalogu. Przed włączeniem klient widzi na `/salony` "Katalog wkrótce" i link "Poleć salon"; administrator widzi podgląd (też szkice) z żółtą ramką.
**Zostaje w Etapie 3:** (3) link "Salony dla: Burek" z Moich zwierząt (`dog_size_class` z wagi -> `/salony?gatunek=pies&wielkosc=...`); (4) zebranie 20-30 salonów z Trójmiasta (ręcznie w panelu; ewentualnie import CSV później); (5) dopiero wtedy włączyć katalog w `/admin/miejsca`.

### Poprzedni krok

**Etap 2 (konto klienta): KOD WDROŻONY 2026-11-14** (commit `ee9cec1`, `supabase/08_konto.sql` wykonany w bazie, build przeszedł, Vercel READY, w logach brak błędów).
**Sprawdzone na żywo 2026-11-14:** Mariusz przetestował logowanie e-mailem na produkcji (mormecs@gmail.com) - działa; "Allow new users to sign up" jest WŁĄCZONE (sprawdzone na zrzucie ekranu).
Jeśli kiedyś mail nie przychodzi: `/admin/integracje` (klucz Resend) i tabela `email_log` (rodzaj `logowanie`). Nie sprawdzone jeszcze: Google, ręcznie strony opinii i przypomnienia na żywo.
**Do zrobienia przez Mariusza (tylko jeśli chce Google):** w Google Cloud utworzyć OAuth Client (Web), w Supabase -> Authentication -> Sign In / Providers -> Google
wkleić Client ID i Secret, w Authentication -> URL Configuration ustawić Site URL na adres sklepu i dodać Redirect URL
`https://sklep-zoologiczny.vercel.app/auth/callback` (później także adres własnej domeny). Przycisk "Zaloguj przez Google" pojawia się sam, gdy Google jest włączone w Supabase.
Przypomnienia o karmie idą z codziennego crona (7:00 UTC) razem z "Produkt znów dostępny"; "Kupowane razem" pokaże się dopiero po min. 2 wspólnych prawdziwych zamówieniach
(zamówienia testowe i anulowane nie liczą się). Następny w kolejce: **Krok 8 (część Mariusza) i start sprzedaży**, potem Etap 3 (katalog groomerów).

**Krok 8, część Claude: ZROBIONE 2026-11-14** (`supabase/07_zgody.sql` wykonany w bazie). Strony `/regulamin`, `/polityka-prywatnosci`,
`/polityka-cookies`, `/zwroty` (odstąpienie 14 dni + wzór formularza z przyciskiem e-mail + reklamacje) biorą dane z `settings`
(brak danych = czerwony znacznik "uzupełnij w ustawieniach"; przy wyłączonej sprzedaży baner "wersja robocza"). Teksty: `app/*/page.js`,
wspólne: `lib/legal.js` (`LEGAL_VERSION` zmieniać przy każdej zmianie treści), `components/legal/Doc.js`. Stopka z linkami, baner cookies
(`components/CookieBanner.js`, `lib/consent.js`; dziś tylko cookies niezbędne, nowe kategorie dopisać w `OPTIONAL_CATEGORIES`),
akceptacja regulaminu zapisywana w `orders.terms_accepted_at` i `terms_version`, linki do zwrotów i regulaminu w e-mailu z potwierdzeniem.
Zostaje po stronie Mariusza (lista w `PLAN_BUDOWY.md`, Krok 8): prawnik/księgowy sprawdza teksty, firma, rejestr paszowy PIW, VAT,
hurtownia, domena, Vercel Pro, konta Przelewy24 i InPost produkcyjne, wpisanie danych w `/admin/ustawienia` i włączenie sprzedaży.
Do decyzji z prawnikiem: czy otwarta karma jest wyłączona ze zwrotu (art. 38 pkt 5), termin 7 dni na przelew, brak formalnego trwałego nośnika
(regulamin jest linkiem w e-mailu, nie załącznikiem PDF).

Krok 6 (zamówienie i płatności) jest wdrożony (PR #6 zatwierdzony, `06_zamowienie.sql` w bazie).
2026-11-14: na Vercelu ustawione `SUPABASE_SERVICE_ROLE_KEY` (klucz secret "default") i `CRON_SECRET`, Redeploy zrobiony;
mapa paczkomatów sprawdzona na produkcji (prawdziwe punkty InPost). Klucz secret był wklejony w czacie, więc 2026-11-14 został WYMIENIONY: nowy klucz `sklep2` wpisany na Vercelu przez Mariusza,
Redeploy zrobiony, stary `default` usunięty w Supabase; e-mail testowy z `/admin/integracje` na mormecs@gmail.com doszedł (klucz działa).
Kluczy nie wklejać już w czacie, tylko prosto na Vercelu.
Resend: konto na mormecs@gmail.com (logowanie Google), klucz zapisany w `integrations` (2026-11-14), kopie nowych zamówień
na mormecs@gmail.com (`integrations.notify_email`). Bez domeny Resend dostarcza TYLKO na mormecs@gmail.com - do testów
używać tego adresu jako e-maila klienta. W `settings` brak jeszcze e-maila sklepu.
Przelewy24: czeka na firmę (rejestracja i sandbox wymagają danych firmy; przy JDG może być konto prywatne).
Domena: Mariusz chce kupić domenę .pl - Vercel nie sprzedaje .pl, więc u polskiego sprzedawcy (OVH / home.pl / nazwa.pl),
potem serwery DNS `ns1.vercel-dns.com`, `ns2.vercel-dns.com`; Claude przez Vercel podłącza domenę, rekordy Resend
i MX skrzynki, potem ustawia `mail_from` (np. sklep@domena) i domenę w `/admin/ustawienia`.
Test: zalogowany administrator może składać zamówienia testowe przy wyłączonej sprzedaży (oznaczone TEST, do usunięcia).

**Połączenia Claude (od 2026-11-14):** Supabase (SQL Claude wykonuje sam - Mariusz nie musi już wklejać plików SQL)
i Vercel (zespół Dzialkowo, id `team_vifCDnAnRz7OdlGcn10I1NY1`: zmienne, wdrożenia, logi). Tajnych kluczy Supabase
połączenie nie pokazuje - te Mariusz kopiuje sam. Funkcje Vercela przeniesione do `fra1` (Frankfurt, 2026-11-14, `vercel.json` -> `regions`), baza też w Europie.

**Etap 1, Krok 7: Raporty dla księgowego - ZROBIONE 2026-11-14 (bez nowego SQL).** Następny: Krok 8 (start sprzedaży, regulamin,
cookies, test pełnego zakupu), szczegóły w `PLAN_BUDOWY.md`. Do ustalenia z księgowym: stawka VAT dla dostawy pobieranej od klienta
(w raporcie 23%), czy sprzedaż liczyć wg daty zamówienia (tak jest teraz) czy wpłaty, zwroty pieniędzy (jeszcze bez obsługi).
Prowizję Przelewy24 i rzeczywisty koszt dostawy wpisuje się ręcznie w zamówieniu (`/admin`, pola pod statusem).

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
- **Pliki SQL:** `supabase/schema.sql`, potem po kolei `01_ustawienia.sql`, `02_produkty.sql`, `03_import.sql`, `04_szukanie.sql`, `05_karta.sql`, `06_zamowienie.sql`, `07_zgody.sql`, `08_konto.sql`, `09_miejsca.sql`
  (każdy można uruchomić ponownie).
- **Adres sklepu:** https://sklep-zoologiczny.vercel.app (panel: `/admin`, ustawienia: `/admin/ustawienia`).
  Strony: `/kategoria/<slug>`, `/szukaj?q=...`, filtry w adresie (np. `?marka=brit,josera&wiek=senior&waga=1-3-kg&cena_od=20&dostepne=1&sort=cena-rosnaco&strona=2`).
- **Panel admina:** adres sklepu + `/admin` (zakładki: Zamówienia, Raporty, Produkty, Kategorie, Marki, Hurtownie,
  Import, Zgłoszenia, Opinie, Powiadomienia, Ustawienia, Integracje), logowanie e-mailem właściciela (użytkownik w Supabase Auth,
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
- [x] **Etap 1, Krok 7 (2026-11-14): raporty dla księgowego** (bez nowego SQL; nowa zależność `write-excel-file`). Zakładka `/admin/raporty`
      (`app/admin/raporty/page.js`): wybór miesiąca (strzałki), kafelki (zamówienia, zapłata brutto, przychód, koszt zakupu, prowizje,
      dopłata do dostawy, zysk i marża), tabela VAT należnego 8% / 23% (tylko przy czynnym VAT), najlepsze produkty (szt., przychód, zysk),
      lista zamówień z zyskiem, tabela ostatnich 12 miesięcy; ostrzeżenia: pozycje bez ceny zakupu (zysk zawyżony), zamówienia bez kosztu
      dostawy, nieopłacone. Eksport: `/admin/raporty/excel?miesiac=RRRR-MM` (`lib/reports-xlsx.js`, 3 arkusze: Zamówienia, Pozycje,
      Podsumowanie z uwagami dla księgowego). Liczenie: `lib/reports.js` (`calcOrder`, `summarize`, `topProducts`, `monthlyTable`):
      tylko zamówienia prawdziwe (bez `is_test`) i nieanulowane, miesiąc wg daty złożenia w strefie Europe/Warsaw; czynny VAT = kwoty netto
      (VAT liczony od sumy brutto danej stawki w zamówieniu), zwolniony = brutto, a VAT z zakupu zwiększa koszt (tak jak w formularzu produktu);
      dostawa od klienta 23% przy czynnym VAT. W zamówieniu (`/admin`) doszły pola "Prowizja płatności" (`orders.payment_fee`) i "Rzeczywisty
      koszt dostawy" (`orders.shipping_real_cost`), zapisywane w `updateOrder`. Przetestowane na danych próbnych (oba statusy VAT, plik
      otwarty w openpyxl, build produkcyjny); prawdziwych zamówień w bazie jeszcze nie ma. Uwaga:
      zamówienia testowe (`is_test`) są celowo pominięte w raportach, więc dane zobaczysz dopiero po pierwszym prawdziwym zamówieniu.
- [x] **Etap 2 (2026-11-14): konto klienta** (`supabase/08_konto.sql`; przetestowane na prawdziwej bazie w transakcji z cofnięciem: dopinanie zamówień po e-mailu, RLS,
      opinie tylko po zakupie, kupowane razem, przypomnienia). Zakup bez konta działa jak dotąd; konto jest dobrowolne.
      Logowanie (`app/konto/logowanie`, `app/konto/actions.js`, `app/auth/*`): link + 6-cyfrowy kod w jednym mailu, bez hasła. Link generuje serwer
      (`auth.admin.generateLink` kluczem serwisowym) i wysyła przez nasz Resend (`sendLoginEmail` w `lib/order-mail.js`, szablon `loginMail`), bez własnego SMTP w Supabase;
      limit 5 maili na godzinę na adres (liczone z `email_log`, rodzaj `logowanie`). Link prowadzi na `/auth/potwierdz` (przycisk, bo programy pocztowe zużywają linki
      przy podglądzie), kod wpisuje się na stronie logowania. Awaryjnie (brak klucza serwisowego / Resend) idzie zwykły mail Supabase i `/auth/callback`. Google: przycisk
      pojawia się sam, gdy `auth/v1/settings` mówi, że Google jest włączone (`googleEnabled` w `lib/account.js`); powrót przez `/auth/callback`.
      Po zalogowaniu `claim_orders()` dopina wcześniejsze zamówienia z tym samym potwierdzonym e-mailem. Nagłówek: `components/account/AccountLink.js` (stan sesji w przeglądarce).
      Panel klienta `app/konto/(panel)/`: Konto, Zamówienia (historia, "Zamów ponownie" = `reorderItems` + `ReorderButton`, linki "Przypomnij o karmie" i "Oceń produkt"),
      Moje zwierzęta (`lib/pets.js`: wiek, etap życia, link "Karma dla: Burek" z filtrami gatunek / wiek / wielkość), Przypomnienia o karmie, Moje dane (profil, wyłącznik przypomnień,
      usunięcie konta kluczem serwisowym; zamówienia zostają bez `user_id`). Zamówienie: dane i paczkomat z konta, pole "zapamiętaj dane na koncie", `create_order` zapisuje `orders.user_id`;
      strona zamówienia proponuje założenie konta. Przypomnienia (`reminders`): wariant + na ile dni starcza opakowanie + od kiedy; mail 5 dni przed końcem (`runFoodReminders`, cron),
      ponowny zakup tego wariantu zeruje licznik (w `create_order`), wypisanie jednym kliknięciem `/konto/wypisz?t=...` (token w `customer_profiles.unsub_token`);
      podpowiedź liczby dni z wagi zwierzaka tylko orientacyjnie (`foodDaysEstimate`, karma sucha, min. 1 kg netto). Opinie (`product_reviews`): tylko zalogowany klient po zakupie
      (zamówienie wysłane / zrealizowane), jedna na produkt z możliwością poprawy, autor "Anna K.", publikacja od razu, moderacja w `/admin/opinie` (ukryj / przywróć / usuń),
      gwiazdki i średnia przy tytule, `aggregateRating` w danych dla Google. Kupowane razem: `bought_together` (min. 2 wspólne zamówienia) w sekcji na karcie produktu.
      Teksty prawne uzupełnione o konto, zwierzęta, przypomnienia, opinie (`LEGAL_VERSION` = 2026-11-14-2). Middleware odświeża sesję na `/konto`, `/zamowienie`, `/admin`.
      Rejestracja klientów jest otwarta; sprawdzone, że wszystkie tabele mają RLS tylko dla administratora, a funkcje importu działają z uprawnieniami wywołującego.
- [x] Plan rozwoju i mapa myśli (`MAPA_MYSLI.md` + tablica), przebudowane 2026-11-13 po krytyce klienta.

## Do zrobienia

- [ ] **Etap 1: sklep, który sprzedaje:** marka, cechy, warianty (2 / 7 / 12 kg), kategorie drzewem,
      wyszukiwarka (marka, opis, literówki, podpowiedzi), filtry, sortowanie, stronicowanie, karta produktu
      (galeria, skład, dawkowanie, EAN, cena za kg, Omnibus), "Powiadom o dostępności", paczkomat z mapy,
      BLIK / Przelewy24, e-mail z potwierdzeniem, regulamin (kroki 0-7 zrobione; zostaje krok 8: start sprzedaży).
- [ ] **Formalności przed sprzedażą (Mariusz):** firma (JDG lub dopisanie do istniejącej), wpis do rejestru
      paszowego w powiatowym inspektoracie weterynarii, decyzja z księgowym o VAT (zwolnienie do 240 000 zł/rok)
      i formie podatku, umowa z hurtownią (zgoda na zdjęcia i opisy, częstotliwość aktualizacji stanów).
- [x] Etap 2: konto klienta (zrobione 2026-11-14, opis niżej w "Co jest zrobione"; do sprawdzenia na żywo, patrz NASTĘPNY KROK).
- [ ] Etap 3: katalog groomerów + mapa (PostGIS, OpenStreetMap), panel admina do salonów;
      publicznie dopiero z 20-30 salonami z Trójmiasta. Baza, panel i strony publiczne zrobione (2026-11-14), zostaje link z Moich zwierząt, zebranie salonów i włączenie katalogu, patrz NASTĘPNY KROK.
- [ ] Etap 4: opinie o salonach, ranking i odznaki, nowa strona główna (sklep + salony, zapis do Akademii).
- [ ] Etap 5: konta salonów, odpowiedzi na opinie.
- [ ] Etap 6: Akademia.
- [ ] Później (gdy produktów będzie > 20 tys.): przyspieszyć `search_products` (np. cechy produktu zapisane w kolumnie
      zamiast liczenia przy każdym zapytaniu). Synonimy można dopisywać w tabeli `search_synonyms` (na razie bez panelu).
- [ ] Drobne: Vercel Pro przed sprzedażą. Opcjonalnie włączyć w Supabase "Leaked password protection" (dziś bez znaczenia - logowanie bez hasła).

## Ważne zasady w kodzie

- Ceny, koszty dostawy i stany liczy baza (funkcja `create_order`, aktualna wersja w najnowszym pliku SQL,
  teraz `08_konto.sql`). Koszty dostawy są w dwóch miejscach: `lib/shop.js` i ten plik SQL - zmieniać razem.
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
- Konto klienta: dane konta (profil, zwierzęta, przypomnienia, opinie) ma RLS "tylko właściciel"; zamówienia klient widzi po `orders.user_id`. Nowe tabele klienta zawsze z RLS
  i bez uprawnień dla `anon`. Funkcje `security definer` dla klienta (`can_review`, `submit_review`, `product_extras`, `bought_together`) sprawdzają `auth.uid()` same.
- Maile logowania i przypomnień idą tylko przez serwer (klucz serwisowy + Resend). Bez własnej domeny Resend dostarcza tylko na mormecs@gmail.com - dopiero po domenie
  logować i dostawać przypomnienia będą wszyscy.
- Przypomnienia: `reminders_due()` i `reminders_mark_sent()` tylko dla `service_role`. Po wysłaniu licznik przesuwa się o kolejny okres.
- Katalog groomerów (`09_miejsca.sql`): miejsca w `places` (PostGIS, `geog` liczone z `lat`/`lng`, nie zapisywać ręcznie), status szkic / opublikowany / ukryty; klient widzi tylko opublikowane
  i tylko gdy `places_config.public_enabled`; administrator widzi wszystko (podgląd). Dane tylko dla admina (notatki, kontakt do właściciela) są w `place_private`, nie w `places`.
  Szukanie i profil liczy baza (`search_places`, `place_page`, `places_cities`), kod tylko czyta adres i rysuje. Mapa = ta sama lista (`p_per_page` do 200), bez osobnej funkcji.
  Groomer mobilny pasuje do "w pobliżu", gdy klient jest w jego `service_radius_km`. Publikacja wymaga miasta (i adresu poza groomerem mobilnym). Wielkość psa: `dog_size_class(kg)`.
  Etykiety usług i udogodnień: tabele `service_defs`, `feature_defs` (na razie bez panelu). Opinie i ranking dopiero w Etapie 4 (nie ma jeszcze tabeli opinii o salonach).
- Po każdym etapie aktualizować ten plik w repo i w dokumentach projektu Claude.
