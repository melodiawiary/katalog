-- =====================================================================
--  SKLEP ZOOLOGICZNY - schemat bazy danych dla Supabase
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
--  Potem uruchom kolejne pliki po kolei: 01_ustawienia.sql, ...
--  (nowsze pliki podmieniają niektóre funkcje, np. create_order).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- TABELE ----------------------------------------------------

create table if not exists public.categories (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text not null unique,
  emoji      text not null default '🐾',
  sort       int  not null default 0
);

create table if not exists public.products (
  id          bigint generated always as identity primary key,
  category_id bigint references public.categories (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  price       numeric(10,2) not null check (price >= 0),
  stock       int not null default 0 check (stock >= 0),
  image_url   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  number          bigint generated always as identity,
  created_at      timestamptz not null default now(),
  status          text not null default 'nowe'
                  check (status in ('nowe','oplacone','wyslane','zrealizowane','anulowane')),
  customer_name   text not null,
  email           text not null,
  phone           text not null,
  address         text not null,
  postal_code     text not null,
  city            text not null,
  notes           text not null default '',
  shipping_method text not null,
  payment_method  text not null,
  shipping_cost   numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0
);

create table if not exists public.order_items (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   bigint references public.products (id) on delete set null,
  product_name text not null,
  price        numeric(10,2) not null,
  quantity     int not null check (quantity > 0)
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------- FUNKCJE ---------------------------------------------------

-- Czy zalogowany użytkownik jest administratorem?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- UWAGA: aktualna wersja create_order jest w 01_ustawienia.sql (ta jest pierwotna).
-- Złożenie zamówienia: sprawdza dane, liczy ceny po stronie bazy,
-- zdejmuje towar ze stanu. Wszystko albo nic (jedna transakcja).
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
  v_order_id uuid;
  v_item     jsonb;
  v_product  public.products%rowtype;
  v_qty      int;
  v_subtotal numeric(10,2) := 0;
  v_shipping numeric(10,2);
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Koszyk jest pusty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Za dużo pozycji w koszyku';
  end if;
  if p_shipping not in ('kurier','paczkomat','odbior') then
    raise exception 'Wybierz sposób dostawy';
  end if;
  if p_payment not in ('przelew','pobranie') then
    raise exception 'Wybierz sposób płatności';
  end if;
  if coalesce(trim(p_customer->>'name'),'') = ''
     or coalesce(trim(p_customer->>'email'),'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or coalesce(trim(p_customer->>'phone'),'') = ''
     or coalesce(trim(p_customer->>'address'),'') = ''
     or coalesce(trim(p_customer->>'postal_code'),'') = ''
     or coalesce(trim(p_customer->>'city'),'') = '' then
    raise exception 'Uzupełnij poprawnie wszystkie dane do wysyłki';
  end if;

  insert into public.orders
    (customer_name, email, phone, address, postal_code, city, notes, shipping_method, payment_method)
  values (
    left(trim(p_customer->>'name'), 120),
    left(lower(trim(p_customer->>'email')), 160),
    left(trim(p_customer->>'phone'), 30),
    left(trim(p_customer->>'address'), 200),
    left(trim(p_customer->>'postal_code'), 10),
    left(trim(p_customer->>'city'), 80),
    left(coalesce(trim(p_customer->>'notes'), ''), 1000),
    p_shipping,
    p_payment
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := nullif(v_item->>'quantity', '')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Nieprawidłowa ilość produktu';
    end if;

    select * into v_product
      from public.products
     where id = (v_item->>'product_id')::bigint and active
       for update;

    if not found then
      raise exception 'Jeden z produktów w koszyku nie jest już dostępny';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Za mało sztuk na stanie: % (dostępne: %)', v_product.name, v_product.stock;
    end if;

    update public.products set stock = stock - v_qty where id = v_product.id;

    insert into public.order_items (order_id, product_id, product_name, price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty);

    v_subtotal := v_subtotal + v_product.price * v_qty;
  end loop;

  -- Koszty dostawy (aktualne wartości: lib/shop.js i 01_ustawienia.sql)
  v_shipping := case p_shipping
                  when 'kurier'    then 15.99
                  when 'paczkomat' then 12.99
                  else 0
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

-- Podsumowanie zamówienia dla klienta (strona "Dziękujemy").
-- Identyfikator zamówienia to losowy UUID, więc nie da się go zgadnąć.
create or replace function public.get_order(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'number', o.number,
    'created_at', o.created_at,
    'status', o.status,
    'customer_name', o.customer_name,
    'shipping_method', o.shipping_method,
    'payment_method', o.payment_method,
    'shipping_cost', o.shipping_cost,
    'total', o.total,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', i.product_name, 'price', i.price, 'quantity', i.quantity)
             order by i.id)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_id;
$$;

revoke all on function public.create_order(jsonb, jsonb, text, text) from public;
revoke all on function public.get_order(uuid) from public;
grant execute on function public.create_order(jsonb, jsonb, text, text) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- UPRAWNIENIA -----------------------------------------------
-- Potrzebne, gdy przy tworzeniu projektu wyłączono "Automatically expose new tables".
-- Co kto faktycznie widzi i zmienia, ograniczają zasady RLS poniżej.

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- ZABEZPIECZENIA (RLS) --------------------------------------

alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.admins      enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "kategorie - odczyt" on public.categories;
create policy "kategorie - odczyt" on public.categories
  for select using (true);
drop policy if exists "kategorie - admin" on public.categories;
create policy "kategorie - admin" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "produkty - odczyt" on public.products;
create policy "produkty - odczyt" on public.products
  for select using (active or public.is_admin());
drop policy if exists "produkty - admin" on public.products;
create policy "produkty - admin" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins - wlasny wpis" on public.admins;
create policy "admins - wlasny wpis" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "zamowienia - admin" on public.orders;
create policy "zamowienia - admin" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pozycje - admin" on public.order_items;
create policy "pozycje - admin" on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- ZDJĘCIA PRODUKTÓW (Storage) -------------------------------

insert into storage.buckets (id, name, public)
values ('produkty', 'produkty', true)
on conflict (id) do nothing;

drop policy if exists "zdjecia - admin dodaje" on storage.objects;
create policy "zdjecia - admin dodaje" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produkty' and public.is_admin());

drop policy if exists "zdjecia - admin zmienia" on storage.objects;
create policy "zdjecia - admin zmienia" on storage.objects
  for update to authenticated
  using (bucket_id = 'produkty' and public.is_admin());

drop policy if exists "zdjecia - admin usuwa" on storage.objects;
create policy "zdjecia - admin usuwa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produkty' and public.is_admin());

-- ---------- DANE PRZYKŁADOWE ------------------------------------------

insert into public.categories (name, slug, emoji, sort) values
  ('Psy',         'psy',         '🐶', 1),
  ('Koty',        'koty',        '🐱', 2),
  ('Gryzonie',    'gryzonie',    '🐹', 3),
  ('Ptaki',       'ptaki',       '🦜', 4),
  ('Akwarystyka', 'akwarystyka', '🐠', 5)
on conflict (slug) do nothing;

insert into public.products (category_id, name, slug, description, price, stock) values
  ((select id from public.categories where slug='psy'), 'Karma sucha dla psa z kurczakiem 3 kg', 'karma-sucha-pies-kurczak-3kg',
   'Pełnoporcjowa karma dla dorosłych psów średnich ras. Kurczak jako główne źródło białka.', 79.99, 25),
  ((select id from public.categories where slug='psy'), 'Smycz regulowana 2 m', 'smycz-regulowana-2m',
   'Wytrzymała smycz z taśmy nylonowej z miękkim uchwytem.', 39.90, 15),
  ((select id from public.categories where slug='psy'), 'Piłka gumowa dla psa', 'pilka-gumowa-pies',
   'Odporna na gryzienie piłka z naturalnej gumy, średnica 7 cm.', 19.99, 40),
  ((select id from public.categories where slug='koty'), 'Karma mokra dla kota z łososiem 12 x 85 g', 'karma-mokra-kot-losos-12x85',
   'Kawałki w sosie dla dorosłych kotów. Zestaw 12 saszetek.', 34.99, 30),
  ((select id from public.categories where slug='koty'), 'Drapak dla kota 60 cm', 'drapak-kot-60cm',
   'Stabilny drapak z sizalem i legowiskiem na szczycie.', 129.00, 8),
  ((select id from public.categories where slug='gryzonie'), 'Ściółka drzewna 15 l', 'sciolka-drzewna-15l',
   'Naturalna, chłonna ściółka dla chomików, świnek morskich i królików.', 24.50, 20),
  ((select id from public.categories where slug='ptaki'), 'Pokarm dla papużek falistych 1 kg', 'pokarm-papuzki-faliste-1kg',
   'Mieszanka nasion z dodatkiem witamin.', 17.99, 18),
  ((select id from public.categories where slug='akwarystyka'), 'Filtr wewnętrzny do akwarium 400 l/h', 'filtr-akwarium-400',
   'Cichy filtr do akwariów do 80 litrów, z gąbką w zestawie.', 89.00, 6)
on conflict (slug) do nothing;

-- =====================================================================
--  KONTO ADMINISTRATORA
--  1. Supabase -> Authentication -> Users -> Add user (e-mail + hasło,
--     zaznacz "Auto Confirm User").
--  2. Uruchom poniższe polecenie, wpisując swój e-mail:
--
--  insert into public.admins (user_id)
--  select id from auth.users where email = 'twoj@email.pl';
-- =====================================================================
