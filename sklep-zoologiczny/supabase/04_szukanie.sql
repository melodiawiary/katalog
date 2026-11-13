-- =====================================================================
--  ETAP 1, KROK 4: szukanie i przeglądanie
--  Uruchamiać PO schema.sql, 01_ustawienia.sql, 02_produkty.sql i 03_import.sql.
--  Można uruchamiać wielokrotnie, nie kasuje danych.
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
--
--  Co dochodzi:
--  - rozszerzenia unaccent i pg_trgm (bez polskich znaków, podobieństwo słów)
--  - w products: search_name, search_doc, search_tsv (tekst do szukania,
--    liczony automatycznie z nazwy, marki, kategorii, cech, wariantów i opisu)
--  - tabela search_synonyms (psa -> pies, kota -> kot...)
--  - funkcja search_products: wyszukiwarka + filtry + sortowanie + stronicowanie
--    + liczniki do filtrów + "może chodziło o..."
--  - funkcja search_suggest: podpowiedzi przy wpisywaniu
--  - tabela product_requests + funkcja request_product: "nie mamy? sprowadzimy"
-- =====================================================================

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ---------- NORMALIZACJA TEKSTU ----------------------------------------
-- "Karma dla PSA, łosoś 2kg!" -> "karma dla psa losos 2kg"

create or replace function public.search_norm(t text)
returns text
language sql immutable parallel safe
set search_path = public, extensions
as $$
  select trim(regexp_replace(lower(unaccent('unaccent', coalesce(t, ''))), '[^a-z0-9]+', ' ', 'g'));
$$;

-- Przedział wagi opakowania (filtr "Waga")
create or replace function public.weight_bucket(q numeric, u text)
returns text
language sql immutable parallel safe
as $$
  select case
           when u <> 'kg' or q is null then null
           when q <= 1  then 'do-1-kg'
           when q <= 3  then '1-3-kg'
           when q <= 7  then '3-7-kg'
           when q <= 12 then '7-12-kg'
           else 'ponad-12-kg'
         end;
$$;

-- ---------- SYNONIMY I ODMIANA -----------------------------------------
-- Słowo wpisane przez klienta (bez polskich znaków) -> słowo, które jest w opisach produktów.

create table if not exists public.search_synonyms (
  word   text primary key,
  target text not null
);

insert into public.search_synonyms (word, target) values
  ('psa','pies'), ('psy','pies'), ('psow','pies'), ('psem','pies'), ('psu','pies'), ('psie','pies'),
  ('psich','pies'), ('psiak','pies'), ('psiaka','pies'), ('psiaki','pies'), ('piesek','pies'),
  ('pieska','pies'), ('pieskow','pies'), ('dog','pies'),
  ('kota','kot'), ('koty','kot'), ('kotow','kot'), ('kotem','kot'), ('kotu','kot'), ('kotek','kot'),
  ('kotka','kot'), ('kotki','kot'), ('kotkow','kot'), ('cat','kot'),
  ('kociak','kocie'), ('kociaka','kocie'), ('kociaki','kocie'), ('kociat','kocie'), ('kocieta','kocie'),
  ('szczeniak','szczenie'), ('szczeniaka','szczenie'), ('szczeniaki','szczenie'),
  ('szczeniakow','szczenie'), ('szczeniat','szczenie'), ('szczenieta','szczenie'), ('puppy','szczenie'),
  ('junior','szczenie'), ('kitten','kocie'),
  ('starszy','senior'), ('starszego','senior'), ('starszych','senior'),
  ('chomik','gryzon'), ('chomika','gryzon'), ('krolika','krolik'), ('kroliki','krolik'),
  ('swinka','gryzon'), ('swinki','gryzon'), ('gryzonia','gryzon'), ('gryzonie','gryzon'),
  ('papuga','ptak'), ('papugi','ptak'), ('papuzki','ptak'), ('ptakow','ptak'), ('ptaki','ptak'),
  ('rybki','ryba'), ('ryby','ryba'), ('rybek','ryba'), ('akwarium','akwarystyka'),
  ('bezzbozowa','zboz'), ('bezzbozowy','zboz'), ('grainfree','zboz'),
  ('zwirek','zwirki'), ('zwirku','zwirki'), ('piasek','zwirki'),
  ('smycz','smycze'), ('obroza','obroze'), ('szelki','szelki'),
  ('kurczaka','kurczak'), ('kurczakiem','kurczak'), ('kura','kurczak'),
  ('drobiem','drob'), ('drobiu','drob'),
  ('lososia','losos'), ('lososiem','losos'), ('wolowiny','wolowina'),
  ('jagnieciny','jagniecina'),
  ('saszetki','mokra'), ('saszetka','mokra'), ('puszka','mokra'), ('puszki','mokra'),
  ('chrupki','sucha')
