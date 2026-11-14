-- =====================================================================
--  ETAP 1, KROK 6: zamówienie i płatności
--  Uruchamiać PO 05_karta.sql. Można uruchamiać wielokrotnie, nie kasuje danych.
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
--
--  - zamówienie: paczkomat (kod + opis), status płatności, numer przesyłki, zamówienia testowe
--    (administrator może zamawiać przy wyłączonej sprzedaży - zamówienie jest oznaczone jako testowe)
--  - anulowanie zamówienia oddaje towar na stan (a usunięcie zamówienia testowego też)
--  - płatności Przelewy24 (tabela payments), dziennik e-maili (email_log)
--  - klucze usług (Resend, Przelewy24, InPost) w tabeli integrations - widzi je tylko administrator
--  - nowa wersja create_order i get_order (zastępuje 02_produkty.sql)
-- =====================================================================

-- ---------- ZAMÓWIENIA: nowe pola -------------------------------------

alter table public.orders add column if not exists locker_id         text not null default '';  -- kod paczkomatu, np. GDA01M
alter table public.orders add column if not exists locker_desc       text not null default '';  -- adres / opis paczkomatu
alter table public.orders add column if not exists payment_status    text not null default 'nieoplacone';
alter table public.orders add column if not exists paid_at           timestamptz;
alter table public.orders add column if not exists is_test           boolean not null default false;
alter table public.orders add column if not exists tracking_number   text not null default '';
alter table public.orders add column if not exists status_changed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    update public.orders set payment_status = 'przy_odbiorze' where payment_method = 'pobranie' and payment_status = 'nieoplacone';
    update public.orders set payment_status = 'oplacone', paid_at = coalesce(paid_at, created_at)
     where status in ('oplacone','wyslane','zrealizowane') and payment_method <> 'pobranie';
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('nieoplacone','oplacone','przy_odbiorze'));
  end if;
end $$;

create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- KLUCZE USŁUG (jeden wiersz, id = 1; tylko administrator) ----

create table if not exists public.integrations (
  id                     int primary key default 1 check (id = 1),
  resend_api_key         text not null default '',
  mail_from              text not null default '',   -- np. "Sklep <sklep@twojadomena.pl>"
  notify_email           text not null default '',   -- kopia nowych zamówień (puste = e-mail z ustawień)
  p24_enabled            boolean not null default false,
  p24_sandbox            boolean not null default true,
  p24_merchant_id        text not null default '',
  p24_pos_id             text not null default '',
  p24_crc                text not null default '',
  p24_api_key            text not null default '',
  inpost_geowidget_token text not null default '',
  updated_at             timestamptz not null default now()
);

insert into public.integrations (id) values (1) on conflict (id) do nothing;

alter table public.integrations enable row level security;
revoke all on public.integrations from anon;
grant select, update on public.integrations to authenticated;
drop policy if exists "integracje - admin" on public.integrations;
create policy "integracje - admin" on public.integrations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Co sklep może pokazać klientom (bez kluczy): czy jest Przelewy24, token mapy InPost
create or replace function public.shop_features()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'p24', coalesce(i.p24_enabled
                    and i.p24_merchant_id ~ '^\d+$'
                    and i.p24_crc <> '' and i.p24_api_key <> '', false),
    'p24_sandbox', coalesce(i.p24_sandbox, true),
    'geowidget_token', coalesce(i.inpost_geowidget_token, ''),
    'email', coalesce(i.resend_api_key <> '', false)
  )
  from (select 1) x left join public.integrations i on i.id = 1;
$$;

revoke all on function public.shop_features() from public;
grant execute on function public.shop_features() to anon, authenticated;

-- ---------- PŁATNOŚCI ONLINE -------------------------------------------
-- Każda próba zapłaty = osobny wiersz (klient może zapłacić ponownie po nieudanej próbie).

create table if not exists public.payments (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  provider     text not null default 'p24',
  session_id   text not null unique,
  amount       int  not null,                 -- w groszach
  token        text,
  status       text not null default 'nowa' check (status in ('nowa','oplacona','blad')),
  p24_order_id bigint,
  method_id    int,
  error        text,
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);

create index if not exists payments_order_idx on public.payments (order_id, created_at desc);

alter table public.payments enable row level security;
revoke all on public.payments from anon;
grant select on public.payments to authenticated;
drop policy if exists "platnosci - admin" on public.payments;
create policy "platnosci - admin" on public.payments
  for select to authenticated using (public.is_admin());

