-- =====================================================================
--  ETAP 1, KROK 0: dane firmy i tryb "przed startem"
--  Uruchamiać PO schema.sql. Można uruchamiać wielokrotnie, nie kasuje danych.
--  UWAGA: ten plik ma starą wersję create_order. Jeśli uruchomisz go ponownie,
--  uruchom potem jeszcze raz 02_produkty.sql (i kolejne).
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
-- =====================================================================

-- ---------- USTAWIENIA SKLEPU (zawsze jeden wiersz, id = 1) -----------

create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  shop_name        text not null default 'Sklep Zoologiczny',
  domain           text not null default '',
  company_name     text not null default '',
  owner_name       text not null default '',
  nip              text not null default '',
  regon            text not null default '',
  address          text not null default '',
  postal_code      text not null default '',
  city             text not null default '',
  email            text not null default '',
  phone            text not null default '',
  bank_account     text not null default '',
  vat_status       text not null default 'zwolniony' check (vat_status in ('zwolniony','czynny')),
  feed_register_no text not null default '',
  sales_enabled    boolean not null default false,
  updated_at       timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Lista brakujących danych (te same pola są w lib/settings.js)
create or replace function public.settings_missing(s public.settings)
returns text[]
language sql immutable
as $$
  select array_remove(array[
    case when trim(s.shop_name)        = '' then 'shop_name' end,
    case when trim(s.company_name)     = '' then 'company_name' end,
    case when trim(s.owner_name)       = '' then 'owner_name' end,
    case when regexp_replace(s.nip, '\D', '', 'g') !~ '^\d{10}$' then 'nip' end,
    case when regexp_replace(s.regon, '\D', '', 'g') !~ '^(\d{9}|\d{14})$' then 'regon' end,
    case when trim(s.address)          = '' then 'address' end,
    case when trim(s.postal_code) !~ '^\d{2}-\d{3}$' then 'postal_code' end,
    case when trim(s.city)             = '' then 'city' end,
    case when trim(s.email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'email' end,
    case when trim(s.phone)            = '' then 'phone' end,
    case when regexp_replace(s.bank_account, '[\s-]', '', 'g') !~ '^(PL)?\d{26}$' then 'bank_account' end,
    case when trim(s.feed_register_no) = '' then 'feed_register_no' end
  ], null);
$$;

-- Nie da się włączyć sprzedaży, dopóki brakuje danych
create or replace function public.settings_guard()
returns trigger
language plpgsql
as $$
begin
  new.id := 1;
  new.updated_at := now();
  if new.sales_enabled and cardinality(public.settings_missing(new)) > 0 then
    raise exception 'Nie można włączyć sprzedaży: uzupełnij dane firmy (%).',
      array_to_string(public.settings_missing(new), ', ');
  end if;
  return new;
end;
$$;

drop trigger if exists settings_guard on public.settings;
create trigger settings_guard before insert or update on public.settings
  for each row execute function public.settings_guard();

alter table public.settings enable row level security;

-- Dane firmy są jawne (stopka, regulamin, dane do przelewu), zmienia tylko admin
drop policy if exists "ustawienia - odczyt" on public.settings;
create policy "ustawienia - odczyt" on public.settings
  for select using (true);
drop policy if exists "ustawienia - admin" on public.settings;
create policy "ustawienia - admin" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;

-- ---------- ZAMÓWIENIE (zastępuje wersję z schema.sql; nowsza: 02_produkty.sql) ---
-- Zmiany: przyjmuje zamówienia tylko przy włączonej sprzedaży,
-- bez odbioru osobistego (wymagałby kasy fiskalnej).

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
  if not coalesce((select sales_enabled from public.settings where id = 1), false) then
    raise exception 'Sklep jeszcze nie przyjmuje zamówień. Zapraszamy wkrótce!';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Koszyk jest pusty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Za dużo pozycji w koszyku';
  end if;
  if p_shipping not in ('kurier','paczkomat') then
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
