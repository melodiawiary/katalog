-- Krok 8: zapis akceptacji regulaminu przy zamówieniu (dowód: kiedy i którą wersję klient zaakceptował).
-- Można uruchamiać wielokrotnie. Zapisuje serwer sklepu kluczem serwisowym po złożeniu zamówienia.
alter table public.orders add column if not exists terms_accepted_at timestamptz;
alter table public.orders add column if not exists terms_version text;
