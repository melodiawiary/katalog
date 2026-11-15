-- Etap 7: kategorie miejsc (groomer, weterynarz, hotel) w jednym systemie.
-- Weterynarze i hotele dla zwierząt używają tych samych tabel, opinii, rankingu i przejmowania profilu co groomerzy;
-- różni je kolumna places.category, własne słowniki usług i udogodnień oraz ranking liczony osobno w każdej kategorii.
-- Bezpieczne do ponownego uruchomienia (nie kasuje danych).

-- ---------- KATEGORIA I RODZAJ -------------------------------------------

alter table public.places add column if not exists category text not null default 'groomer';
alter table public.places drop constraint if exists places_category_ck;
alter table public.places add constraint places_category_ck check (category in ('groomer','weterynarz','hotel'));

alter table public.places drop constraint if exists places_kind_check;
alter table public.places drop constraint if exists places_kind_ck;
alter table public.places add constraint places_kind_ck check (kind in ('salon','mobilny','domowy','gabinet','hotel'));

alter table public.places drop constraint if exists places_category_kind_ck;
alter table public.places add constraint places_category_kind_ck check (
     (category = 'groomer'    and kind in ('salon','mobilny','domowy'))
  or (category = 'weterynarz' and kind in ('gabinet','mobilny'))
  or (category = 'hotel'      and kind in ('hotel','domowy')));

create index if not exists places_category_idx on public.places (category, status);

alter table public.place_requests add column if not exists category text not null default 'groomer';
alter table public.place_requests drop constraint if exists place_requests_category_ck;
alter table public.place_requests add constraint place_requests_category_ck check (category in ('groomer','weterynarz','hotel'));

-- ---------- SŁOWNIKI USŁUG I UDOGODNIEŃ PER KATEGORIA ---------------------

alter table public.service_defs add column if not exists categories text[] not null default array['groomer']::text[];
alter table public.feature_defs add column if not exists categories text[] not null default array['groomer']::text[];

update public.feature_defs set categories = array['groomer','weterynarz','hotel']::text[]
 where code in ('rezerwacja-online','karta','parking','klimatyzacja','dostep');
update public.feature_defs set categories = array['groomer','hotel']::text[]
 where code in ('szczeniaki','duze-rasy','trudne-zwierzeta','bez-klatek');

insert into public.service_defs (code, label, sort, categories) values
  ('wet-wizyta',       'Wizyta i konsultacja',                 100, array['weterynarz']),
  ('wet-szczepienie',  'Szczepienia',                          110, array['weterynarz']),
  ('wet-profilaktyka', 'Odrobaczanie i profilaktyka',          120, array['weterynarz']),
  ('wet-chip',         'Chipowanie i paszport',                130, array['weterynarz']),
  ('wet-badania',      'Badania krwi i laboratorium',          140, array['weterynarz']),
  ('wet-usg',          'USG',                                  150, array['weterynarz']),
  ('wet-rtg',          'RTG',                                  160, array['weterynarz']),
  ('wet-stomatologia', 'Stomatologia i skaling',               170, array['weterynarz']),
  ('wet-chirurgia',    'Zabiegi chirurgiczne',                 180, array['weterynarz']),
  ('wet-sterylizacja', 'Sterylizacja i kastracja',             190, array['weterynarz']),
  ('wet-dom',          'Wizyta domowa',                        200, array['weterynarz']),
  ('wet-nagle',        'Pomoc w nagłych przypadkach',          210, array['weterynarz']),
  ('hot-nocleg',       'Nocleg (doba)',                        300, array['hotel']),
  ('hot-dzien',        'Opieka dzienna',                       310, array['hotel']),
  ('hot-spacer',       'Dodatkowy spacer',                     320, array['hotel']),
  ('hot-leki',         'Podawanie leków',                      330, array['hotel']),
  ('hot-transport',    'Odbiór i dowóz zwierzęcia',            340, array['hotel']),
  ('hot-kapiel',       'Kąpiel w czasie pobytu',               350, array['hotel'])
on conflict (code) do update set categories = excluded.categories;

