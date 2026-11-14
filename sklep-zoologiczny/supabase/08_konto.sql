-- =====================================================================
--  ETAP 2: konto klienta do zakupów
--  Uruchamiać PO 07_zgody.sql. Można uruchamiać wielokrotnie, nie kasuje danych.
--
--  - orders.user_id (zamówienie przypisane do konta; zakup bez konta nadal działa),
--    klient widzi tylko swoje zamówienia; zamówienia z tym samym (potwierdzonym) e-mailem
--    dopinają się do konta same (claim_orders)
--  - customer_profiles (dane i domyślna dostawa), pets (moje zwierzęta),
--    reminders (przypomnienie o karmie), product_reviews (opinie tylko po zakupie)
--  - bought_together (kupowane razem), product_extras (oceny, opinie, kupowane razem w jednym zapytaniu)
--  - create_order zapisuje konto klienta i przesuwa przypomnienie o karmie po ponownym zakupie
-- =====================================================================

-- ---------- ZAMÓWIENIA: konto ------------------------------------------

alter table public.orders add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists orders_user_idx on public.orders (user_id, created_at desc) where user_id is not null;
create index if not exists order_items_product_idx on public.order_items (product_id) where product_id is not null;

drop policy if exists "zamowienia - wlasne" on public.orders;
create policy "zamowienia - wlasne" on public.orders
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "pozycje - wlasne" on public.order_items;
create policy "pozycje - wlasne" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Dopięcie wcześniejszych zamówień (bez konta) o tym samym, potwierdzonym e-mailu
create or replace function public.claim_orders()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_n int;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update public.orders set user_id = auth.uid()
   where user_id is null and lower(email) = v_email;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------- PROFIL KLIENTA ----------------------------------------------

create table if not exists public.customer_profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '' check (char_length(full_name) <= 120),
  phone             text not null default '' check (char_length(phone) <= 30),
  shipping_method   text not null default 'paczkomat' check (shipping_method in ('paczkomat','kurier')),
  locker_id         text not null default '' check (char_length(locker_id) <= 20),
  locker_desc       text not null default '' check (char_length(locker_desc) <= 300),
  address           text not null default '' check (char_length(address) <= 200),
  postal_code       text not null default '' check (char_length(postal_code) <= 10),
  city              text not null default '' check (char_length(city) <= 80),
  reminders_enabled boolean not null default true,   -- wyłącznik wszystkich przypomnień o karmie
  unsub_token       uuid not null default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
drop policy if exists "profil - wlasny" on public.customer_profiles;
create policy "profil - wlasny" on public.customer_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "profil - admin" on public.customer_profiles;
create policy "profil - admin" on public.customer_profiles
  for select to authenticated using (public.is_admin());

-- ---------- MOJE ZWIERZĘTA -----------------------------------------------

create table if not exists public.pets (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  species     text not null default 'pies' check (species in ('pies','kot','inne')),
  breed       text not null default '' check (char_length(breed) <= 80),
  birth_date  date check (birth_date is null or (birth_date <= current_date and birth_date >= date '1990-01-01')),
  weight_kg   numeric(5,1) check (weight_kg is null or (weight_kg > 0 and weight_kg <= 120)),
  notes       text not null default '' check (char_length(notes) <= 500),  -- np. alergie pokarmowe zwierzaka
  created_at  timestamptz not null default now()
);
create index if not exists pets_user_idx on public.pets (user_id);

alter table public.pets enable row level security;
drop policy if exists "zwierzeta - wlasne" on public.pets;
create policy "zwierzeta - wlasne" on public.pets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.pets_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.pets where user_id = new.user_id) >= 10 then
    raise exception 'Możesz dodać do 10 zwierząt.';
  end if;
  return new;
end;
$$;
drop trigger if exists pets_limit on public.pets;
create trigger pets_limit before insert on public.pets for each row execute function public.pets_limit();

-- ---------- PRZYPOMNIENIE O KARMIE --------------------------------------
-- Przypomnienie = konkretny wariant (np. "Brit Care 12 kg"), na ile dni starcza opakowanie
-- i od kiedy liczymy (anchor_date: dzień zakupu albo dodania przypomnienia).
-- Mail idzie lead_days przed końcem opakowania. Ponowny zakup tego wariantu zeruje licznik (create_order).