-- Zaksięgowanie wpłaty (wywołuje tylko serwer sklepu po weryfikacji w Przelewy24).
-- Zwraca { order_id, changed } - changed = true tylko przy pierwszym zaksięgowaniu.
create or replace function public.payment_paid(p_session text, p_p24_order bigint, p_method int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order uuid;
begin
  update public.payments
     set status = 'oplacona', p24_order_id = p_p24_order, method_id = p_method, paid_at = now(), error = null
   where session_id = p_session and status <> 'oplacona'
  returning order_id into v_order;

  if v_order is null then
    return (select jsonb_build_object('order_id', order_id, 'changed', false)
              from public.payments where session_id = p_session);
  end if;

  update public.orders
     set payment_status = 'oplacone',
         paid_at = coalesce(paid_at, now()),
         status = case when status = 'nowe' then 'oplacone' else status end
   where id = v_order and payment_status <> 'oplacone';

  return jsonb_build_object('order_id', v_order, 'changed', found);
end;
$$;

revoke all on function public.payment_paid(text, bigint, int) from public, anon, authenticated;
grant execute on function public.payment_paid(text, bigint, int) to service_role;

-- ---------- DZIENNIK E-MAILI -------------------------------------------

create table if not exists public.email_log (
  id         bigint generated always as identity primary key,
  order_id   uuid references public.orders (id) on delete cascade,
  kind       text not null,               -- potwierdzenie, status_wyslane, dostepny, test...
  to_email   text not null,
  subject    text not null default '',
  ok         boolean not null,
  error      text,
  created_at timestamptz not null default now()
);

create index if not exists email_log_order_idx on public.email_log (order_id, created_at);
create index if not exists email_log_created_idx on public.email_log (created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon;
grant select, insert, delete on public.email_log to authenticated;
grant usage, select on all sequences in schema public to authenticated;
drop policy if exists "maile - admin" on public.email_log;
create policy "maile - admin" on public.email_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Serwer sklepu (klucz service_role) widzi wszystko; w Supabase to domyślne, tu dla pewności
grant all on public.integrations, public.payments, public.email_log, public.orders,
             public.order_items, public.stock_alerts to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------- ZMIANA STATUSU: płatność i stany magazynowe ----------------

create or replace function public.orders_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    -- "Opłacone" ustawione ręcznie (np. przelew tradycyjny) = zapłacone
    if new.status = 'oplacone' and new.payment_method in ('przelew','p24')
       and new.payment_status = 'nieoplacone' then
      new.payment_status := 'oplacone';
      new.paid_at := coalesce(new.paid_at, now());
    end if;
    -- pobranie: zapłacone przy odbiorze
    if new.status = 'zrealizowane' and new.payment_method = 'pobranie' then
      new.payment_status := 'oplacone';
      new.paid_at := coalesce(new.paid_at, now());
    end if;
  end if;
  new.tracking_number := left(trim(coalesce(new.tracking_number, '')), 60);
  return new;
end;
$$;

drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update before update on public.orders
  for each row execute function public.orders_before_update();

-- Anulowanie oddaje towar na stan; cofnięcie anulowania znowu go zdejmuje
create or replace function public.orders_after_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  if new.status = 'anulowane' and old.status <> 'anulowane' then
    update public.product_variants v
       set stock = v.stock + i.qty
      from (select variant_id, sum(quantity) qty from public.order_items
             where order_id = new.id and variant_id is not null group by variant_id) i
     where v.id = i.variant_id;
  elsif old.status = 'anulowane' and new.status <> 'anulowane' then
    for r in select i.variant_id, sum(i.quantity) qty, max(i.product_name) pname
               from public.order_items i
              where i.order_id = new.id and i.variant_id is not null
              group by i.variant_id loop
      update public.product_variants set stock = stock - r.qty
       where id = r.variant_id and stock >= r.qty;
      if not found then
        raise exception 'Nie można przywrócić zamówienia: za mało sztuk na stanie (%).', r.pname;
      end if;
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists orders_after_update on public.orders;
create trigger orders_after_update after update of status on public.orders
  for each row execute function public.orders_after_update();

-- Usunąć można tylko zamówienie testowe; towar wraca na stan
create or replace function public.orders_before_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not old.is_test then
    raise exception 'Prawdziwego zamówienia nie można usunąć (potrzebne do księgowości). Zmień status na "Anulowane".';
  end if;
  if old.status <> 'anulowane' then
    update public.product_variants v
       set stock = v.stock + i.qty
      from (select variant_id, sum(quantity) qty from public.order_items
             where order_id = old.id and variant_id is not null group by variant_id) i
     where v.id = i.variant_id;
  end if;
  return old;
end;
$$;

drop trigger if exists orders_before_delete on public.orders;
create trigger orders_before_delete before delete on public.orders
  for each row execute function public.orders_before_delete();

-- ---------- ZAMÓWIENIE (zastępuje wersję z 02_produkty.sql) -----------
-- Pozycja koszyka: { "variant_id": 12, "quantity": 2 } albo { "product_id": 5, "quantity": 2 }
-- (gdy produkt ma jeden wariant). Paczkomat: p_customer.locker_id + locker_desc, adres niepotrzebny.
-- Płatność: przelew, pobranie, p24 (gdy Przelewy24 są włączone w panelu).
-- Przy wyłączonej sprzedaży zamawiać może tylko administrator - zamówienie jest testowe.

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
     locker_id, locker_desc, is_test, payment_status)
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
    case when p_payment = 'pobranie' then 'przy_odbiorze' else 'nieoplacone' end
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

-- Podsumowanie zamówienia dla klienta (strona zamówienia; adres zna tylko ten, kto ma link)
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
    'email', o.email,
    'phone', o.phone,
    'address', o.address,
    'postal_code', o.postal_code,
    'city', o.city,
    'shipping_method', o.shipping_method,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'locker_id', o.locker_id,
    'locker_desc', o.locker_desc,
    'tracking_number', o.tracking_number,
    'is_test', o.is_test,
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
grant execute on function public.get_order(uuid) to anon, authenticated, service_role;
