-- =====================================================================
--  ETAP 1, KROK 3: import z hurtowni
--  Uruchamiać PO schema.sql, 01_ustawienia.sql i 02_produkty.sql.
--  Można uruchamiać wielokrotnie, nie kasuje danych.
--  Wklej całość w Supabase: SQL Editor -> New query -> Run
--
--  Co dochodzi:
--  - funkcja import_batch: porównuje partię wierszy z pliku hurtowni z bazą
--    (po EAN, a bez EAN po kodzie hurtowni) i w trybie zapisu:
--      * istniejące: aktualizuje cenę, stan, cenę zakupu, stan i kod w hurtowni
--        (nie rusza nazwy, opisów, zdjęć, kategorii)
--      * nowe: dodaje jako ukryte szkice (wiersze z tym samym kodem grupy
--        stają się wariantami jednego produktu)
--  - funkcja import_zero_missing: zeruje stan pozycji tej hurtowni,
--    których nie było w pliku (opcja w imporcie)
--  Ustawienia importu (dopasowanie kolumn, kategorii, reguła ceny) są zapisywane
--  w istniejącej kolumnie suppliers.import_settings.
-- =====================================================================

-- Wiersz wejściowy (JSON), przygotowany przez panel:
--   i             numer wiersza w pliku (do komunikatów)
--   ean, sku      EAN i kod produktu u hurtowni (co najmniej jedno)
--   name, slug    nazwa produktu i adres (dla nowych)
--   brand, brand_slug, category_id, vat, description
--   price         cena sprzedaży brutto wyliczona z reguły ceny
--   purchase      cena zakupu netto
--   stock         stan w hurtowni
--   net_quantity, unit, variant_name
--   grp           kod grupy wariantów (opcjonalnie)
--   has_images    czy wiersz ma linki do zdjęć
-- Opcje: { "update_price": true, "update_stock": true }