insert into public.feature_defs (code, label, sort, categories) values
  ('wet-24h',           'Czynne całą dobę',               100, array['weterynarz']),
  ('wet-nagle',         'Przyjmuje nagłe przypadki',      110, array['weterynarz']),
  ('wet-wizyty-domowe', 'Wizyty domowe',                  120, array['weterynarz']),
  ('wet-hospital',      'Hospitalizacja',                 130, array['weterynarz']),
  ('wet-lab',           'Własne laboratorium',            140, array['weterynarz']),
  ('wet-usg',           'USG na miejscu',                 150, array['weterynarz']),
  ('wet-rtg',           'RTG na miejscu',                 160, array['weterynarz']),
  ('wet-chirurgia',     'Chirurgia',                      170, array['weterynarz']),
  ('wet-stomatologia',  'Stomatologia',                   180, array['weterynarz']),
  ('wet-egzotyczne',    'Zwierzęta egzotyczne',           190, array['weterynarz']),
  ('hot-24h',           'Opieka całodobowa',              300, array['hotel']),
  ('hot-ogrod',         'Ogrodzony wybieg',               310, array['hotel']),
  ('hot-monitoring',    'Monitoring',                     320, array['hotel']),
  ('hot-lekarz',        'Współpraca z weterynarzem',      330, array['hotel']),
  ('hot-leki',          'Podaje leki',                    340, array['hotel']),
  ('hot-transport',     'Odbiór i dowóz',                 350, array['hotel']),
  ('hot-pokoje',        'Osobne pokoje',                  360, array['hotel']),
  ('hot-aktualizacje',  'Zdjęcia i wieści z pobytu',      370, array['hotel'])
on conflict (code) do update set categories = excluded.categories;

-- ---------- RANKING LICZONY OSOBNO W KATEGORII ----------------------------

