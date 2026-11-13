-- =====================================================================
--  ETAP 1, KROK 1: baza produktów 2.0
--  Uruchamiać PO schema.sql i 01_ustawienia.sql.
--  Można uruchamiać wielokrotnie, nie kasuje danych.
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
--
--  Co dochodzi:
--  - kategorie drzewem (Psy -> Karma -> Karma sucha)
--  - marki
--  - cechy produktu do filtrów (gatunek, wiek, wielkość psa, dieta, smak / białko)
--  - warianty (2 kg / 7 kg / 12 kg, S / M / L): własna cena, stan, EAN, ilość netto
--    (do ceny za kg / litr), cena promocyjna z datami
--  - galeria zdjęć, skład, składniki analityczne, dodatki, dawkowanie, stawka VAT
--  - hurtownie i kod produktu u hurtowni z ceną zakupu (widoczne tylko dla admina)
--  - historia cen i najniższa cena z 30 dni przed promocją (Omnibus)
--  - zamówienie zapisuje wariant, cenę zakupu, stawkę VAT; miejsce na prowizję
--
--  Zgodność wstecz: kolumny products.price i products.stock zostają jako
--  podsumowanie wariantów (najniższa cena, suma sztuk), liczone przez bazę.
--  Dzięki temu obecny sklep i panel działają bez zmian. Dopóki produkt ma
--  jeden wariant, edycja ceny / stanu produktu w panelu zmienia ten wariant.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- KATEGORIE DRZEWEM -----------------------------------------

alter table public.categories add column if not exists parent_id   bigint references public.categories (id) on delete restrict;
alter table public.categories add column if not exists description text not null default '';
alter table public.categories add column if not exists active      boolean not null default true;

create index if not exists categories_parent_idx on public.categories (parent_id);