create table if not exists public.reminders (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  pet_id        bigint references public.pets (id) on delete set null,
  variant_id    bigint not null references public.product_variants (id) on delete cascade,
  interval_days int not null check (interval_days between 7 and 365),
  lead_days     int not null default 5 check (lead_days between 0 and 30),
  anchor_date   date not null default ((now() at time zone 'Europe/Warsaw')::date),
  last_sent_at  timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (user_id, variant_id)
);
create index if not exists reminders_user_idx on public.reminders (user_id);
create index if not exists reminders_active_idx on public.reminders (anchor_date) where active;

alter table public.reminders enable row level security;
drop policy if exists "przypomnienia - wlasne" on public.reminders;
create policy "przypomnienia - wlasne" on public.reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and (pet_id is null or exists (select 1 from public.pets p where p.id = pet_id and p.user_id = auth.uid())));

create or replace function public.reminders_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.reminders where user_id = new.user_id) >= 30 then
    raise exception 'Możesz mieć do 30 przypomnień.';
  end if;
  return new;
end;
$$;
drop trigger if exists reminders_limit on public.reminders;
create trigger reminders_limit before insert on public.reminders for each row execute function public.reminders_limit();

-- Co wysłać dziś (tylko serwer sklepu, klucz serwisowy). Tylko warianty dostępne na stanie:
-- niedostępny wariant czeka, aż wróci do sprzedaży.
create or replace function public.reminders_due()
returns table (
  reminder_id bigint, user_id uuid, email text, full_name text, pet_name text,
  variant_id bigint, product_name text, variant_name text, slug text, multi boolean,
  unsub_token uuid, ends_on date
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.user_id, u.email::text, coalesce(cp.full_name, ''), pt.name,
         v.id, p.name, v.name, p.slug,
         (select count(*) > 1 from public.product_variants x where x.product_id = p.id and x.active),
         cp.unsub_token,
         r.anchor_date + r.interval_days
    from public.reminders r
    join auth.users u on u.id = r.user_id and u.email is not null and u.email_confirmed_at is not null
    join public.customer_profiles cp on cp.user_id = r.user_id and cp.reminders_enabled
    join public.product_variants v on v.id = r.variant_id and v.active and v.stock > 0
    join public.products p on p.id = v.product_id and p.active
    left join public.pets pt on pt.id = r.pet_id
   where r.active
     and (now() at time zone 'Europe/Warsaw')::date >= r.anchor_date + r.interval_days - r.lead_days
   order by r.user_id, r.anchor_date;
$$;

-- Po wysłaniu: następny przypomniany termin za kolejny okres (jeśli klient nie kupi, przypomnimy ponownie za okres)
create or replace function public.reminders_mark_sent(p_ids bigint[])
returns void
language sql security definer set search_path = public
as $$
  update public.reminders
     set last_sent_at = now(),
         anchor_date = greatest(anchor_date + interval_days, (now() at time zone 'Europe/Warsaw')::date)
   where id = any(p_ids);
$$;

-- Wypisanie jednym kliknięciem z maila (token z profilu, bez logowania)
create or replace function public.reminders_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.customer_profiles set reminders_enabled = false, updated_at = now() where unsub_token = p_token;
  return found;
end;
$$;

revoke all on function public.reminders_due() from public, anon, authenticated;
revoke all on function public.reminders_mark_sent(bigint[]) from public, anon, authenticated;
grant execute on function public.reminders_due() to service_role;
grant execute on function public.reminders_mark_sent(bigint[]) to service_role;

-- ---------- OPINIE O PRODUKTACH -----------------------------------------
-- Opinię może dodać tylko zalogowany klient, który kupił ten produkt (zamówienie wysłane lub zrealizowane).
-- Jedna opinia na produkt (można ją poprawić). Publikowana od razu; administrator może ukryć (np. wulgaryzmy).

create table if not exists public.product_reviews (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author      text not null default 'Klient',
  rating      smallint not null check (rating between 1 and 5),
  title       text not null default '' check (char_length(title) <= 100),
  body        text not null default '' check (char_length(body) <= 2000),
  status      text not null default 'opublikowana' check (status in ('opublikowana','ukryta')),
  hidden_note text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, status, created_at desc);

alter table public.product_reviews enable row level security;
drop policy if exists "opinie - wlasne" on public.product_reviews;
create policy "opinie - wlasne" on public.product_reviews
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "opinie - wlasne usuwanie" on public.product_reviews;
create policy "opinie - wlasne usuwanie" on public.product_reviews
  for delete to authenticated using (user_id = auth.uid());
drop policy if exists "opinie - admin" on public.product_reviews;
create policy "opinie - admin" on public.product_reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Czy klient może ocenić produkt: { logged_in, purchased, mine }
create or replace function public.can_review(p_product bigint)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when auth.uid() is null then jsonb_build_object('logged_in', false, 'purchased', false, 'mine', null)
  else jsonb_build_object(
    'logged_in', true,
    'purchased', exists (
        select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
         where oi.product_id = p_product and o.user_id = auth.uid()
           and o.status in ('wyslane','zrealizowane') and (not o.is_test or public.is_admin())),
    'mine', (select jsonb_build_object('rating', r.rating, 'title', r.title, 'body', r.body, 'status', r.status)
               from public.product_reviews r where r.product_id = p_product and r.user_id = auth.uid())
  ) end;
$$;

create or replace function public.submit_review(p_product bigint, p_rating int, p_title text, p_body text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_author text;
begin
  if auth.uid() is null then raise exception 'Zaloguj się, żeby dodać opinię.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Wybierz ocenę od 1 do 5 gwiazdek.'; end if;
  if not exists (
       select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
        where oi.product_id = p_product and o.user_id = auth.uid()
          and o.status in ('wyslane','zrealizowane') and (not o.is_test or public.is_admin())) then
    raise exception 'Opinię mogą dodać klienci, którzy kupili ten produkt (po wysłaniu zamówienia).';
  end if;

  select nullif(trim(full_name), '') into v_name from public.customer_profiles where user_id = auth.uid();
  -- "Anna Kowalska" -> "Anna K."
  v_author := case
    when v_name is null then 'Klient'
    when position(' ' in v_name) > 0
      then split_part(v_name, ' ', 1) || ' ' || upper(left(regexp_replace(v_name, '^.*\s', ''), 1)) || '.'
    else v_name end;

  insert into public.product_reviews (product_id, user_id, author, rating, title, body)
  values (p_product, auth.uid(), left(v_author, 80), p_rating::smallint,
          left(trim(coalesce(p_title, '')), 100), left(trim(coalesce(p_body, '')), 2000))
  on conflict (product_id, user_id) do update
     set rating = excluded.rating, title = excluded.title, body = excluded.body,
         author = excluded.author, updated_at = now();
  return (select status from public.product_reviews where product_id = p_product and user_id = auth.uid());
end;
$$;

-- ---------- KUPOWANE RAZEM -----------------------------------------------
-- Produkty, które klienci kupowali w tych samych zamówieniach co ten produkt (bez anulowanych i testowych).
-- Pokazujemy dopiero od p_min wspólnych zamówień. Kształt jak similar_products (do ProductCard).

create or replace function public.bought_together(p_product bigint, p_limit int default 6, p_min int default 2)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with co as (
    select oi2.product_id as pid, count(distinct oi2.order_id) as n
      from public.order_items oi1
      join public.orders o on o.id = oi1.order_id and o.status <> 'anulowane' and not o.is_test
      join public.order_items oi2 on oi2.order_id = oi1.order_id
                                 and oi2.product_id is not null and oi2.product_id <> oi1.product_id
     where oi1.product_id = p_product
     group by oi2.product_id
    having count(distinct oi2.order_id) >= greatest(coalesce(p_min, 2), 1)
  ),
  cand as (
    select p.id, p.slug, p.name, p.image_url, p.brand_id, c.emoji, co.n,
           vv.price_min, vv.stock, vv.n_var, vv.promo
      from co
      join public.products p on p.id = co.pid and p.active
      left join public.categories c on c.id = p.category_id
      cross join lateral (
        select min(public.effective_price(v)) as price_min,
               coalesce(sum(v.stock), 0)::int as stock,
               count(*)::int as n_var,
               coalesce(bool_or(public.effective_price(v) < v.price), false) as promo
          from public.product_variants v
         where v.product_id = p.id and v.active
      ) vv
     where vv.n_var > 0 and vv.stock > 0
  ),
  top as (
    select * from cand order by n desc, id desc limit least(greatest(coalesce(p_limit, 6), 1), 24)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'slug', t.slug, 'name', t.name, 'image_url', t.image_url,
           'emoji', t.emoji, 'brand', b.name,
           'price', t.price_min, 'stock', t.stock, 'variants', t.n_var, 'promo', t.promo,
           'regular_price', cv.price, 'lowest_30d', cv.lowest_30d,
           'unit_price', cv.unit_price, 'unit', cv.unit, 'variant_name', cv.name, 'variant_id', cv.id,
           'together', t.n
         ) order by t.n desc, t.id desc), '[]'::jsonb)
    from top t
    left join public.brands b on b.id = t.brand_id
    cross join lateral (
      select v.id, v.price, v.name, vp.lowest_30d, vp.unit_price, vp.unit
        from public.product_variants v
        join public.variant_prices vp on vp.variant_id = v.id
       where v.product_id = t.id and v.active
       order by public.effective_price(v), v.sort, v.id
       limit 1
    ) cv;