create or replace function public._refresh_place_ranking(p_city text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with rv as (
    select r.place_id, r.rating::numeric as rating,
           greatest(0.25, power(0.5, extract(epoch from (now() - r.created_at)) / 86400.0 / 540.0)) as w
      from public.place_reviews r
     where r.status = 'opublikowana'
  ),
  per_place as (
    select place_id, count(*)::int as cnt, avg(rating) as avg_r, sum(w) as sw, sum(w * rating) as swr
      from rv group by place_id
  ),
  city_mean as (
    select lower(p.city) as c, p.category as cat, sum(pp.swr) / sum(pp.sw) as m
      from per_place pp join public.places p on p.id = pp.place_id
     where p.status = 'opublikowany'
     group by lower(p.city), p.category
  ),
  glob as (
    select coalesce(sum(swr) / nullif(sum(sw), 0), 4.0) as m from per_place
  ),
  calc as (
    select p.id, lower(p.city) as c, p.category as cat, p.status, p.verified,
           coalesce(pp.cnt, 0) as cnt, pp.avg_r,
           case when pp.cnt is null then null
                else (pp.swr + 3 * coalesce(cm.m, g.m)) / (pp.sw + 3)
                     + 0.025 * ((case when p.description <> '' then 1 else 0 end)
                              + (case when p.phone <> '' then 1 else 0 end)
                              + (case when exists (select 1 from public.place_hours h where h.place_id = p.id) then 1 else 0 end)
                              + (case when exists (select 1 from public.place_prices x where x.place_id = p.id) then 1 else 0 end))
                     + (case when p.verified then 0.05 else 0 end)
           end as score
      from public.places p
      left join per_place pp on pp.place_id = p.id
      left join city_mean cm on cm.c = lower(p.city) and cm.cat = p.category
      cross join glob g
     where p_city is null or lower(p.city) = lower(p_city)
  ),
  elig as (
    select id,
           row_number() over (partition by c, cat order by score desc, cnt desc, id) as rk,
           count(*) over (partition by c, cat) as nr
      from calc
     where status = 'opublikowany' and score is not null
  ),
  final as (
    select calc.id, calc.cnt, round(calc.avg_r, 2) as avg_r, round(calc.score, 4) as score, e.rk,
           array_remove(array[
             (case when calc.status = 'opublikowany' and calc.verified and calc.cnt >= 3 and calc.avg_r >= 4.3
                   then 'polecany' end)::text,
             (case when calc.status = 'opublikowany' and calc.verified and calc.cnt >= 3
                        and e.rk <= (case when e.nr <= 30 then 3 else greatest(3, ceil(e.nr * 0.1)::int) end)
                   then 'top_miasta' end)::text
           ], null) as badges
      from calc left join elig e on e.id = calc.id
  )
  update public.places p
     set rating_count = f.cnt,
         rating_avg   = f.avg_r,
         rank_score   = f.score,
         city_rank    = f.rk,
         badges       = f.badges
    from final f
   where p.id = f.id
     and (p.rating_count, p.rating_avg, p.rank_score, p.city_rank, p.badges)
         is distinct from (f.cnt, f.avg_r, f.score, f.rk, f.badges);
end;
$$;

drop trigger if exists places_rank_after on public.places;
create trigger places_rank_after
  after insert or delete or update of status, city, verified, description, phone, category on public.places
  for each row execute function public.places_rank_after();

-- ---------- SZUKANIE I STRONY Z KATEGORIĄ ---------------------------------

drop function if exists public.search_places(double precision, double precision, numeric, text, text, text, text, text[], text, text, numeric, boolean, text, int, int);

create or replace function public.search_places(
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_radius_km  numeric          default null,
  p_q          text             default '',
  p_city       text             default null,
  p_kind       text             default null,
  p_species    text             default null,
  p_features   text[]           default '{}',
  p_service    text             default null,
  p_size       text             default null,
  p_max_price  numeric          default null,
  p_open_now   boolean          default false,
  p_sort       text             default null,
  p_page       int              default 1,
  p_per_page   int              default 20,
  p_category   text             default null
)
returns jsonb
language plpgsql stable
set search_path = public, extensions
set jit = off
as $$
declare
  v_words    text[] := case when public.search_norm(p_q) = '' then '{}'::text[]
                            else string_to_array(public.search_norm(p_q), ' ') end;
  v_city     text := nullif(public.search_norm(p_city), '');
  v_here     extensions.geography :=
               case when p_lat is not null and p_lng is not null
                    then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end;
  v_now      timestamp := now() at time zone 'Europe/Warsaw';
  v_dow      int := extract(isodow from v_now)::int;
  v_time     time := v_now::time;
  v_features text[] := coalesce(p_features, '{}');
  v_sort     text := coalesce(nullif(p_sort, ''), case when p_lat is not null and p_lng is not null then 'odleglosc' else 'najlepsze' end);
  v_per      int := least(greatest(coalesce(p_per_page, 20), 1), 200);
  v_page     int := greatest(coalesce(p_page, 1), 1);
  v_total    int;
  v_items    jsonb;
begin
  if v_sort = 'odleglosc' and v_here is null then v_sort := 'najlepsze'; end if;

  with base as (
    select p.id, p.slug, p.name, p.kind, p.category, p.status, p.city, p.district, p.address, p.lat, p.lng,
           p.species, p.features, p.phone, p.website, p.service_radius_km, p.description,
           p.verified, p.rating_count, p.rating_avg, p.rank_score, p.city_rank, p.badges,
           case when v_here is not null then extensions.st_distance(p.geog, v_here) end as dist_m,
           (select min(pp.price_from) from public.place_prices pp
             where pp.place_id = p.id
               and (p_service is null or pp.service = p_service)
               and (p_size is null or pp.size_class is null or pp.size_class = p_size)) as price_min,
           exists (select 1 from public.place_hours h
                    where h.place_id = p.id and h.weekday = v_dow
                      and v_time >= h.opens and v_time < h.closes) as is_open
      from public.places p
     where (p_category is null or p.category = p_category)
       and (p_kind is null or p.kind = p_kind)
       and (p_species is null or p_species = any (p.species))
       and (cardinality(v_features) = 0 or p.features @> v_features)
       and (v_city is null or public.search_norm(p.city) = v_city)
       and not exists (select 1 from unnest(v_words) w where p.search_name not like '%' || w || '%')
  ),
  f as (
    select * from base
     where (p_radius_km is null or v_here is null
            or dist_m <= p_radius_km * 1000
            or (service_radius_km is not null and dist_m <= service_radius_km * 1000))
       and (p_max_price is null or (price_min is not null and price_min <= p_max_price))
       and (not coalesce(p_open_now, false) or is_open)
  ),
  ranked as (
    select f.*,
           count(*) over () as total,
           row_number() over (
             order by case when v_sort = 'odleglosc' then dist_m end nulls last,
                      case when v_sort = 'cena' then price_min end nulls last,
                      case when v_sort = 'najlepsze' then rank_score end desc nulls last,
                      case when v_sort = 'opinie' then rating_count end desc nulls last,
                      case when v_sort = 'opinie' then rank_score end desc nulls last,
                      lower(name), id) as rn
      from f
  )
  select coalesce(max(total), 0),
         coalesce(jsonb_agg(jsonb_build_object(
                    'id', id, 'slug', slug, 'name', name, 'kind', kind, 'category', category, 'status', status,
                    'city', city, 'district', district, 'address', address,
                    'lat', lat, 'lng', lng, 'species', species, 'features', features,
                    'phone', phone, 'website', website, 'service_radius_km', service_radius_km,
                    'short', left(description, 160),
                    'distance_km', round((dist_m / 1000)::numeric, 1),
                    'price_from', price_min, 'open_now', is_open,
                    'verified', verified, 'rating_avg', rating_avg, 'rating_count', rating_count,
                    'city_rank', city_rank, 'badges', badges)
                  order by rn) filter (where rn > (v_page - 1) * v_per and rn <= v_page * v_per),
                '[]'::jsonb)
    into v_total, v_items
    from ranked;

  return jsonb_build_object(
    'total', v_total, 'page', v_page, 'per_page', v_per,
    'pages', greatest(ceil(v_total::numeric / v_per)::int, 1),
    'items', v_items);
end;
$$;

create or replace function public.place_page(p_slug text)
returns jsonb
language plpgsql stable
set search_path = public, extensions
set jit = off
as $$
declare
  v_p   public.places;
  v_now timestamp := now() at time zone 'Europe/Warsaw';
begin
  select * into v_p from public.places where slug = lower(trim(coalesce(p_slug, '')));
  if not found then return null; end if;

  return jsonb_build_object(
    'place', to_jsonb(v_p) - 'geog' - 'search_name' - 'rank_score' - 'verified_by_owner',
    'owner_claimed', public.place_has_owner(v_p.id),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'caption', ph.caption) order by ph.sort, ph.id)
                          from public.place_photos ph where ph.place_id = v_p.id), '[]'::jsonb),
    'city_slug', public.place_city_slug(v_p.city),
    'city_ranked', (select count(*) from public.places o
                     where lower(o.city) = lower(v_p.city) and o.category = v_p.category
                       and o.status = 'opublikowany' and o.rank_score is not null),
    'reviews', public.place_reviews_json(v_p.id, 30),
    'breakdown', (select jsonb_build_object(
                     'quality', round(avg(r.r_quality)::numeric, 1), 'care', round(avg(r.r_care)::numeric, 1),
                     'clean', round(avg(r.r_clean)::numeric, 1), 'price', round(avg(r.r_price)::numeric, 1))
                    from public.place_reviews r where r.place_id = v_p.id and r.status = 'opublikowana'),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
                         'weekday', h.weekday, 'opens', to_char(h.opens, 'HH24:MI'), 'closes', to_char(h.closes, 'HH24:MI'))
                       order by h.weekday, h.opens)
                         from public.place_hours h where h.place_id = v_p.id), '[]'::jsonb),
    'open_now', exists (select 1 from public.place_hours h
                         where h.place_id = v_p.id and h.weekday = extract(isodow from v_now)::int
                           and v_now::time >= h.opens and v_now::time < h.closes),
    'prices', coalesce((select jsonb_agg(jsonb_build_object(
                          'service', pp.service, 'label', sd.label, 'size_class', pp.size_class, 'breed', pp.breed,
                          'price_from', pp.price_from, 'price_to', pp.price_to,
                          'duration_min', pp.duration_min, 'note', pp.note)
                        order by sd.sort, pp.sort,
                                 case pp.size_class when 'maly' then 1 when 'sredni' then 2 when 'duzy' then 3
                                                    when 'olbrzymi' then 4 when 'kot' then 5 else 0 end,
                                 pp.breed nulls first, pp.price_from)
                          from public.place_prices pp
                          join public.service_defs sd on sd.code = pp.service
                         where pp.place_id = v_p.id), '[]'::jsonb),
    'features', coalesce((select jsonb_agg(jsonb_build_object('code', fd.code, 'label', fd.label) order by fd.sort)
                            from public.feature_defs fd where fd.code = any (v_p.features)), '[]'::jsonb),
    'nearby', coalesce((select jsonb_agg(jsonb_build_object(
                          'slug', n.slug, 'name', n.name, 'kind', n.kind, 'city', n.city, 'district', n.district,
                          'rating_avg', n.rating_avg, 'rating_count', n.rating_count,
                          'distance_km', round((extensions.st_distance(n.geog, v_p.geog) / 1000)::numeric, 1))
                        order by extensions.st_distance(n.geog, v_p.geog))
                          from (select o.* from public.places o
                                 where o.id <> v_p.id and o.category = v_p.category
                                 order by o.geog operator(extensions.<->) v_p.geog
                                 limit 4) n), '[]'::jsonb));