on conflict (word) do nothing;

alter table public.search_synonyms enable row level security;
drop policy if exists "synonimy - odczyt" on public.search_synonyms;
create policy "synonimy - odczyt" on public.search_synonyms for select using (true);
drop policy if exists "synonimy - admin" on public.search_synonyms;
create policy "synonimy - admin" on public.search_synonyms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- TEKST DO SZUKANIA W PRODUKCIE ------------------------------
-- search_name: nazwa, marka, kategoria (z nadrzędnymi), cechy -> literówki
-- search_doc:  to samo + nazwy wariantów, EAN i opis           -> początki słów
-- Liczone automatycznie przy każdej zmianie produktu (trigger poniżej).

alter table public.products add column if not exists search_name text not null default '';
alter table public.products add column if not exists search_doc  text not null default '';
alter table public.products add column if not exists search_tsv  tsvector;

create index if not exists products_search_tsv_idx  on public.products using gin (search_tsv);
create index if not exists products_search_name_idx on public.products using gin (search_name extensions.gin_trgm_ops);
create index if not exists products_active_idx      on public.products (active);

create or replace function public.products_search_fill()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_brand text;
  v_cats  text;
  v_attrs text;
  v_vars  text;
begin
  select name into v_brand from public.brands where id = new.brand_id;

  with recursive path as (
    select id, parent_id, name, 1 as depth from public.categories where id = new.category_id
    union all
    select c.id, c.parent_id, c.name, path.depth + 1
      from public.categories c join path on c.id = path.parent_id
     where path.depth < 10
  )
  select string_agg(name, ' ' order by depth desc) into v_cats from path;

  select string_agg(av.value, ' ') into v_attrs
    from public.product_attribute_values pav
    join public.attribute_values av on av.id = pav.value_id
   where pav.product_id = new.id;

  select string_agg(concat_ws(' ', v.name, v.ean, v.sku), ' ') into v_vars
    from public.product_variants v
   where v.product_id = new.id and v.active;

  new.search_name := public.search_norm(concat_ws(' ', new.name, v_brand, v_cats, v_attrs));
  new.search_doc  := public.search_norm(concat_ws(' ', new.name, v_brand, v_cats, v_attrs, v_vars, new.description));
  new.search_tsv  := setweight(to_tsvector('simple', public.search_norm(concat_ws(' ', new.name, v_brand))), 'A')
                  || setweight(to_tsvector('simple', public.search_norm(concat_ws(' ', v_cats, v_attrs, v_vars))), 'B')
                  || setweight(to_tsvector('simple', public.search_norm(left(new.description, 5000))), 'C');
  return new;
end;
$$;

-- nazwa "zz", żeby liczyło się po innych triggerach BEFORE (one mogą zmienić cenę / stan)
drop trigger if exists products_zz_search on public.products;
create trigger products_zz_search before insert or update on public.products
  for each row execute function public.products_search_fill();

-- Zmiany w markach, kategoriach i cechach odświeżają tekst produktów
create or replace function public.search_touch_products()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'brands' then
    if tg_op = 'UPDATE' and old.name is not distinct from new.name then return null; end if;
    update public.products set updated_at = updated_at where brand_id = new.id;
  elsif tg_table_name = 'categories' then
    if tg_op = 'UPDATE' and old.name is not distinct from new.name
       and old.parent_id is not distinct from new.parent_id then return null; end if;
    -- kategoria i wszystkie jej podkategorie
    update public.products set updated_at = updated_at
     where category_id in (
       with recursive t as (
         select new.id as id
         union
         select c.id from public.categories c join t on c.parent_id = t.id
       ) select id from t);
  elsif tg_table_name = 'product_attribute_values' then
    update public.products set updated_at = updated_at
     where id = case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  end if;
  return null;
end;
$$;