$$;

-- Oceny, opinie i "kupowane razem" do karty produktu
create or replace function public.product_extras(p_product bigint)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'rating_count', (select count(*) from public.product_reviews where product_id = p_product and status = 'opublikowana'),
    'rating_avg', (select round(avg(rating)::numeric, 1) from public.product_reviews where product_id = p_product and status = 'opublikowana'),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'author', r.author, 'rating', r.rating, 'title', r.title, 'body', r.body,
               'created_at', r.created_at) order by r.created_at desc)
        from (select * from public.product_reviews
               where product_id = p_product and status = 'opublikowana'
               order by created_at desc limit 30) r), '[]'::jsonb),
    'together', public.bought_together(p_product, 6, 2)
  )
  where exists (select 1 from public.products where id = p_product and (active or public.is_admin()));
$$;

-- ---------- UPRAWNIENIA --------------------------------------------------

revoke all on public.customer_profiles, public.pets, public.reminders, public.product_reviews from anon;
grant select, insert, update, delete on public.customer_profiles, public.pets, public.reminders, public.product_reviews to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on public.customer_profiles, public.pets, public.reminders, public.product_reviews to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.claim_orders() from public, anon;
revoke all on function public.can_review(bigint) from public;
revoke all on function public.submit_review(bigint, int, text, text) from public, anon;
revoke all on function public.reminders_unsubscribe(uuid) from public;
revoke all on function public.bought_together(bigint, int, int) from public;
revoke all on function public.product_extras(bigint) from public;
grant execute on function public.claim_orders() to authenticated;
grant execute on function public.can_review(bigint) to anon, authenticated;
grant execute on function public.submit_review(bigint, int, text, text) to authenticated;
grant execute on function public.reminders_unsubscribe(uuid) to anon, authenticated;
grant execute on function public.bought_together(bigint, int, int) to anon, authenticated;
grant execute on function public.product_extras(bigint) to anon, authenticated;