create or replace function public.import_batch(
  p_supplier bigint,
  p_rows     jsonb,
  p_options  jsonb default '{}'::jsonb,
  p_apply    boolean default false
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_update_price boolean := coalesce((p_options->>'update_price')::boolean, true);
  v_update_stock boolean := coalesce((p_options->>'update_stock')::boolean, true);
  r            jsonb;
  v_ean        text;
  v_sku        text;
  v_grp        text;
  v_price      numeric(10,2);
  v_purchase   numeric(10,2);
  v_stock      int;
  v_variant    public.product_variants%rowtype;
  v_link       public.variant_suppliers%rowtype;
  v_other      bigint;
  v_changes    jsonb;
  v_status     text;
  v_result     jsonb := '[]'::jsonb;
  v_item       jsonb;
  v_groups     jsonb := '{}'::jsonb;  -- kod grupy -> id produktu (istniejącego albo nowego)
  v_pending    jsonb := '[]'::jsonb;  -- nowe wiersze do drugiego przejścia
  v_product_id bigint;
  v_brand_id   bigint;
  v_slug       text;
  v_new_count  int := 0;
  v_has_img    boolean;
  v_name       text;
begin
  if not public.is_admin() then
    raise exception 'Brak uprawnień administratora';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier) then
    raise exception 'Nie ma takiej hurtowni';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Brak wierszy do importu';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'Za duża partia (maksymalnie 1000 wierszy)';
  end if;

  -- ---------- 1. przejście: wiersze, które już są w sklepie ----------
  for r in select * from jsonb_array_elements(p_rows) loop
    v_ean := nullif(trim(coalesce(r->>'ean', '')), '');
    v_sku := trim(coalesce(r->>'sku', ''));
    v_grp := nullif(trim(coalesce(r->>'grp', '')), '');
    v_price    := nullif(r->>'price', '')::numeric;
    v_purchase := nullif(r->>'purchase', '')::numeric;
    v_stock    := nullif(r->>'stock', '')::int;
    v_variant  := null;
    v_link     := null;

    if v_ean is not null then
      select * into v_variant from public.product_variants where ean = v_ean;
    end if;
    if v_variant.id is null and v_sku <> '' then
      select v.* into v_variant
        from public.variant_suppliers vs
        join public.product_variants v on v.id = vs.variant_id
       where vs.supplier_id = p_supplier and vs.supplier_sku = v_sku;
    end if;

    if v_variant.id is null then
      v_pending := v_pending || jsonb_build_array(r);
      continue;
    end if;

    if v_grp is not null and not v_groups ? v_grp then
      v_groups := v_groups || jsonb_build_object(v_grp, v_variant.product_id);
    end if;

    select * into v_link from public.variant_suppliers
     where variant_id = v_variant.id and supplier_id = p_supplier;

    -- kod hurtowni zajęty przez inny wariant (np. hurtownia zmieniła EAN)
    if v_sku <> '' then
      select variant_id into v_other from public.variant_suppliers
       where supplier_id = p_supplier and supplier_sku = v_sku and variant_id <> v_variant.id;
      if v_other is not null then
        v_result := v_result || jsonb_build_array(jsonb_build_object(
          'i', r->'i', 'status', 'error', 'product_id', v_variant.product_id, 'variant_id', v_variant.id,
          'error', format('Kod hurtowni %s jest już przypisany do innego wariantu (id %s). Sprawdź EAN w pliku.', v_sku, v_other)));
        continue;
      end if;
    end if;

    v_changes := '{}'::jsonb;
    if v_update_price and v_price is not null and v_price > 0 and v_price <> v_variant.price then
      v_changes := v_changes || jsonb_build_object('price', jsonb_build_array(v_variant.price, v_price));
    end if;
    if v_update_stock and v_stock is not null and v_stock <> v_variant.stock then
      v_changes := v_changes || jsonb_build_object('stock', jsonb_build_array(v_variant.stock, v_stock));
    end if;
    if v_purchase is not null and v_purchase is distinct from v_link.purchase_price then
      v_changes := v_changes || jsonb_build_object('purchase', jsonb_build_array(v_link.purchase_price, v_purchase));
    end if;
    if v_stock is not null and v_stock is distinct from v_link.supplier_stock then
      v_changes := v_changes || jsonb_build_object('supplier_stock', jsonb_build_array(v_link.supplier_stock, v_stock));
    end if;
    if v_sku <> '' and v_sku is distinct from v_link.supplier_sku then
      v_changes := v_changes || jsonb_build_object('sku', jsonb_build_array(v_link.supplier_sku, v_sku));
    end if;
    v_status := case when v_changes = '{}'::jsonb then 'same' else 'update' end;

    select coalesce(p.image_url, '') = '', p.name || case when v_variant.name <> '' then ' - ' || v_variant.name else '' end
      into v_has_img, v_name
      from public.products p where p.id = v_variant.product_id;

    -- produkt dostaje kolejny wariant z grupy: jedyny wariant bez nazwy dostaje nazwę z pliku
    if p_apply and v_grp is not null and v_variant.name = '' and coalesce(r->>'variant_name', '') <> '' then
      update public.product_variants set name = left(r->>'variant_name', 60) where id = v_variant.id;
    end if;

    if p_apply and v_status = 'update' then
      begin
        if v_changes ? 'price' or v_changes ? 'stock' then
          update public.product_variants
             set price = case when v_changes ? 'price' then v_price else price end,
                 stock = case when v_changes ? 'stock' then greatest(v_stock, 0) else stock end
           where id = v_variant.id;
        end if;
        insert into public.variant_suppliers
          (variant_id, supplier_id, supplier_sku, purchase_price, supplier_stock, is_main, updated_at)
        values (
          v_variant.id, p_supplier, v_sku, v_purchase, v_stock,
          not exists (select 1 from public.variant_suppliers where variant_id = v_variant.id and is_main),
          now()
        )
        on conflict (variant_id, supplier_id) do update
          set supplier_sku   = case when excluded.supplier_sku <> '' then excluded.supplier_sku else variant_suppliers.supplier_sku end,
              purchase_price = coalesce(excluded.purchase_price, variant_suppliers.purchase_price),
              supplier_stock = coalesce(excluded.supplier_stock, variant_suppliers.supplier_stock),
              updated_at     = now();
      exception when others then
        v_result := v_result || jsonb_build_array(jsonb_build_object(
          'i', r->'i', 'status', 'error', 'product_id', v_variant.product_id, 'variant_id', v_variant.id,
          'error', sqlerrm));
        continue;
      end;
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'i', r->'i', 'status', v_status, 'product_id', v_variant.product_id, 'variant_id', v_variant.id,
      'changes', v_changes, 'no_image', v_has_img, 'name', v_name));
  end loop;

  -- ---------- 2. przejście: nowe produkty (szkice) ----------
  for r in select * from jsonb_array_elements(v_pending) loop
    v_ean := nullif(trim(coalesce(r->>'ean', '')), '');
    v_sku := trim(coalesce(r->>'sku', ''));
    v_grp := nullif(trim(coalesce(r->>'grp', '')), '');
    v_price    := nullif(r->>'price', '')::numeric;
    v_purchase := nullif(r->>'purchase', '')::numeric;
    v_stock    := greatest(coalesce(nullif(r->>'stock', '')::int, 0), 0);

    if coalesce(trim(r->>'name'), '') = '' then
      v_result := v_result || jsonb_build_array(jsonb_build_object('i', r->'i', 'status', 'error',
        'error', 'Nowy produkt bez nazwy'));
      continue;
    end if;
    if v_price is null or v_price <= 0 then
      v_result := v_result || jsonb_build_array(jsonb_build_object('i', r->'i', 'status', 'error',
        'error', 'Nowy produkt bez ceny (brak ceny zakupu i ceny sugerowanej)'));
      continue;
    end if;
    if coalesce((r->>'vat')::int, 23) not in (0, 5, 8, 23) then
      v_result := v_result || jsonb_build_array(jsonb_build_object('i', r->'i', 'status', 'error',
        'error', 'Nieprawidłowa stawka VAT'));
      continue;
    end if;

    v_product_id := case when v_grp is not null then (v_groups->>v_grp)::bigint end;

    if not p_apply then
      if v_grp is not null and v_product_id is null then
        v_new_count := v_new_count + 1;
        v_groups := v_groups || jsonb_build_object(v_grp, -v_new_count);  -- przyszły produkt
      end if;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'i', r->'i', 'status', 'new',
        'product_id', case when v_product_id > 0 then v_product_id end,
        'as_variant', v_product_id is not null));
      continue;
    end if;

    begin
      if v_product_id is null then
        -- marka: istniejąca (bez względu na wielkość liter) albo nowa
        v_brand_id := null;
        if coalesce(trim(r->>'brand'), '') <> '' then
          select id into v_brand_id from public.brands where lower(name) = lower(trim(r->>'brand')) limit 1;
          if v_brand_id is null then
            v_slug := coalesce(nullif(r->>'brand_slug', ''), 'marka');
            if exists (select 1 from public.brands where slug = v_slug) then
              v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
            end if;
            insert into public.brands (name, slug) values (left(trim(r->>'brand'), 100), v_slug)
            returning id into v_brand_id;
          end if;
        end if;

        v_slug := coalesce(nullif(r->>'slug', ''), 'produkt');
        if exists (select 1 from public.products where slug = v_slug) then
          v_slug := left(v_slug, 180) || '-' || substr(md5(random()::text), 1, 5);
        end if;

        insert into public.products
          (name, slug, category_id, brand_id, description, vat_rate, price, stock, active)
        values (
          left(trim(r->>'name'), 200), v_slug,
          nullif(r->>'category_id', '')::bigint, v_brand_id,
          left(coalesce(r->>'description', ''), 20000),
          coalesce((r->>'vat')::int, 23), v_price, v_stock, false
        )
        returning id into v_product_id;

        -- baza sama dodała pierwszy wariant: uzupełniamy go
        update public.product_variants
           set name = left(coalesce(case when v_grp is not null then r->>'variant_name' end, ''), 60),
               ean = v_ean,
               net_quantity = nullif(r->>'net_quantity', '')::numeric,
               unit = coalesce(nullif(r->>'unit', ''), 'szt'),
               price = v_price,
               stock = v_stock
         where id = (select id from public.product_variants where product_id = v_product_id order by id limit 1)
        returning * into v_variant;

        if v_grp is not null then
          v_groups := v_groups || jsonb_build_object(v_grp, v_product_id);
        end if;
      else
        -- kolejny wariant produktu z tej samej grupy
        insert into public.product_variants (product_id, name, ean, price, stock, net_quantity, unit, sort)
        values (
          v_product_id, left(coalesce(r->>'variant_name', ''), 60), v_ean, v_price, v_stock,
          nullif(r->>'net_quantity', '')::numeric, coalesce(nullif(r->>'unit', ''), 'szt'),
          (select coalesce(max(sort), -1) + 1 from public.product_variants where product_id = v_product_id)
        )
        returning * into v_variant;
      end if;

      insert into public.variant_suppliers
        (variant_id, supplier_id, supplier_sku, purchase_price, supplier_stock, is_main)
      values (v_variant.id, p_supplier, v_sku, v_purchase, nullif(r->>'stock', '')::int, true);

      select (coalesce(p.image_url, '') = '') into v_has_img from public.products p where p.id = v_product_id;

      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'i', r->'i', 'status', 'new', 'product_id', v_product_id, 'variant_id', v_variant.id,
        'no_image', v_has_img));
    exception when others then
      v_result := v_result || jsonb_build_array(jsonb_build_object('i', r->'i', 'status', 'error',
        'error', case when sqlstate = '23505' and sqlerrm ~* 'ean' then 'Ten EAN ma już inny produkt w sklepie'
                      when sqlstate = '23505' and sqlerrm ~* 'sku' then 'Ten kod hurtowni jest już przypisany do innego produktu'
                      else sqlerrm end));
    end;
  end loop;

  return v_result;