end;
$$;

drop function if exists public.places_cities();
create or replace function public.places_cities(p_category text default null)
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('city', city, 'count', n, 'slug', public.place_city_slug(city))
                            order by n desc, city), '[]'::jsonb)
    from (select city, count(*) as n from public.places
           where city <> '' and (p_category is null or category = p_category) group by city) t;
$$;

drop function if exists public.city_page(text);

create or replace function public.city_page(p_slug text, p_category text default null)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_city text;
begin
  select city into v_city
    from public.places
   where status = 'opublikowany' and (p_category is null or category = p_category) and city <> '' and public.place_city_slug(city) = lower(trim(coalesce(p_slug, '')))
   group by city order by count(*) desc limit 1;
  if v_city is null then return null; end if;

  return jsonb_build_object(
    'city', v_city,
    'category', p_category,
    'slug', public.place_city_slug(v_city),
    'total', (select count(*) from public.places where status = 'opublikowany' and (p_category is null or category = p_category) and lower(city) = lower(v_city)),
    'reviews', (select coalesce(sum(rating_count), 0) from public.places where status = 'opublikowany' and (p_category is null or category = p_category) and lower(city) = lower(v_city)),
    'top', coalesce((select jsonb_agg(to_jsonb(t) order by t.city_rank)
                       from (select slug, name, kind, district, address, verified, rating_avg, rating_count, city_rank, badges,
                                    left(description, 140) as short
                               from public.places
                              where status = 'opublikowany' and (p_category is null or category = p_category) and lower(city) = lower(v_city) and city_rank is not null
                              order by city_rank limit 10) t), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(to_jsonb(t) order by lower(t.name))
                          from (select slug, name, kind, district, address, verified, rating_avg, rating_count, city_rank, badges,
                                       left(description, 140) as short
                                  from public.places
                                 where status = 'opublikowany' and (p_category is null or category = p_category) and lower(city) = lower(v_city)
                                   and (city_rank is null or city_rank > 10)
                                 order by lower(name) limit 60) t), '[]'::jsonb));