drop trigger if exists brands_search_touch on public.brands;
create trigger brands_search_touch after update on public.brands
  for each row execute function public.search_touch_products();

drop trigger if exists categories_search_touch on public.categories;
create trigger categories_search_touch after update on public.categories
  for each row execute function public.search_touch_products();

drop trigger if exists pav_search_touch on public.product_attribute_values;
create trigger pav_search_touch after insert or delete on public.product_attribute_values
  for each row execute function public.search_touch_products();

-- Nazwy wariantów: zmiana wariantu i tak aktualizuje produkt (cena / stan w 02_produkty.sql),
-- a tu dochodzi zmiana samej nazwy, EAN lub kodu.
create or replace function public.variants_search_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.name is not distinct from new.name and old.ean is not distinct from new.ean
     and old.sku is not distinct from new.sku and old.active is not distinct from new.active then
    return null;
  end if;
  update public.products set updated_at = updated_at
   where id = case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  return null;
end;
$$;

drop trigger if exists variants_search_touch on public.product_variants;
create trigger variants_search_touch after insert or update or delete on public.product_variants
  for each row execute function public.variants_search_touch();

-- Wypełnienie dla istniejących produktów
update public.products set updated_at = updated_at;

-- ---------- ROZBIÓR ZAPYTANIA ------------------------------------------
-- "Karmy dla psów" -> grupy słów: {"karmy|karm", "psow|pies|psow"}
-- Każda grupa musi pasować (I), w grupie wystarczy jedno słowo (LUB).

create or replace function public.search_groups(p_q text)
returns text[]
language sql stable
set search_path = public, extensions
as $$
  with words as (
    select w, min(ord) as ord
      from unnest(string_to_array(public.search_norm(p_q), ' ')) with ordinality as x(w, ord)
     where w <> ''
       and w not in ('dla','i','z','ze','do','na','w','we','o','od','po','a','oraz','lub','the','for','with','and')
     group by w
     order by min(ord)
     limit 8
  )
  select coalesce(array_agg(
           (select string_agg(a, '|' order by i)
              from (select a, min(i) as i
                      from unnest(array[
                             w,
                             (select target from public.search_synonyms s where s.word = w),
                             case when length(w) >= 7 and w !~ '^[0-9]+$' then left(w, length(w) - 2)
                                  when length(w) >= 5 and w !~ '^[0-9]+$' then left(w, length(w) - 1) end
                           ]) with ordinality as t(a, i)
                     where a is not null and a <> ''
                     group by a) alts)
           order by ord), '{}')
    from words;
$$;

-- tsquery dla grup: każda grupa = (słowo1:* | słowo2:*), grupy połączone przez & (p_and) albo | (ranking)
create or replace function public.search_tsquery(p_groups text[], p_and boolean)
returns tsquery
language sql immutable
as $$
  select case when coalesce(array_length(p_groups, 1), 0) = 0 then null
         else to_tsquery('simple', string_agg(
                '(' || (select string_agg(a || ':*', ' | ') from unnest(string_to_array(g, '|')) a) || ')',
                case when p_and then ' & ' else ' | ' end))
         end
    from unnest(p_groups) g;
$$;

-- Czy produkt pasuje do wszystkich grup (początek słowa albo literówka w nazwie / marce / kategorii / cechach)
create or replace function public.search_match(p_tsv tsvector, p_name text, p_groups text[])
returns boolean
language sql stable
set search_path = public, extensions
as $$
  select not exists (
    select 1
      from unnest(p_groups) g
     where not exists (
       select 1
         from unnest(string_to_array(g, '|')) a
        where p_tsv @@ to_tsquery('simple', a || ':*')
           or (length(a) >= 4 and a !~ '^[0-9]+$' and word_similarity(a, p_name) >= 0.45)
     )
  );
$$;

-- "Może chodziło o...": każde słowo zamienione na najbardziej podobne słowo z katalogu
create or replace function public.search_did_you_mean(p_q text)
returns text
language plpgsql stable
security definer
set search_path = public, extensions
set jit = off
as $$
declare
  v_words text[] := string_to_array(public.search_norm(p_q), ' ');
  v_out   text[] := '{}';
  v_w     text;
  v_best  text;
  v_changed boolean := false;
