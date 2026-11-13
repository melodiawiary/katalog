# Sklep zoologiczny (Next.js + Supabase + Vercel)

Prosty, w pełni działający sklep internetowy z karmą i akcesoriami dla zwierząt.

**Dla klienta:** katalog z kategoriami i wyszukiwarką, strona produktu, koszyk, zamówienie
(kurier / paczkomat / odbiór osobisty, przelew lub płatność przy odbiorze), strona z danymi do przelewu.
Darmowa dostawa od 200 zł.

**Panel sklepu (`/admin`):** lista zamówień ze zmianą statusu, dodawanie i edycja produktów ze zdjęciami.

Ceny i stany magazynowe są liczone w bazie danych, więc klient nie może zmienić ceny w przeglądarce.

---

## Uruchomienie krok po kroku

### 1. Supabase (baza danych)

1. Załóż projekt na [supabase.com](https://supabase.com).
2. Wejdź w **SQL Editor -> New query**, wklej całą zawartość pliku `supabase/schema.sql` i kliknij **Run**.
   Powstaną tabele, zabezpieczenia, miejsce na zdjęcia i 8 przykładowych produktów.
3. **Authentication -> Users -> Add user -> Create new user**: wpisz swój e-mail i hasło, zaznacz *Auto Confirm User*.
4. W **SQL Editor** uruchom (ze swoim e-mailem):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'twoj@email.pl';
   ```
5. **Authentication -> Sign In / Providers**: wyłącz *Allow new users to sign up*, żeby nikt obcy nie mógł założyć konta.
6. **Project Settings -> API** (lub *Data API*): skopiuj **Project URL** i klucz **anon public**.

### 2. Vercel (hosting)

1. Na [vercel.com](https://vercel.com) kliknij **Add New -> Project** i wybierz repozytorium `katalog`.
2. **Root Directory**: kliknij *Edit* i wybierz folder `sklep-zoologiczny`. To ważne.
3. W **Environment Variables** dodaj:

   | Nazwa | Wartość |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL z Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klucz anon public |
   | `NEXT_PUBLIC_SHOP_NAME` | nazwa sklepu |
   | `NEXT_PUBLIC_BANK_ACCOUNT` | numer konta do przelewów |
   | `NEXT_PUBLIC_BANK_RECIPIENT` | nazwa i adres odbiorcy przelewu |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | e-mail kontaktowy |

4. Kliknij **Deploy**. Po chwili sklep działa pod adresem `twojprojekt.vercel.app`.
5. Panel: `twojprojekt.vercel.app/admin` (logujesz się kontem z punktu 1.3).

Każda zmiana wysłana do repozytorium na GitHubie automatycznie aktualizuje sklep.

### Uruchomienie na własnym komputerze (opcjonalnie)

```bash
cd sklep-zoologiczny
cp .env.example .env.local   # uzupełnij dane z Supabase
npm install
npm run dev                  # http://localhost:3000
```

---

## Gdzie co zmienić

- **Koszty dostawy, próg darmowej dostawy:** `lib/shop.js` oraz funkcja `create_order` w `supabase/schema.sql`
  (po zmianie SQL uruchom plik ponownie w Supabase - jest bezpieczny do ponownego uruchomienia).
- **Kategorie:** Supabase -> Table Editor -> `categories`.
- **Kolory i wygląd:** `app/globals.css` (zmienne na górze pliku).

## Przed startem sprzedaży

- Dodaj stronę z **regulaminem** i **polityką prywatności** (wymagane prawem, link w formularzu zamówienia).
- Rozważ płatności online (Przelewy24, PayU, Stripe) i automatyczne e-maile z potwierdzeniem zamówienia.
