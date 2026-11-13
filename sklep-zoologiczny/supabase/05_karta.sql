-- =====================================================================
--  ETAP 1, KROK 5: karta produktu
--  Uruchamiać PO 04_szukanie.sql. Można uruchamiać wielokrotnie, nie kasuje danych.
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
--
--  - ustawienia wysyłki ("Wyślemy dziś / jutro"): godzina graniczna i czas przygotowania
--  - "Powiadom o dostępności": tabela stock_alerts + funkcja request_stock_alert
--  - product_page: wszystko do karty produktu jednym zapytaniem
--    (warianty z cenami i Omnibusem, galeria, cechy, podobne produkty)
-- =====================================================================

-- ---------- USTAWIENIA WYSYŁKI -----------------------------------------

alter table public.settings add column if not exists ship_cutoff        text not null default '13:00';
alter table public.settings add column if not exists ship_handling_days int  not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_ship_cutoff_check') then
    alter table public.settings add constraint settings_ship_cutoff_check
      check (ship_cutoff ~ '^([01]\d|2[0-3]):[0-5]\d$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_ship_handling_days_check') then
    alter table public.settings add constraint settings_ship_handling_days_check
      check (ship_handling_days between 0 and 14);
  end if;
end $$;

-- ---------- "POWIADOM O DOSTĘPNOŚCI" -----------------------------------

create table if not exists public.stock_alerts (
  id          bigint generated always as identity primary key,
  variant_id  bigint not null references public.product_variants (id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz                -- kiedy wysłaliśmy wiadomość (null = czeka)
);

create unique index if not exists stock_alerts_waiting_key
  on public.stock_alerts (variant_id, email) where notified_at is null;
create index if not exists stock_alerts_email_idx on public.stock_alerts (email, created_at);

alter table public.stock_alerts enable row level security;
revoke all on public.stock_alerts from anon;
grant select, insert, update, delete on public.stock_alerts to authenticated;
drop policy if exists "powiadomienia - admin" on public.stock_alerts;
create policy "powiadomienia - admin" on public.stock_alerts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Zapis klienta (bez logowania). Zwraca 'ok' albo 'juz' (ten e-mail już czeka na ten wariant).
create or replace function public.request_stock_alert(p_variant bigint, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Podaj poprawny adres e-mail.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.product_variants v
                   join public.products p on p.id = v.product_id
                  where v.id = p_variant and v.active and p.active) then
    raise exception 'Tego produktu nie ma już w ofercie.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.stock_alerts
              where variant_id = p_variant and email = v_email and notified_at is null) then
    return 'juz';
  end if;
  if (select count(*) from public.stock_alerts
       where email = v_email and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Z tego adresu zapisano już dziś wiele powiadomień. Spróbuj jutro.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.stock_alerts where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Za dużo zgłoszeń naraz. Spróbuj za chwilę.' using errcode = 'P0001';
  end if;

  insert into public.stock_alerts (variant_id, email) values (p_variant, v_email);
  return 'ok';
end;
$$;

-- ---------- PODOBNE PRODUKTY -------------------------------------------
-- Ta sama kategoria (albo siostrzana), wspólne cechy, ta sama marka; tylko dostępne.
-- Zwraca listę w tym samym kształcie co search_products (do ProductCard).

create or replace function public.similar_products(p_product bigint, p_limit int default 8)
returns jsonb
language sql stable
set search_path = public
as $$
  with me as (
    select p.id, p.category_id, p.brand_id, c.parent_id,
           (select min(public.effective_price(v)) from public.product_variants v
             where v.product_id = p.id and v.active) as price
      from public.products p
      left join public.categories c on c.id = p.category_id
     where p.id = p_product
  ),
  my_attr as (
    select av.attribute_id, av.id as value_id
      from public.product_attribute_values pav
      join public.attribute_values av on av.id = pav.value_id
     where pav.product_id = p_product
  ),
  cand as (
    select p.id, p.slug, p.name, p.image_url, p.brand_id, c.emoji,
           case when p.category_id = me.category_id then 3 else 1 end as cat_score,
           vv.price_min, vv.stock, vv.n_var, vv.promo
      from me
      join public.products p on p.id <> me.id and p.active
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
       and (p.category_id = me.category_id
            or (me.parent_id is not null and c.parent_id = me.parent_id))
  ),
  scored as (
    select cand.*,
           cand.cat_score
           + 2 * (select count(*) from public.product_attribute_values pav
                   where pav.product_id = cand.id and pav.value_id in (select value_id from my_attr))
           - (select count(distinct av.attribute_id)
                from public.product_attribute_values pav
                join public.attribute_values av on av.id = pav.value_id
               where pav.product_id = cand.id
                 and av.attribute_id in (select attribute_id from my_attr)
                 and not exists (select 1 from public.product_attribute_values pav2
                                  join public.attribute_values av2 on av2.id = pav2.value_id
                                 where pav2.product_id = cand.id and av2.attribute_id = av.attribute_id
                                   and pav2.value_id in (select value_id from my_attr)))
           + case when cand.brand_id is not null and cand.brand_id = (select brand_id from me) then 1 else 0 end
             as score,
           abs(ln(greatest(cand.price_min, 0.01) / greatest(coalesce((select price from me), cand.price_min), 0.01))) as price_gap
      from cand
  ),
  top as (
    select * from scored
     order by score desc, price_gap asc, id desc
     limit least(greatest(coalesce(p_limit, 8), 1), 24)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'slug', t.slug, 'name', t.name, 'image_url', t.image_url,
           'emoji', t.emoji, 'brand', b.name,
           'price', t.price_min, 'stock', t.stock, 'variants', t.n_var, 'promo', t.promo,
           'regular_price', cv.price, 'lowest_30d', cv.lowest_30d,
           'unit_price', cv.unit_price, 'unit', cv.unit, 'variant_name', cv.name, 'variant_id', cv.id
         ) order by t.score desc, t.price_gap asc, t.id desc), '[]'::jsonb)
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