begin
  if coalesce(array_length(v_words, 1), 0) = 0 then return null; end if;
  foreach v_w in array v_words[1:6] loop
    if length(v_w) < 3 or v_w ~ '^[0-9]+$'
       or v_w in ('dla','i','z','ze','do','na','w','we','o','od','po','a','oraz','lub') then
      v_out := v_out || v_w;
      continue;
    end if;
    select d.w into v_best
      from (select distinct x as w
              from public.products p, unnest(string_to_array(p.search_name, ' ')) x
             where p.active and length(x) >= 3) d
     where similarity(d.w, v_w) >= 0.3
     order by similarity(d.w, v_w) desc, length(d.w)
     limit 1;
    if v_best is null then
      v_changed := true;              -- słowa bez odpowiednika w katalogu pomijamy
    elsif v_best <> v_w then
      v_changed := true;
      v_out := v_out || v_best;
    else
      v_out := v_out || v_w;
    end if;
  end loop;
  return case when v_changed and coalesce(array_length(v_out, 1), 0) > 0
                   and exists (select 1 from unnest(v_out) w where length(w) >= 3)
              then array_to_string(v_out, ' ') end;
end;
$$;

-- ---------- WYSZUKIWARKA I PRZEGLĄDANIE --------------------------------
-- p_q         tekst z wyszukiwarki ('' = wszystkie produkty)
-- p_category  slug kategorii (z podkategoriami) albo null
-- p_filters   { "marka": ["brit"], "attr": { "wiek": ["senior"], "wielkosc": ["duza"] },
--               "cena_od": 20, "cena_do": 100, "waga": ["1-3-kg"], "dostepne": true, "promocje": true }
-- p_sort      trafnosc | popularne | nowosci | cena-rosnaco | cena-malejaco | nazwa
-- Wynik: { total, page, per_page, items: [...], facets: {...}, did_you_mean }
-- Liczniki przy filtrach liczą wszystkie pozostałe filtry poza swoim (jak w dużych sklepach).

create or replace function public.search_products(
  p_q        text    default '',
  p_category text    default null,
  p_filters  jsonb   default '{}'::jsonb,
  p_sort     text    default null,
  p_page     int     default 1,
  p_per_page int     default 24
)
returns jsonb
language plpgsql stable
security definer
set search_path = public, extensions
set jit = off
as $$
declare
  v_f       jsonb := coalesce(p_filters, '{}'::jsonb);
  v_groups  text[] := public.search_groups(p_q);
  v_has_q   boolean;
  v_tsq_or  tsquery;
  v_qclean  text;
  v_code    text := nullif(lower(regexp_replace(coalesce(p_q, ''), '\s', '', 'g')), '');
  v_cat_id  bigint;
  v_brands  text[];
  v_weights text[];
  v_pmin    numeric;
  v_pmax    numeric;
  v_avail   boolean := coalesce((v_f->>'dostepne')::boolean, false);
  v_promo   boolean := coalesce((v_f->>'promocje')::boolean, false);
  v_attr    jsonb := case when jsonb_typeof(v_f->'attr') = 'object' then v_f->'attr' else '{}'::jsonb end;
  v_sort    text;
  v_per     int := least(greatest(coalesce(p_per_page, 24), 1), 60);
  v_page    int := least(greatest(coalesce(p_page, 1), 1), 1000);
  v_result  jsonb;