end;
$$;

-- Pozycje tej hurtowni, których nie było w pliku: stan w hurtowni = 0
-- (i stan w sklepie = 0, jeśli import aktualizuje stany). Liczy się tylko
-- hurtownia główna wariantu. p_apply = false tylko liczy.
create or replace function public.import_zero_missing(
  p_supplier     bigint,
  p_seen         bigint[],
  p_update_stock boolean default true,
  p_apply        boolean default false
)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_ids bigint[];
begin
  if not public.is_admin() then
    raise exception 'Brak uprawnień administratora';
  end if;
  select coalesce(array_agg(vs.variant_id), '{}') into v_ids
    from public.variant_suppliers vs
    join public.product_variants v on v.id = vs.variant_id
   where vs.supplier_id = p_supplier and vs.is_main
     and not (vs.variant_id = any (coalesce(p_seen, '{}')))
     and (coalesce(vs.supplier_stock, 1) <> 0 or (p_update_stock and v.stock <> 0));

  if p_apply and cardinality(v_ids) > 0 then
    update public.variant_suppliers set supplier_stock = 0, updated_at = now()
     where supplier_id = p_supplier and variant_id = any (v_ids);
    if p_update_stock then
      update public.product_variants set stock = 0 where id = any (v_ids) and stock <> 0;
    end if;
  end if;
  return cardinality(v_ids);
end;
$$;

revoke all on function public.import_batch(bigint, jsonb, jsonb, boolean) from public, anon;
revoke all on function public.import_zero_missing(bigint, bigint[], boolean, boolean) from public, anon;
grant execute on function public.import_batch(bigint, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.import_zero_missing(bigint, bigint[], boolean, boolean) to authenticated;