end;
$$;

-- ---------- ZGŁOSZENIA Z KATEGORIĄ ----------------------------------------

drop function if exists public.submit_place_request(text, bigint, text, text, text, text, text, text);

create or replace function public.submit_place_request(
  p_kind    text,
  p_place_id bigint,
  p_name    text,
  p_city    text,
  p_details text,
  p_email   text,
  p_contact_name  text default '',
  p_phone   text default '',
  p_category text default 'groomer'
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id    bigint;
begin
  if p_kind not in ('polecenie', 'korekta', 'usuniecie') then
    raise exception 'Nieznany rodzaj zgłoszenia.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Podaj poprawny adres e-mail.' using errcode = 'P0001';
  end if;
  if p_kind = 'polecenie' and (trim(coalesce(p_name, '')) = '' or trim(coalesce(p_city, '')) = '') then
    raise exception 'Podaj nazwę i miasto.' using errcode = 'P0001';
  end if;
  if p_kind in ('korekta', 'usuniecie') and not exists (select 1 from public.places where id = p_place_id) then
    raise exception 'Nie znaleziono tego miejsca.' using errcode = 'P0001';
  end if;
  if p_kind = 'korekta' and trim(coalesce(p_details, '')) = '' then
    raise exception 'Napisz, co trzeba poprawić.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_requests
       where contact_email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Wysłano już kilka zgłoszeń z tego adresu. Odpowiemy na nie wkrótce.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_requests where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Za dużo zgłoszeń naraz. Spróbuj za chwilę.' using errcode = 'P0001';
  end if;

  insert into public.place_requests (kind, place_id, place_name, city, details, contact_name, contact_email, contact_phone, category)
  values (p_kind, case when p_kind = 'polecenie' then null else p_place_id end,
          left(trim(coalesce(p_name, '')), 120), left(trim(coalesce(p_city, '')), 80),
          left(trim(coalesce(p_details, '')), 2000), left(trim(coalesce(p_contact_name, '')), 100),
          v_email, left(trim(coalesce(p_phone, '')), 30),
          case when p_category in ('groomer','weterynarz','hotel') then p_category else 'groomer' end)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- UPRAWNIENIA ---------------------------------------------------

revoke all on function public.search_places(double precision, double precision, numeric, text, text, text, text, text[], text, text, numeric, boolean, text, int, int, text) from public;
revoke all on function public.places_cities(text) from public;
revoke all on function public.city_page(text, text) from public;
revoke all on function public.submit_place_request(text, bigint, text, text, text, text, text, text, text) from public;

grant execute on function public.search_places(double precision, double precision, numeric, text, text, text, text, text[], text, text, numeric, boolean, text, int, int, text) to anon, authenticated;
grant execute on function public.places_cities(text) to anon, authenticated;
grant execute on function public.city_page(text, text) to anon, authenticated;
grant execute on function public.submit_place_request(text, bigint, text, text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