begin
  if v_code is not null and (length(v_code) < 3 or length(v_code) > 40) then v_code := null; end if;
  v_has_q  := coalesce(array_length(v_groups, 1), 0) > 0 or v_code is not null;
  v_tsq_or := public.search_tsquery(v_groups, false);
  v_qclean := (select string_agg(split_part(g, '|', 1), ' ') from unnest(v_groups) g);

  if p_category is not null and p_category <> '' then
    select id into v_cat_id from public.categories where slug = p_category;
    if v_cat_id is null then
      return jsonb_build_object('total', 0, 'page', v_page, 'per_page', v_per, 'items', '[]'::jsonb,
                                'facets', '{}'::jsonb, 'did_you_mean', null, 'error', 'brak kategorii');
    end if;
  end if;

  if jsonb_typeof(v_f->'marka') = 'array' and jsonb_array_length(v_f->'marka') > 0 then
    select array_agg(x) into v_brands from jsonb_array_elements_text(v_f->'marka') x;
  end if;
  if jsonb_typeof(v_f->'waga') = 'array' and jsonb_array_length(v_f->'waga') > 0 then
    select array_agg(x) into v_weights from jsonb_array_elements_text(v_f->'waga') x;
  end if;
  if coalesce(v_f->>'cena_od', '') ~ '^\d+(\.\d+)?$' then v_pmin := (v_f->>'cena_od')::numeric; end if;
  if coalesce(v_f->>'cena_do', '') ~ '^\d+(\.\d+)?$' then v_pmax := (v_f->>'cena_do')::numeric; end if;

  v_sort := case when p_sort in ('trafnosc','popularne','nowosci','cena-rosnaco','cena-malejaco','nazwa') then p_sort
                 when v_has_q then 'trafnosc'
                 else 'popularne' end;
  if v_sort = 'trafnosc' and not v_has_q then v_sort := 'popularne'; end if;

  with recursive cat as (
    select v_cat_id as id where v_cat_id is not null
    union
    select c.id from public.categories c join cat on c.parent_id = cat.id
  ),
  base as (
    select p.id, p.slug, p.name, p.image_url, p.created_at, p.category_id, p.search_name,
           b.slug as brand_slug, b.name as brand_name, c.emoji,
           vv.price_min, vv.stock, vv.n_var, vv.promo, vv.weights,
           coalesce((select array_agg(a.code || ':' || av.slug)
                       from public.product_attribute_values pav
                       join public.attribute_values av on av.id = pav.value_id
                       join public.attributes a on a.id = av.attribute_id
                      where pav.product_id = p.id), '{}') as attrs,
           case when v_has_q then
                  coalesce(ts_rank(p.search_tsv, v_tsq_or), 0)
                + case when v_qclean is not null then word_similarity(v_qclean, p.search_name) else 0 end
                + case when v_qclean is not null and p.search_name like v_qclean || '%' then 1 else 0 end
                + case when v_code is not null and exists (
                         select 1 from public.product_variants v
                          where v.product_id = p.id and v.active and (v.ean = v_code or lower(v.sku) = v_code)) then 5 else 0 end
                else 0 end as rank
      from public.products p
      left join public.brands b on b.id = p.brand_id
      left join public.categories c on c.id = p.category_id
      cross join lateral (
        select min(public.effective_price(v)) as price_min,
               coalesce(sum(v.stock), 0)::int as stock,
               count(*)::int as n_var,
               coalesce(bool_or(public.effective_price(v) < v.price), false) as promo,
               coalesce(array_agg(distinct public.weight_bucket(v.net_quantity, v.unit))
                          filter (where public.weight_bucket(v.net_quantity, v.unit) is not null), '{}') as weights
          from public.product_variants v
         where v.product_id = p.id and v.active
      ) vv
     where p.active
       and vv.n_var > 0
       and (v_cat_id is null or p.category_id in (select id from cat))
       and (not v_has_q
            or (coalesce(array_length(v_groups, 1), 0) > 0 and public.search_match(p.search_tsv, p.search_name, v_groups))
            or (v_code is not null and exists (
                  select 1 from public.product_variants v
                   where v.product_id = p.id and v.active and (v.ean = v_code or lower(v.sku) = v_code))))
  ),
  scored as (
    select base.*,
           array_remove(array[
             case when v_brands is not null and not coalesce(brand_slug = any(v_brands), false) then 'marka' end,
             case when (v_pmin is not null and price_min < v_pmin) or (v_pmax is not null and price_min > v_pmax) then 'cena' end,
             case when v_weights is not null and not (weights && v_weights) then 'waga' end,
             case when v_avail and stock <= 0 then 'dostepne' end,
             case when v_promo and not promo then 'promocje' end
           ], null)
           || coalesce((select array_agg('attr:' || f.key)
                          from jsonb_each(v_attr) f
                         where jsonb_typeof(f.value) = 'array' and jsonb_array_length(f.value) > 0
                           and not exists (select 1 from jsonb_array_elements_text(f.value) s
                                            where (f.key || ':' || s) = any(base.attrs))), '{}') as fails
      from base
  ),
  hits as (
    select * from scored where fails = '{}'
  ),
  sold as (
    select oi.product_id, sum(oi.quantity) as qty
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where v_sort = 'popularne'
       and o.status <> 'anulowane' and o.created_at > now() - interval '90 days'
       and oi.product_id in (select id from hits)
     group by oi.product_id
  ),
  ordered as (
    select h.*, row_number() over (
             order by (h.stock > 0) desc,
                      case when v_sort = 'trafnosc'      then h.rank end desc nulls last,
                      case when v_sort = 'popularne'     then coalesce(s.qty, 0) end desc nulls last,
                      case when v_sort = 'cena-rosnaco'  then h.price_min end asc nulls last,
                      case when v_sort = 'cena-malejaco' then h.price_min end desc nulls last,
                      case when v_sort = 'nazwa'         then public.search_norm(h.name) end asc nulls last,
                      h.created_at desc, h.id desc) as ord
      from hits h left join sold s on s.product_id = h.id
  ),
  page as (
    select * from ordered
     where ord > (v_page - 1) * v_per and ord <= v_page * v_per
  )
  select jsonb_build_object(
    'total', (select count(*) from hits),
    'page', v_page,
    'per_page', v_per,
    'sort', v_sort,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pg.id, 'slug', pg.slug, 'name', pg.name, 'image_url', pg.image_url,
               'emoji', pg.emoji, 'brand', pg.brand_name,
               'price', pg.price_min, 'stock', pg.stock, 'variants', pg.n_var, 'promo', pg.promo,
               'regular_price', cv.price, 'lowest_30d', cv.lowest_30d,
               'unit_price', cv.unit_price, 'unit', cv.unit, 'variant_name', cv.name
             ) order by pg.ord)
        from page pg
        cross join lateral (
          select v.price, v.name, vp.lowest_30d, vp.unit_price, vp.unit
            from public.product_variants v
            join public.variant_prices vp on vp.variant_id = v.id
           where v.product_id = pg.id and v.active
           order by public.effective_price(v), v.sort, v.id
           limit 1
        ) cv
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'brands', coalesce((
        select jsonb_agg(jsonb_build_object('slug', brand_slug, 'name', brand_name, 'count', n) order by n desc, brand_name)
          from (select brand_slug, brand_name, count(*) as n
                  from scored where brand_slug is not null and fails <@ array['marka']
                 group by brand_slug, brand_name) x), '[]'::jsonb),
      'attributes', coalesce((
        select jsonb_agg(jsonb_build_object('code', a.code, 'name', a.name, 'values', vals) order by a.sort, a.id)
          from public.attributes a
          cross join lateral (
            select jsonb_agg(jsonb_build_object('slug', av.slug, 'value', av.value, 'count', cnt.n) order by av.sort, av.id) as vals
              from public.attribute_values av
              join lateral (
                select count(*) as n from scored s
                 where (a.code || ':' || av.slug) = any(s.attrs) and s.fails <@ array['attr:' || a.code]
              ) cnt on cnt.n > 0
             where av.attribute_id = a.id
          ) v
         where a.filterable and vals is not null), '[]'::jsonb),
      'weights', coalesce((
        select jsonb_object_agg(w, n)
          from (select w, count(*) as n from scored, unnest(weights) w
                 where fails <@ array['waga'] group by w) x), '{}'::jsonb),
      'available', (select count(*) from scored where stock > 0 and fails <@ array['dostepne']),
      'promo', (select count(*) from scored where promo and fails <@ array['promocje']),
      'price_min', (select floor(min(price_min)) from scored where fails <@ array['cena']),
      'price_max', (select ceil(max(price_min)) from scored where fails <@ array['cena']),
      'categories', coalesce((
        select jsonb_object_agg(category_id, n)
          from (select category_id, count(*) as n from hits where category_id is not null group by category_id) x), '{}'::jsonb)
    ),
    'did_you_mean', null
  ) into v_result;

  if (v_result->>'total')::int = 0 and v_has_q then
    v_result := jsonb_set(v_result, '{did_you_mean}', coalesce(to_jsonb(public.search_did_you_mean(p_q)), 'null'::jsonb));
  end if;
  return v_result;