-- ---------- ZAMÓWIENIE (zastępuje wersję z 06_zamowienie.sql) -----------
-- To samo co w 06, plus: zamówienie dostaje konto zalogowanego klienta (user_id),
-- a ponowny zakup wariantu zeruje licznik jego przypomnienia o karmie.

create or replace function public.create_order(
  p_customer jsonb,
  p_items    jsonb,
  p_shipping text,
  p_payment  text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_order_id  uuid;
  v_item      jsonb;
  v_variant   public.product_variants%rowtype;
  v_product   public.products%rowtype;
  v_qty       int;
  v_price     numeric(10,2);
  v_purchase  numeric(10,2);
  v_multi     boolean;
  v_count     int;
  v_subtotal  numeric(10,2) := 0;
  v_shipping  numeric(10,2);
  v_test      boolean := false;
  v_locker    text := upper(trim(coalesce(p_customer->>'locker_id', '')));
  v_phone     text := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
begin
  if not coalesce((select sales_enabled from public.settings where id = 1), false) then
    if not public.is_admin() then
      raise exception 'Sklep jeszcze nie przyjmuje zamówień. Zapraszamy wkrótce!';
    end if;
    v_test := true;  -- sprzedaż wyłączona, zamawia administrator = zamówienie testowe
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Koszyk jest pusty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Za dużo pozycji w koszyku';
  end if;
  if p_shipping is null or p_shipping not in ('kurier','paczkomat') then
    raise exception 'Wybierz sposób dostawy';
  end if;
  if p_payment is null or p_payment not in ('przelew','pobranie','p24') then
    raise exception 'Wybierz sposób płatności';
  end if;
  if p_payment = 'p24' and not (public.shop_features()->>'p24')::boolean then
    raise exception 'Płatności online są chwilowo niedostępne. Wybierz inny sposób płatności.';
  end if;
  if coalesce(trim(p_customer->>'name'),'') = ''
     or coalesce(trim(p_customer->>'email'),'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Podaj imię i nazwisko oraz poprawny e-mail';
  end if;
  if v_phone !~ '^(48)?\d{9}$' then
    raise exception 'Podaj numer telefonu (9 cyfr) - kurier i paczkomat wysyłają na niego SMS';
  end if;
  if p_shipping = 'paczkomat' then
    if v_locker !~ '^[A-Z0-9-]{4,20}$' then
      raise exception 'Wybierz paczkomat z mapy';
    end if;
  elsif coalesce(trim(p_customer->>'address'),'') = ''
     or coalesce(trim(p_customer->>'postal_code'),'') !~ '^\d{2}-\d{3}$'
     or coalesce(trim(p_customer->>'city'),'') = '' then
    raise exception 'Uzupełnij adres dostawy (ulica, kod pocztowy 00-000, miejscowość)';
  end if;

  insert into public.orders
    (customer_name, email, phone, address, postal_code, city, notes, shipping_method, payment_method,
     locker_id, locker_desc, is_test, payment_status, user_id)
  values (
    left(trim(p_customer->>'name'), 120),
    left(lower(trim(p_customer->>'email')), 160),
    left(trim(p_customer->>'phone'), 30),
    left(coalesce(trim(p_customer->>'address'), ''), 200),
    left(coalesce(trim(p_customer->>'postal_code'), ''), 10),
    left(coalesce(trim(p_customer->>'city'), ''), 80),
    left(coalesce(trim(p_customer->>'notes'), ''), 1000),
    p_shipping,
    p_payment,
    case when p_shipping = 'paczkomat' then v_locker else '' end,
    case when p_shipping = 'paczkomat' then left(coalesce(trim(p_customer->>'locker_desc'), ''), 300) else '' end,
    v_test,
    case when p_payment = 'pobranie' then 'przy_odbiorze' else 'nieoplacone' end,
    auth.uid()
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := case when (v_item->>'quantity') ~ '^\d{1,3}$' then (v_item->>'quantity')::int end;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Nieprawidłowa ilość produktu';
    end if;

    if coalesce(v_item->>'variant_id', '') ~ '^\d{1,18}$' then
      select v.* into v_variant
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where v.id = (v_item->>'variant_id')::bigint and v.active and p.active
         for update of v;
    elsif coalesce(v_item->>'product_id', '') ~ '^\d{1,18}$' then
      select count(*) into v_count
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where p.id = (v_item->>'product_id')::bigint and v.active and p.active;
      if v_count > 1 then
        raise exception 'Wybierz wariant produktu (np. wielkość opakowania) i dodaj go do koszyka ponownie';
      end if;
      select v.* into v_variant
        from public.product_variants v
        join public.products p on p.id = v.product_id
       where p.id = (v_item->>'product_id')::bigint and v.active and p.active
         for update of v;
    else
      raise exception 'Nieprawidłowa pozycja w koszyku';
    end if;

    if not found or v_variant.id is null then
      raise exception 'Jeden z produktów w koszyku nie jest już dostępny';
    end if;

    select * into v_product from public.products where id = v_variant.product_id;
    v_multi := (select count(*) > 1 from public.product_variants
                 where product_id = v_product.id and active);

    if v_variant.stock < v_qty then
      raise exception 'Za mało sztuk na stanie: % (dostępne: %)',
        v_product.name || case when v_multi and v_variant.name <> '' then ' - ' || v_variant.name else '' end,
        v_variant.stock;
    end if;

    v_price := public.effective_price(v_variant);

    select purchase_price into v_purchase
      from public.variant_suppliers
     where variant_id = v_variant.id and purchase_price is not null
     order by is_main desc, purchase_price asc
     limit 1;

    update public.product_variants set stock = stock - v_qty where id = v_variant.id;

    if auth.uid() is not null then
      update public.reminders
         set anchor_date = (now() at time zone 'Europe/Warsaw')::date, last_sent_at = null
       where user_id = auth.uid() and variant_id = v_variant.id and active;
    end if;

    insert into public.order_items
      (order_id, product_id, variant_id, product_name, variant_name, ean,
       price, quantity, purchase_price, vat_rate)
    values
      (v_order_id, v_product.id, v_variant.id, v_product.name,
       case when v_multi then v_variant.name else '' end, v_variant.ean,
       v_price, v_qty, v_purchase, v_product.vat_rate);

    v_subtotal := v_subtotal + v_price * v_qty;
    v_variant := null;
    v_purchase := null;
  end loop;

  -- Koszty dostawy (te same wartości są w lib/shop.js)
  v_shipping := case p_shipping
                  when 'kurier'    then 15.99
                  when 'paczkomat' then 12.99
                end;
  if v_subtotal >= 200 then
    v_shipping := 0;  -- darmowa dostawa od 200 zł
  end if;

  update public.orders
     set shipping_cost = v_shipping,
         total         = v_subtotal + v_shipping
   where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text, text) from public;
grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;
