# STATUS - Sklep zoologiczny + katalog groomerów

Ostatnia aktualizacja: 2026-11-13

## NASTĘPNY KROK

**Etap 1: katalog salonów (groomerów) + mapa i szukanie w okolicy.** Plan jest zatwierdzony.
Teraz budujemy infrastrukturę: liczba groomerów i treść na start nie są priorytetem.
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
- **Zmienne na Vercelu:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SHOP_NAME`.
- **Panel admina:** adres sklepu + `/admin`, logowanie e-mailem właściciela (użytkownik w Supabase Auth,
  dopisany do tabeli `admins`).
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
- [x] Plan rozwoju i mapa myśli (`MAPA_MYSLI.md` + tablica).

## Do zrobienia

- [ ] **Etap 1:** katalog miejsc (typ: groomer, furtka na weterynarza itd.), profile, usługi i cennik,
      mapa OpenStreetMap, "użyj mojej lokalizacji", najbliżsi w promieniu (PostGIS), filtry, panel admina
      do dodawania salonów. SQL w nowym pliku, np. `supabase/02_miejsca.sql`.
- [ ] Etap 2: konta klientów, opinie, ranking i odznaki.
- [ ] Etap 3: nowa strona główna (sklep + salony, zapis do Akademii).
- [ ] Etap 4: konta salonów, odpowiedzi na opinie.
- [ ] Etap 5: płatności online, e-maile.
- [ ] Etap 6: Akademia.
- [ ] Drobne: wyłączyć w Supabase "Allow new users to sign up" (do czasu etapu 2); dodać na Vercelu
      `NEXT_PUBLIC_BANK_ACCOUNT`, `NEXT_PUBLIC_BANK_RECIPIENT`, `NEXT_PUBLIC_CONTACT_EMAIL`; regulamin
      i polityka prywatności; nazwa serwisu i domena; Vercel Pro przed sprzedażą.

## Ważne zasady w kodzie

- Ceny, koszty dostawy i stany liczy baza (funkcja `create_order`). Koszty dostawy są w dwóch miejscach:
  `lib/shop.js` i `supabase/schema.sql` - zmieniać razem.
- Pliki SQL piszemy tak, żeby można je było uruchamiać ponownie (nie kasują danych).
- Kategorie sklepu zostają wszystkie; nacisk na psy i koty.
- Nie trzymać w repo haseł ani kluczy (repo jest publiczne).
- Po każdym etapie aktualizować ten plik w repo i w dokumentach projektu Claude.