end;
$$;

-- ---------- PODPOWIEDZI PRZY WPISYWANIU --------------------------------
-- { products: [6 najlepszych], total, brands: [...], categories: [...] }

create or replace function public.search_suggest(p_q text)
returns jsonb
language plpgsql stable
security definer
set search_path = public, extensions
set jit = off
as $$
declare
  v_q   text := public.search_norm(p_q);
  v_res jsonb;
begin
  if length(v_q) < 2 then
    return jsonb_build_object('products', '[]'::jsonb, 'total', 0, 'brands', '[]'::jsonb, 'categories', '[]'::jsonb);
  end if;
  v_res := public.search_products(p_q, null, '{}'::jsonb, 'trafnosc', 1, 6);
  return jsonb_build_object(
    'products', v_res->'items',
    'total', v_res->'total',
    'did_you_mean', v_res->'did_you_mean',
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name) order by b.score desc, b.name)
        from (select b.slug, b.name,
                     case when public.search_norm(b.name) like v_q || '%' then 2
                          else word_similarity(v_q, public.search_norm(b.name)) end as score
                from public.brands b
               where b.active
                 and exists (select 1 from public.products p where p.brand_id = b.id and p.active)
                 and (public.search_norm(b.name) like v_q || '%'
                      or public.search_norm(b.name) like '% ' || v_q || '%'
                      or (length(v_q) >= 4 and word_similarity(v_q, public.search_norm(b.name)) >= 0.5))
               order by score desc limit 3) b), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name, 'emoji', c.emoji, 'parent', c.parent) order by c.score desc)
        from (select c.slug, c.name, coalesce(pc.emoji, c.emoji) as emoji, pc.name as parent,
                     case when public.search_norm(c.name) like v_q || '%' then 2
                          else word_similarity(v_q, public.search_norm(c.name)) end as score
                from public.categories c
                left join public.categories pc on pc.id = c.parent_id
               where c.active
                 and (public.search_norm(c.name) like v_q || '%'
                      or public.search_norm(c.name) like '% ' || v_q || '%'
                      or (length(v_q) >= 4 and word_similarity(v_q, public.search_norm(c.name)) >= 0.5))
               order by score desc, c.parent_id nulls first limit 4) c), '[]'::jsonb)
  );