-- ---------- KARTA PRODUKTU ---------------------------------------------
-- Jedno zapytanie: produkt, marka, warianty z cenami, galeria, cechy, podobne.
-- Działa z uprawnieniami osoby, która pyta: klient widzi tylko aktywne produkty,
-- administrator także ukryte (podgląd szkicu).

create or replace function public.product_page(p_slug text)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'description', p.description,
    'composition', p.composition, 'analysis', p.analysis, 'additives', p.additives, 'dosage', p.dosage,
    'image_url', p.image_url, 'active', p.active, 'category_id', p.category_id,
    'updated_at', p.updated_at,
    'emoji', (select emoji from public.categories where id = p.category_id),
    'brand', (select jsonb_build_object('name', b.name, 'slug', b.slug)
                from public.brands b where b.id = p.brand_id),
    'images', coalesce((select jsonb_agg(jsonb_build_object('url', i.url, 'alt', i.alt) order by i.sort, i.id)
                          from public.product_images i where i.product_id = p.id), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name, 'sku', v.sku, 'ean', v.ean,
               'price', v.price, 'effective_price', vp.effective_price, 'promo_active', vp.promo_active,
               'promo_to', case when vp.promo_active then v.promo_to end,
               'lowest_30d', vp.lowest_30d, 'unit_price', vp.unit_price, 'unit', v.unit,
               'net_quantity', v.net_quantity, 'stock', v.stock
             ) order by v.sort, v.id)
        from public.product_variants v
        join public.variant_prices vp on vp.variant_id = v.id
       where v.product_id = p.id and v.active), '[]'::jsonb),
    'attributes', coalesce((
      select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'values', vals) order by a.sort, a.id)
        from public.attributes a
        cross join lateral (
          select jsonb_agg(jsonb_build_object('value', av.value, 'slug', av.slug) order by av.sort, av.id) as vals
            from public.product_attribute_values pav
            join public.attribute_values av on av.id = pav.value_id
           where pav.product_id = p.id and av.attribute_id = a.id
        ) x
       where vals is not null), '[]'::jsonb),
    'similar', public.similar_products(p.id, 8)
  )
  from public.products p
  where p.slug = p_slug;
$$;

-- ---------- UPRAWNIENIA -----------------------------------------------

grant execute on function public.request_stock_alert(bigint, text) to anon, authenticated;
grant execute on function public.similar_products(bigint, int) to anon, authenticated;
grant execute on function public.product_page(text) to anon, authenticated;