-- Kategoria nie może być swoim własnym przodkiem (zapętlone drzewo)
create or replace function public.categories_guard()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null and exists (
    with recursive up as (
      select id, parent_id from public.categories where id = new.parent_id
      union all
      select c.id, c.parent_id from public.categories c join up on c.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'Kategoria nie może być podkategorią samej siebie';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_guard on public.categories;
create trigger categories_guard before insert or update of parent_id on public.categories
  for each row execute function public.categories_guard();

-- ---------- MARKI ------------------------------------------------------

create table if not exists public.brands (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  slug        text not null unique,
  logo_url    text,
  description text not null default '',
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- PRODUKT: nowe pola ----------------------------------------

alter table public.products add column if not exists brand_id    bigint references public.brands (id) on delete set null;
alter table public.products add column if not exists vat_rate    int not null default 23;
alter table public.products add column if not exists composition text not null default '';  -- skład
alter table public.products add column if not exists analysis    text not null default '';  -- składniki analityczne
alter table public.products add column if not exists additives   text not null default '';  -- dodatki
alter table public.products add column if not exists dosage      text not null default '';  -- dawkowanie
alter table public.products add column if not exists updated_at  timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_vat_rate_check') then
    alter table public.products add constraint products_vat_rate_check check (vat_rate in (0, 5, 8, 23));
  end if;
end $$;

create index if not exists products_brand_idx on public.products (brand_id);

-- ---------- WARIANTY ---------------------------------------------------

create table if not exists public.product_variants (
  id           bigint generated always as identity primary key,
  product_id   bigint not null references public.products (id) on delete cascade,
  name         text not null default '',              -- np. "2 kg", "M"; puste = jedyny wariant
  sku          text not null default '',              -- własny kod
  ean          text,                                  -- kod kreskowy
  price        numeric(10,2) not null check (price >= 0),
  promo_price  numeric(10,2) check (promo_price >= 0),
  promo_from   timestamptz,
  promo_to     timestamptz,
  stock        int not null default 0 check (stock >= 0),
  net_quantity numeric(10,3) check (net_quantity > 0), -- ilość netto, np. 2 (kg), 0.085 (kg), 1.5 (l)
  unit         text not null default 'szt' check (unit in ('kg', 'l', 'szt')),
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (promo_to is null or promo_from is null or promo_to > promo_from)
);

create index if not exists product_variants_product_idx on public.product_variants (product_id);
create unique index if not exists product_variants_ean_key on public.product_variants (ean) where ean is not null and ean <> '';

-- Cena, którą klient płaci teraz (promocja tylko w swoim terminie i niższa od ceny regularnej).
-- W zapytaniach Supabase dostępna jako pole: product_variants?select=*,effective_price
create or replace function public.effective_price(v public.product_variants)
returns numeric
language sql stable
as $$
  select case
           when v.promo_price is not null and v.promo_price < v.price
            and (v.promo_from is null or v.promo_from <= now())
            and (v.promo_to   is null or v.promo_to   >  now())
           then v.promo_price
           else v.price
         end;
$$;

-- ---------- GALERIA ----------------------------------------------------
-- products.image_url zostaje jako zdjęcie główne (okładka); tu są wszystkie zdjęcia.

create table if not exists public.product_images (
  id         bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id, sort);

-- ---------- CECHY PRODUKTU (do filtrów) --------------------------------

create table if not exists public.attributes (
  id         bigint generated always as identity primary key,
  code       text not null unique,          -- np. 'wiek'
  name       text not null,                 -- np. 'Wiek'
  sort       int not null default 0,
  filterable boolean not null default true
);

create table if not exists public.attribute_values (
  id           bigint generated always as identity primary key,
  attribute_id bigint not null references public.attributes (id) on delete cascade,
  value        text not null,               -- np. 'Senior'
  slug         text not null,               -- np. 'senior' (do adresu strony z filtrami)
  sort         int not null default 0,
  unique (attribute_id, slug)
);

create table if not exists public.product_attribute_values (
  product_id bigint not null references public.products (id) on delete cascade,
  value_id   bigint not null references public.attribute_values (id) on delete cascade,
  primary key (product_id, value_id)
);

create index if not exists product_attribute_values_value_idx on public.product_attribute_values (value_id);

-- ---------- HURTOWNIE (tylko admin) -----------------------------------

create table if not exists public.suppliers (
  id              bigint generated always as identity primary key,
  name            text not null unique,
  nip             text not null default '',
  email           text not null default '',
  phone           text not null default '',
  website         text not null default '',
  notes           text not null default '',
  import_settings jsonb not null default '{}'::jsonb,   -- krok 3: dopasowanie kolumn, reguła ceny
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Ten sam wariant może być w kilku hurtowniach; cena zakupu jest tutaj (nie widzą jej klienci)
create table if not exists public.variant_suppliers (
  variant_id     bigint not null references public.product_variants (id) on delete cascade,
  supplier_id    bigint not null references public.suppliers (id) on delete cascade,
  supplier_sku   text not null default '',             -- kod produktu u hurtowni
  purchase_price numeric(10,2) check (purchase_price >= 0),  -- cena zakupu netto
  supplier_stock int,                                  -- stan w hurtowni (z importu)
  is_main        boolean not null default false,       -- główne źródło (jego cena zakupu idzie do raportów)
  updated_at     timestamptz not null default now(),
  primary key (variant_id, supplier_id)
);

create unique index if not exists variant_suppliers_sku_key
  on public.variant_suppliers (supplier_id, supplier_sku) where supplier_sku <> '';
create index if not exists variant_suppliers_supplier_idx on public.variant_suppliers (supplier_id);

-- ---------- HISTORIA CEN (Omnibus) -------------------------------------

create table if not exists public.price_history (
  id          bigint generated always as identity primary key,
  variant_id  bigint not null references public.product_variants (id) on delete cascade,
  price       numeric(10,2) not null,
  promo_price numeric(10,2),
  promo_from  timestamptz,
  promo_to    timestamptz,
  changed_at  timestamptz not null default now()
);

create index if not exists price_history_variant_idx on public.price_history (variant_id, changed_at);

-- Najniższa cena z 30 dni przed p_until (domyślnie przed teraz),
-- z uwzględnieniem wcześniejszych promocji.
create or replace function public.lowest_price_30d(p_variant bigint, p_until timestamptz default now())
returns numeric
language sql stable
as $$
  with h as (
    select price, promo_price, promo_from, promo_to,
           changed_at as a,
           coalesce(lead(changed_at) over (order by changed_at, id), 'infinity'::timestamptz) as b
      from public.price_history
     where variant_id = p_variant
  ), w as (
    select p_until - interval '30 days' as ws, p_until as we
  )
  select min(x)
    from h, w,
         lateral (values
           (h.price),
           (case when h.promo_price is not null
                  and coalesce(h.promo_from, '-infinity'::timestamptz) < least(h.b, w.we)
                  and coalesce(h.promo_to,   'infinity'::timestamptz)  > greatest(h.a, w.ws)
                 then h.promo_price end)
         ) v(x)
   where h.a < w.we and h.b > w.ws;
$$;

-- Ceny wariantów gotowe do pokazania klientowi (krok 5: karta produktu)
create or replace view public.variant_prices with (security_invoker = true) as
select v.id as variant_id,
       v.product_id,
       v.price,
       public.effective_price(v) as effective_price,
       public.effective_price(v) < v.price as promo_active,
       case when public.effective_price(v) < v.price
            then public.lowest_price_30d(v.id, coalesce(v.promo_from, v.updated_at))
       end as lowest_30d,
       case when v.unit in ('kg', 'l') and v.net_quantity > 0
            then round(public.effective_price(v) / v.net_quantity, 2)
       end as unit_price,
       v.unit
  from public.product_variants v;

-- ---------- ZAMÓWIENIA: dane do raportów -------------------------------

alter table public.order_items add column if not exists variant_id     bigint references public.product_variants (id) on delete set null;
alter table public.order_items add column if not exists variant_name   text not null default '';
alter table public.order_items add column if not exists ean            text;
alter table public.order_items add column if not exists purchase_price numeric(10,2);  -- cena zakupu w chwili zamówienia
alter table public.order_items add column if not exists vat_rate       int;

alter table public.orders add column if not exists payment_fee        numeric(10,2) not null default 0;  -- prowizja (np. Przelewy24)
alter table public.orders add column if not exists shipping_real_cost numeric(10,2);                     -- faktyczny koszt wysyłki

-- ---------- AUTOMATY (triggery) ---------------------------------------
-- Uwaga na pg_trigger_depth(): triggery wywołują się nawzajem
-- (wariant -> produkt -> wariant), a ten warunek przerywa koło.

-- products.price / products.stock = najniższa cena i suma sztuk aktywnych wariantów
create or replace function public.refresh_product_summary(p_product bigint)
returns void
language sql
as $$
  update public.products p
     set price = coalesce(s.min_price, p.price),
         stock = coalesce(s.total, 0)
    from (select min(price) as min_price, sum(stock)::int as total
            from public.product_variants
           where product_id = p_product and active) s
   where p.id = p_product;
$$;

create or replace function public.variants_after_change()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_product_summary(new.product_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.product_id <> new.product_id) then
    perform public.refresh_product_summary(old.product_id);
  end if;
  return null;
end;
$$;

drop trigger if exists variants_after_change on public.product_variants;
create trigger variants_after_change after insert or update or delete on public.product_variants
  for each row execute function public.variants_after_change();

-- Promocja bez daty startu zaczyna się od razu (potrzebne do Omnibusa), updated_at
create or replace function public.variants_before_change()
returns trigger
language plpgsql
as $$
begin
  if new.promo_price is not null and new.promo_from is null then
    new.promo_from := now();
  end if;
  if new.promo_price is null then
    new.promo_from := null;
    new.promo_to := null;
  end if;
  new.ean := nullif(trim(coalesce(new.ean, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists variants_before_change on public.product_variants;
create trigger variants_before_change before insert or update on public.product_variants
  for each row execute function public.variants_before_change();

-- Każda zmiana ceny lub promocji trafia do historii
create or replace function public.variants_price_log()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT'
     or old.price       is distinct from new.price
     or old.promo_price is distinct from new.promo_price
     or old.promo_from  is distinct from new.promo_from
     or old.promo_to    is distinct from new.promo_to then
    insert into public.price_history (variant_id, price, promo_price, promo_from, promo_to)
    values (new.id, new.price, new.promo_price, new.promo_from, new.promo_to);
  end if;
  return null;
end;
$$;

drop trigger if exists variants_price_log on public.product_variants;
create trigger variants_price_log after insert or update on public.product_variants
  for each row execute function public.variants_price_log();

-- Nowy produkt dodany starym formularzem dostaje od razu jeden wariant
create or replace function public.products_after_insert()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.product_variants where product_id = new.id) then
    insert into public.product_variants (product_id, price, stock)
    values (new.id, new.price, new.stock);
  end if;
  return null;
end;
$$;

drop trigger if exists products_after_insert on public.products;
create trigger products_after_insert after insert on public.products
  for each row execute function public.products_after_insert();

-- Edycja ceny / stanu bezpośrednio w produkcie:
-- 1 wariant -> zmienia ten wariant; więcej wariantów -> podsumowanie zostaje z wariantów
create or replace function public.products_before_update()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  new.updated_at := now();
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  select count(*) into v_count from public.product_variants where product_id = new.id;
  if v_count = 1 then
    if new.price is distinct from old.price or new.stock is distinct from old.stock then
      update public.product_variants
         set price = new.price, stock = new.stock
       where product_id = new.id;
    end if;
  elsif v_count > 1 then
    select coalesce(min(price) filter (where active), new.price),
           coalesce(sum(stock) filter (where active), 0)
      into new.price, new.stock
      from public.product_variants
     where product_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_before_update on public.products;
create trigger products_before_update before update on public.products
  for each row execute function public.products_before_update();

-- ---------- ZAMÓWIENIE (zastępuje wersję z 01_ustawienia.sql) ---------
-- Pozycja koszyka: { "variant_id": 12, "quantity": 2 }
-- albo po staremu { "product_id": 5, "quantity": 2 } (działa, gdy produkt ma jeden aktywny wariant).
-- Bez zmian: blokada przy wyłączonej sprzedaży, bez odbioru osobistego.

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
begin
  if not coalesce((select sales_enabled from public.settings where id = 1), false) then
    raise exception 'Sklep jeszcze nie przyjmuje zamówień. Zapraszamy wkrótce!';
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
  if p_payment is null or p_payment not in ('przelew','pobranie') then
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

-- Podsumowanie zamówienia dla klienta (strona "Dziękujemy"), z nazwą wariantu
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
               'name', i.product_name || case when i.variant_name <> '' then ' - ' || i.variant_name else '' end,
               'price', i.price, 'quantity', i.quantity)
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
grant execute on function public.effective_price(public.product_variants) to anon, authenticated;
grant execute on function public.lowest_price_30d(bigint, timestamptz) to anon, authenticated;

-- ---------- UPRAWNIENIA -----------------------------------------------

grant select on public.brands, public.product_variants, public.product_images,
                public.attributes, public.attribute_values, public.product_attribute_values,
                public.price_history, public.variant_prices
  to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Hurtownie i ceny zakupu: bez dostępu dla niezalogowanych
revoke all on public.suppliers, public.variant_suppliers from anon;

-- ---------- ZABEZPIECZENIA (RLS) --------------------------------------

alter table public.brands                   enable row level security;
alter table public.product_variants         enable row level security;
alter table public.product_images           enable row level security;
alter table public.attributes               enable row level security;
alter table public.attribute_values         enable row level security;
alter table public.product_attribute_values enable row level security;
alter table public.suppliers                enable row level security;
alter table public.variant_suppliers        enable row level security;
alter table public.price_history            enable row level security;

drop policy if exists "marki - odczyt" on public.brands;
create policy "marki - odczyt" on public.brands
  for select using (active or public.is_admin());
drop policy if exists "marki - admin" on public.brands;
create policy "marki - admin" on public.brands
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "warianty - odczyt" on public.product_variants;
create policy "warianty - odczyt" on public.product_variants
  for select using (
    public.is_admin()
    or (active and exists (select 1 from public.products p where p.id = product_id and p.active))
  );
drop policy if exists "warianty - admin" on public.product_variants;
create policy "warianty - admin" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "galeria - odczyt" on public.product_images;
create policy "galeria - odczyt" on public.product_images
  for select using (
    public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.active)
  );
drop policy if exists "galeria - admin" on public.product_images;
create policy "galeria - admin" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cechy - odczyt" on public.attributes;
create policy "cechy - odczyt" on public.attributes for select using (true);
drop policy if exists "cechy - admin" on public.attributes;
create policy "cechy - admin" on public.attributes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wartosci cech - odczyt" on public.attribute_values;
create policy "wartosci cech - odczyt" on public.attribute_values for select using (true);
drop policy if exists "wartosci cech - admin" on public.attribute_values;
create policy "wartosci cech - admin" on public.attribute_values
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cechy produktu - odczyt" on public.product_attribute_values;
create policy "cechy produktu - odczyt" on public.product_attribute_values
  for select using (
    public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.active)
  );
drop policy if exists "cechy produktu - admin" on public.product_attribute_values;
create policy "cechy produktu - admin" on public.product_attribute_values
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "historia cen - odczyt" on public.price_history;
create policy "historia cen - odczyt" on public.price_history for select using (true);
drop policy if exists "historia cen - admin" on public.price_history;
create policy "historia cen - admin" on public.price_history
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hurtownie - admin" on public.suppliers;
create policy "hurtownie - admin" on public.suppliers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ceny zakupu - admin" on public.variant_suppliers;
create policy "ceny zakupu - admin" on public.variant_suppliers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- DANE STARTOWE: drzewo kategorii ---------------------------

insert into public.categories (name, slug, emoji, sort, parent_id)
select x.name, x.slug, x.emoji, x.sort, (select id from public.categories where slug = x.parent)
  from (values
    ('Karma',                      'psy-karma',               '🐶', 1, 'psy'),
    ('Przysmaki i gryzaki',        'psy-przysmaki',           '🐶', 2, 'psy'),
    ('Zabawki',                    'psy-zabawki',             '🐶', 3, 'psy'),
    ('Smycze, obroże i szelki',    'psy-spacer',              '🐶', 4, 'psy'),
    ('Legowiska i transportery',   'psy-legowiska',           '🐶', 5, 'psy'),
    ('Miski i poidła',             'psy-miski',               '🐶', 6, 'psy'),
    ('Pielęgnacja i zdrowie',      'psy-pielegnacja',         '🐶', 7, 'psy'),
    ('Karma',                      'koty-karma',              '🐱', 1, 'koty'),
    ('Przysmaki',                  'koty-przysmaki',          '🐱', 2, 'koty'),
    ('Żwirki i kuwety',            'koty-zwirki',             '🐱', 3, 'koty'),
    ('Drapaki i legowiska',        'koty-drapaki',            '🐱', 4, 'koty'),
    ('Zabawki',                    'koty-zabawki',            '🐱', 5, 'koty'),
    ('Miski i poidła',             'koty-miski',              '🐱', 6, 'koty'),
    ('Pielęgnacja i zdrowie',      'koty-pielegnacja',        '🐱', 7, 'koty')
  ) as x(name, slug, emoji, sort, parent)
 where exists (select 1 from public.categories where slug = x.parent)
on conflict (slug) do nothing;

insert into public.categories (name, slug, emoji, sort, parent_id)
select x.name, x.slug, x.emoji, x.sort, (select id from public.categories where slug = x.parent)
  from (values
    ('Karma sucha',          'psy-karma-sucha',           '🐶', 1, 'psy-karma'),
    ('Karma mokra',          'psy-karma-mokra',           '🐶', 2, 'psy-karma'),
    ('Karma weterynaryjna',  'psy-karma-weterynaryjna',   '🐶', 3, 'psy-karma'),
    ('Karma sucha',          'koty-karma-sucha',          '🐱', 1, 'koty-karma'),
    ('Karma mokra',          'koty-karma-mokra',          '🐱', 2, 'koty-karma'),
    ('Karma weterynaryjna',  'koty-karma-weterynaryjna',  '🐱', 3, 'koty-karma')
  ) as x(name, slug, emoji, sort, parent)
 where exists (select 1 from public.categories where slug = x.parent)
on conflict (slug) do nothing;

-- ---------- DANE STARTOWE: cechy --------------------------------------

insert into public.attributes (code, name, sort) values
  ('gatunek',  'Dla kogo',        1),
  ('wiek',     'Wiek',            2),
  ('wielkosc', 'Wielkość psa',    3),
  ('dieta',    'Dieta',           4),
  ('bialko',   'Smak / białko',   5)
on conflict (code) do nothing;

insert into public.attribute_values (attribute_id, value, slug, sort)
select (select id from public.attributes where code = x.code), x.value, x.slug, x.sort
  from (values
    ('gatunek',  'Pies',                 'pies',            1),
    ('gatunek',  'Kot',                  'kot',             2),
    ('gatunek',  'Gryzoń',               'gryzon',          3),
    ('gatunek',  'Ptak',                 'ptak',            4),
    ('gatunek',  'Ryba',                 'ryba',            5),
    ('wiek',     'Szczenię / kocię',     'junior',          1),
    ('wiek',     'Dorosły',              'dorosly',         2),
    ('wiek',     'Senior',               'senior',          3),
    ('wiek',     'Każdy wiek',           'kazdy-wiek',      4),
    ('wielkosc', 'Mini (do 5 kg)',       'mini',            1),
    ('wielkosc', 'Mała (5-10 kg)',       'mala',            2),
    ('wielkosc', 'Średnia (10-25 kg)',   'srednia',         3),
    ('wielkosc', 'Duża (25-45 kg)',      'duza',            4),
    ('wielkosc', 'Olbrzymia (od 45 kg)', 'olbrzymia',       5),
    ('dieta',    'Bez zbóż',             'bez-zboz',        1),
    ('dieta',    'Jedno białko',         'monobialkowa',    2),
    ('dieta',    'Hipoalergiczna',       'hipoalergiczna',  3),
    ('dieta',    'Weterynaryjna',        'weterynaryjna',   4),
    ('dieta',    'Light / odchudzająca', 'light',           5),
    ('dieta',    'Dla sterylizowanych',  'sterylizowane',   6),
    ('bialko',   'Kurczak',              'kurczak',         1),
    ('bialko',   'Indyk',                'indyk',           2),
    ('bialko',   'Kaczka',               'kaczka',          3),
    ('bialko',   'Wołowina',             'wolowina',        4),
    ('bialko',   'Jagnięcina',           'jagniecina',      5),
    ('bialko',   'Wieprzowina',          'wieprzowina',     6),
    ('bialko',   'Dziczyzna',            'dziczyzna',       7),
    ('bialko',   'Królik',               'krolik',          8),
    ('bialko',   'Łosoś',                'losos',           9),
    ('bialko',   'Ryba',                 'ryba',           10),
    ('bialko',   'Owady',                'owady',          11)
  ) as x(code, value, slug, sort)
on conflict (attribute_id, slug) do nothing;

-- ---------- PRZENIESIENIE OBECNYCH PRODUKTÓW --------------------------
-- Tylko przy pierwszym uruchomieniu: produkty bez wariantów dostają jeden wariant,
-- zdjęcie trafia do galerii, przykładowe produkty dostają podkategorie, VAT i cechy.

do $$
declare
  r record;
begin
  for r in
    select p.* from public.products p
     where not exists (select 1 from public.product_variants v where v.product_id = p.id)
  loop
    insert into public.product_variants (product_id, price, stock, net_quantity, unit)
    values (
      r.id, r.price, r.stock,
      case r.slug
        when 'karma-sucha-pies-kurczak-3kg'  then 3
        when 'karma-mokra-kot-losos-12x85'   then 1.02
        when 'pokarm-papuzki-faliste-1kg'    then 1
        when 'sciolka-drzewna-15l'           then 15
      end,
      case r.slug
        when 'karma-sucha-pies-kurczak-3kg'  then 'kg'
        when 'karma-mokra-kot-losos-12x85'   then 'kg'
        when 'pokarm-papuzki-faliste-1kg'    then 'kg'
        when 'sciolka-drzewna-15l'           then 'l'
        else 'szt'
      end
    );

    if r.image_url is not null and r.image_url <> ''
       and not exists (select 1 from public.product_images where product_id = r.id) then
      insert into public.product_images (product_id, url, alt, sort) values (r.id, r.image_url, r.name, 0);
    end if;

    -- karma = 8% VAT
    if r.slug in ('karma-sucha-pies-kurczak-3kg', 'karma-mokra-kot-losos-12x85', 'pokarm-papuzki-faliste-1kg') then
      update public.products set vat_rate = 8 where id = r.id;
    end if;

    -- podkategorie dla przykładowych produktów (tylko gdy siedzą w głównej kategorii)
    update public.products p
       set category_id = (select id from public.categories where slug = m.target)
      from (values
        ('karma-sucha-pies-kurczak-3kg', 'psy',  'psy-karma-sucha'),
        ('smycz-regulowana-2m',          'psy',  'psy-spacer'),
        ('pilka-gumowa-pies',            'psy',  'psy-zabawki'),
        ('karma-mokra-kot-losos-12x85',  'koty', 'koty-karma-mokra'),
        ('drapak-kot-60cm',              'koty', 'koty-drapaki')
      ) as m(slug, top, target)
     where p.id = r.id and p.slug = m.slug
       and p.category_id = (select id from public.categories where slug = m.top)
       and exists (select 1 from public.categories where slug = m.target);

    -- cechy przykładowych produktów
    insert into public.product_attribute_values (product_id, value_id)
    select r.id, av.id
      from (values
        ('karma-sucha-pies-kurczak-3kg', 'gatunek', 'pies'),
        ('karma-sucha-pies-kurczak-3kg', 'wiek', 'dorosly'),
        ('karma-sucha-pies-kurczak-3kg', 'wielkosc', 'srednia'),
        ('karma-sucha-pies-kurczak-3kg', 'bialko', 'kurczak'),
        ('smycz-regulowana-2m',          'gatunek', 'pies'),
        ('pilka-gumowa-pies',            'gatunek', 'pies'),
        ('karma-mokra-kot-losos-12x85',  'gatunek', 'kot'),
        ('karma-mokra-kot-losos-12x85',  'wiek', 'dorosly'),
        ('karma-mokra-kot-losos-12x85',  'bialko', 'losos'),
        ('drapak-kot-60cm',              'gatunek', 'kot'),
        ('sciolka-drzewna-15l',          'gatunek', 'gryzon'),
        ('pokarm-papuzki-faliste-1kg',   'gatunek', 'ptak'),
        ('filtr-akwarium-400',           'gatunek', 'ryba')
      ) as x(slug, code, value_slug)
      join public.attributes a on a.code = x.code
      join public.attribute_values av on av.attribute_id = a.id and av.slug = x.value_slug
     where x.slug = r.slug
    on conflict do nothing;
  end loop;
end $$;