end;
$$;

-- ---------- "NIE MAMY? NAPISZ, SPROWADZIMY" ----------------------------

create table if not exists public.product_requests (
  id         bigint generated always as identity primary key,
  query      text not null default '',       -- czego klient szukał
  message    text not null default '',       -- co chce (marka, rozmiar...)
  name       text not null default '',
  email      text not null,
  phone      text not null default '',
  status     text not null default 'nowa'
             check (status in ('nowa', 'w-toku', 'sprowadzone', 'odrzucone')),
  admin_note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists product_requests_created_idx on public.product_requests (created_at desc);

alter table public.product_requests enable row level security;
revoke all on public.product_requests from anon;
drop policy if exists "prosby - admin" on public.product_requests;
create policy "prosby - admin" on public.product_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Zapis zgłoszenia przez klienta (bez logowania). Zwraca numer zgłoszenia.
create or replace function public.request_product(
  p_query   text,
  p_message text,
  p_name    text,
  p_email   text,
  p_phone   text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
set jit = off
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id    bigint;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Podaj poprawny adres e-mail.' using errcode = 'P0001';
  end if;
  if trim(coalesce(p_query, '')) = '' and trim(coalesce(p_message, '')) = '' then
    raise exception 'Napisz, jakiego produktu szukasz.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.product_requests
       where email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Wysłano już kilka zgłoszeń z tego adresu. Odpowiemy na nie wkrótce.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.product_requests where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Za dużo zgłoszeń naraz. Spróbuj za chwilę.' using errcode = 'P0001';
  end if;

  insert into public.product_requests (query, message, name, email, phone)
  values (left(trim(coalesce(p_query, '')), 200), left(trim(coalesce(p_message, '')), 2000),
          left(trim(coalesce(p_name, '')), 100), v_email, left(trim(coalesce(p_phone, '')), 30))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- UPRAWNIENIA -----------------------------------------------

grant select on public.search_synonyms to anon, authenticated;
grant select, insert, update, delete on public.search_synonyms, public.product_requests to authenticated;
grant execute on function public.search_norm(text) to anon, authenticated;
grant execute on function public.search_products(text, text, jsonb, text, int, int) to anon, authenticated;
grant execute on function public.search_suggest(text) to anon, authenticated;
grant execute on function public.request_product(text, text, text, text, text) to anon, authenticated;
-- pomocnicze: tylko przez funkcje powyżej
revoke execute on function public.search_did_you_mean(text) from public, anon, authenticated;
