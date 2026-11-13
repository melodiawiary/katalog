# STATUS - Sklep zoologiczny

Ostatnia aktualizacja: 2026-11-13

## Gdzie co jest

- **Kod:** GitHub `melodiawiary/katalog`, folder `sklep-zoologiczny` (gałąź `main`). Repo jest publiczne.
- **Technologia:** Next.js 15 (App Router, JavaScript) + Supabase + Vercel.
- **Baza:** Supabase, organizacja Dzialkowo, projekt "Sklep zoologiczny",
  adres `https://jetdtaijauawrsyobycl.supabase.co` (id: `jetdtaijauawrsyobycl`), region Europe, plan Free.
- **Hosting:** Vercel, zespół Dzialkowo, projekt `sklep-zoologiczny`, Root Directory = `sklep-zoologiczny`.
  Każdy push do `main` automatycznie aktualizuje sklep.
- **Zmienne na Vercelu:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SHOP_NAME`.
- **Panel admina:** adres sklepu + `/admin`, logowanie e-mailem właściciela (użytkownik w Supabase Auth,
  dopisany do tabeli `admins`).
- **Dostęp Claude do GitHuba:** aplikacja Claude ma dostęp do wszystkich repozytoriów (All repositories).

## Co jest zrobione

- [x] Kod sklepu: katalog z kategoriami i wyszukiwarką, strona produktu, koszyk, zamówienie
      (kurier 15,99 / paczkomat 12,99 / odbiór 0 zł, darmowa dostawa od 200 zł; przelew lub pobranie),
      strona "Dziękujemy" z danymi do przelewu.
- [x] Panel admina: zamówienia ze zmianą statusu, dodawanie/edycja/usuwanie produktów ze zdjęciami.
- [x] Baza: `supabase/schema.sql` uruchomiony w Supabase (tabele, RLS, funkcje `create_order` i `get_order`,
      bucket `produkty` na zdjęcia, 5 kategorii, 8 przykładowych produktów).
- [x] Konto administratora utworzone i dodane do `admins`.
- [x] Wdrożenie na Vercel działa (produkty wczytują się z Supabase).

## Do zrobienia / do sprawdzenia

- [ ] Sprawdzić: próbne zamówienie, logowanie do `/admin`, dodanie zdjęcia produktu.
- [ ] Supabase -> Authentication -> Sign In / Providers: wyłączyć "Allow new users to sign up".
- [ ] Dodać na Vercelu: `NEXT_PUBLIC_BANK_ACCOUNT`, `NEXT_PUBLIC_BANK_RECIPIENT`, `NEXT_PUBLIC_CONTACT_EMAIL`
      (po dodaniu: Redeploy).
- [ ] Regulamin i polityka prywatności (wymagane przed sprzedażą; link w formularzu zamówienia).
- [ ] Własne produkty i zdjęcia zamiast przykładowych.
- [ ] Ewentualnie: płatności online (Przelewy24 / PayU / Stripe), e-mail z potwierdzeniem zamówienia,
      własna domena, nazwa i wygląd sklepu.

## Ważne zasady w kodzie

- Ceny, koszty dostawy i stany liczy baza (funkcja `create_order`). Koszty dostawy są w dwóch miejscach:
  `lib/shop.js` i `supabase/schema.sql` - zmieniać razem.
- `schema.sql` można uruchamiać ponownie (nie kasuje danych).
- Nie trzymać w repo haseł ani kluczy (repo jest publiczne).
