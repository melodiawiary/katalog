-- =====================================================================
--  ETAP 3: katalog groomerów i mapa (baza)
--  Uruchamiać PO 08_konto.sql (korzysta z is_admin() i search_norm()).
--  Można uruchamiać wielokrotnie, nie kasuje danych.
--  (Numer 09, bo 03 jest zajęty przez import z hurtowni.)
--
--  - places: salony / groomerzy mobilni / groomerzy domowi, ze współrzędnymi (PostGIS)
--    status: szkic -> opublikowany -> ukryty; publicznie widać tylko opublikowane
--    i tylko gdy w places_config włączono "katalog publiczny"
--  - places_config: przełącznik "katalog publiczny" (baza nie pozwoli go włączyć,
--    dopóki nie ma min_published opublikowanych miejsc; domyślnie 20)
--  - place_hours: godziny otwarcia (brak wiersza = zamknięte), filtr "otwarte teraz"
--  - place_prices: cennik wg usługi, wielkości psa i (opcjonalnie) rasy
--  - service_defs, feature_defs: słowniki usług i udogodnień (etykiety do edycji w bazie)
--  - place_private: notatki i kontakt do właściciela, tylko admin (RLS nie ukrywa kolumn,
--    dlatego osobna tabela, tak jak ceny zakupu)
--  - place_requests: "Poleć salon", "Zgłoś błąd w danych", "Usuń mój salon"
--  - funkcje: search_places (w pobliżu, filtry, cena, otwarte teraz, sortowanie),
--    place_page (profil jednym zapytaniem), places_cities, dog_size_class,
--    submit_place_request (limit zgłoszeń z jednego e-maila)
--
--  Wielkość psa (size_class): maly < 10 kg, sredni 10-25 kg, duzy 25-40 kg, olbrzymi >= 40 kg,
--  kot = cennik dla kotów. Brak wartości w cenniku = cena dla każdej wielkości.
--  Dzień tygodnia w godzinach: 1 = poniedziałek ... 7 = niedziela (ISO).
-- =====================================================================

create extension if not exists postgis with schema extensions;

-- ---------- USTAWIENIA KATALOGU -----------------------------------------

create table if not exists public.places_config (
  id             boolean primary key default true check (id),   -- zawsze jeden wiersz
  public_enabled boolean not null default false,
  min_published  int not null default 20 check (min_published >= 0),
  updated_at     timestamptz not null default now()
);
insert into public.places_config (id) values (true) on conflict (id) do nothing;

-- ---------- SŁOWNIKI -----------------------------------------------------

create table if not exists public.service_defs (
  code  text primary key check (code ~ '^[a-z0-9_]+$'),
  label text not null check (char_length(label) between 1 and 80),
  sort  int  not null default 0
);

insert into public.service_defs (code, label, sort) values
  ('kapiel',            'Kąpiel',                          10),
  ('kapiel_strzyzenie', 'Kąpiel ze strzyżeniem',           20),
  ('strzyzenie',        'Strzyżenie',                      30),
  ('trymowanie',        'Trymowanie',                      40),
  ('podszerstek',       'Wyczesanie podszerstka',          50),
  ('pazury',            'Obcinanie pazurów',               60),
  ('uszy',              'Czyszczenie uszu',                70),
  ('spa',               'Zabiegi SPA',                     80),
  ('inne',              'Inna usługa',                     99)
on conflict (code) do nothing;

create table if not exists public.feature_defs (
  code  text primary key check (code ~ '^[a-z0-9-]+$'),
  label text not null check (char_length(label) between 1 and 80),
  sort  int  not null default 0
);

insert into public.feature_defs (code, label, sort) values
  ('szczeniaki',        'Przyjmuje szczeniaki',        10),
  ('duze-rasy',         'Duże rasy',                   20),
  ('trudne-zwierzeta',  'Trudne i lękliwe zwierzęta',  30),
  ('bez-klatek',        'Bez klatek',                  40),
  ('rezerwacja-online', 'Rezerwacja online',           50),
  ('karta',             'Płatność kartą',              60),
  ('parking',           'Parking',                     70),
  ('klimatyzacja',      'Klimatyzacja',                80),
  ('dostep',            'Dostępny dla wózków',         90)
on conflict (code) do nothing;

-- ---------- MIEJSCA ------------------------------------------------------

create table if not exists public.places (
  id                bigint generated always as identity primary key,
  slug              text not null unique default '',
  name              text not null check (char_length(trim(name)) between 2 and 120),
  kind              text not null default 'salon' check (kind in ('salon','mobilny','domowy')),
  status            text not null default 'szkic' check (status in ('szkic','opublikowany','ukryty')),
  description       text not null default '' check (char_length(description) <= 3000),
  species           text[] not null default array['pies']::text[]
                    check (cardinality(species) >= 1 and species <@ array['pies','kot']::text[]),
  features          text[] not null default '{}' check (cardinality(features) <= 20),
  address           text not null default '' check (char_length(address) <= 200),
  postal_code       text not null default '' check (char_length(postal_code) <= 10),
  city              text not null default '' check (char_length(city) <= 80),
  district          text not null default '' check (char_length(district) <= 80),
  lat               double precision not null check (lat between 48.5 and 55.5),
  lng               double precision not null check (lng between 13.5 and 24.5),
  geog              extensions.geography(Point, 4326) generated always as
                    (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  service_radius_km int check (service_radius_km is null or service_radius_km between 1 and 100), -- groomer mobilny: do kogo dojeżdża
  phone             text not null default '' check (char_length(phone) <= 30),
  email             text not null default '' check (email = '' or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  website           text not null default '' check (website = '' or (char_length(website) <= 300 and website ~* '^https?://[^\s]+$')),
  booking_url       text not null default '' check (booking_url = '' or (char_length(booking_url) <= 300 and booking_url ~* '^https?://[^\s]+$')),
  instagram         text not null default '' check (instagram = '' or (char_length(instagram) <= 300 and instagram ~* '^https?://[^\s]+$')),
  facebook          text not null default '' check (facebook = '' or (char_length(facebook) <= 300 and facebook ~* '^https?://[^\s]+$')),
  search_name       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint places_slug_format_ck check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint places_publish_ck check (status <> 'opublikowany' or (city <> '' and (kind = 'mobilny' or address <> '')))
);

-- Reguła publikacji (miasto; adres poza groomerem mobilnym) - podmiana także w już istniejącej tabeli
alter table public.places drop constraint if exists places_publish_ck;
alter table public.places add constraint places_publish_ck
  check (status <> 'opublikowany' or (city <> '' and (kind = 'mobilny' or address <> '')));

create index if not exists places_status_idx on public.places (status);
create index if not exists places_geog_idx   on public.places using gist (geog);
create index if not exists places_search_idx on public.places using gin (search_name extensions.gin_trgm_ops);

-- Slug (adres strony) z nazwy i miasta, gdy nie podano; tekst do szukania; data zmiany
create or replace function public.places_prepare()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  v_base text;
  v_slug text;
  n      int := 1;
begin
  new.name := trim(new.name);
  new.search_name := public.search_norm(
    new.name || ' ' || new.city || ' ' || new.district || ' ' || new.address || ' ' || new.postal_code);

  if coalesce(new.slug, '') = '' then
    v_base := left(regexp_replace(public.search_norm(new.name || ' ' || new.city), '\s+', '-', 'g'), 80);
    v_base := trim(both '-' from v_base);
    if v_base = '' then v_base := 'miejsce'; end if;
    v_slug := v_base;
    while exists (select 1 from public.places where slug = v_slug and id is distinct from new.id) loop
      n := n + 1;
      v_slug := v_base || '-' || n;
    end loop;
    new.slug := v_slug;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists places_prepare on public.places;
create trigger places_prepare
  before insert or update on public.places
  for each row execute function public.places_prepare();

-- Przełącznik "katalog publiczny": nie da się włączyć bez wymaganej liczby opublikowanych miejsc
create or replace function public.places_config_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_n int;
begin
  new.updated_at := now();
  if new.public_enabled and (tg_op = 'INSERT' or not old.public_enabled) then
    select count(*) into v_n from public.places where status = 'opublikowany';
    if v_n < new.min_published then
      raise exception 'Katalog można włączyć dopiero po opublikowaniu co najmniej % miejsc (jest: %).',
        new.min_published, v_n using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists places_config_guard on public.places_config;
create trigger places_config_guard
  before insert or update on public.places_config
  for each row execute function public.places_config_guard();

-- Czy katalog jest publiczny? (do reguł RLS)
create or replace function public.places_public()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select public_enabled from public.places_config where id), false);
$$;

-- Czy miejsce jest widoczne dla wszystkich? (do reguł RLS tabel podrzędnych)
create or replace function public.place_visible(p_id bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.places_public()
     and exists (select 1 from public.places where id = p_id and status = 'opublikowany');
$$;

-- ---------- GODZINY OTWARCIA ---------------------------------------------

create table if not exists public.place_hours (
  id        bigint generated always as identity primary key,
  place_id  bigint not null references public.places (id) on delete cascade,
  weekday   smallint not null check (weekday between 1 and 7),
  opens     time not null,
  closes    time not null,
  check (closes > opens)
);
create index if not exists place_hours_place_idx on public.place_hours (place_id, weekday);

-- ---------- CENNIK -------------------------------------------------------

create table if not exists public.place_prices (
  id           bigint generated always as identity primary key,
  place_id     bigint not null references public.places (id) on delete cascade,
  service      text not null references public.service_defs (code) on update cascade,
  size_class   text check (size_class is null or size_class in ('maly','sredni','duzy','olbrzymi','kot')),
  breed        text check (breed is null or char_length(breed) between 1 and 80),
  price_from   numeric(8,2) not null check (price_from >= 0),
  price_to     numeric(8,2) check (price_to is null or price_to >= price_from),
  duration_min int check (duration_min is null or duration_min between 5 and 600),
  note         text not null default '' check (char_length(note) <= 300),
  sort         int not null default 0
);
create index if not exists place_prices_place_idx on public.place_prices (place_id, service);

-- ---------- DANE TYLKO DLA ADMINA ----------------------------------------

create table if not exists public.place_private (
  place_id        bigint primary key references public.places (id) on delete cascade,
  notes           text not null default '' check (char_length(notes) <= 3000),
  contact_person  text not null default '' check (char_length(contact_person) <= 120),
  contact_phone   text not null default '' check (char_length(contact_phone) <= 30),
  contact_email   text not null default '' check (char_length(contact_email) <= 200),
  source_url      text not null default '' check (char_length(source_url) <= 500),
  last_checked_at date
);

-- ---------- ZGŁOSZENIA (poleć / popraw / usuń) ---------------------------

create table if not exists public.place_requests (
  id            bigint generated always as identity primary key,
  kind          text not null check (kind in ('polecenie','korekta','usuniecie')),
  place_id      bigint references public.places (id) on delete set null,
  place_name    text not null default '' check (char_length(place_name) <= 120),
  city          text not null default '' check (char_length(city) <= 80),
  details       text not null default '' check (char_length(details) <= 2000),
  contact_name  text not null default '' check (char_length(contact_name) <= 100),
  contact_email text not null check (char_length(contact_email) <= 200),
  contact_phone text not null default '' check (char_length(contact_phone) <= 30),
  status        text not null default 'nowe' check (status in ('nowe','w_toku','zalatwione','odrzucone')),
  admin_note    text not null default '' check (char_length(admin_note) <= 1000),
  created_at    timestamptz not null default now()
);
create index if not exists place_requests_status_idx on public.place_requests (status, created_at desc);
create index if not exists place_requests_email_idx  on public.place_requests (contact_email, created_at desc);

-- ---------- RLS ----------------------------------------------------------

alter table public.places_config  enable row level security;
alter table public.service_defs   enable row level security;
alter table public.feature_defs   enable row level security;
alter table public.places         enable row level security;
alter table public.place_hours    enable row level security;
alter table public.place_prices   enable row level security;
alter table public.place_private  enable row level security;
alter table public.place_requests enable row level security;

drop policy if exists "katalog - ustawienia widoczne" on public.places_config;
create policy "katalog - ustawienia widoczne" on public.places_config for select using (true);
drop policy if exists "katalog - ustawienia admin" on public.places_config;
create policy "katalog - ustawienia admin" on public.places_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "uslugi - widoczne" on public.service_defs;
create policy "uslugi - widoczne" on public.service_defs for select using (true);
drop policy if exists "uslugi - admin" on public.service_defs;
create policy "uslugi - admin" on public.service_defs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "udogodnienia - widoczne" on public.feature_defs;
create policy "udogodnienia - widoczne" on public.feature_defs for select using (true);
drop policy if exists "udogodnienia - admin" on public.feature_defs;
create policy "udogodnienia - admin" on public.feature_defs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "miejsca - widoczne" on public.places;
create policy "miejsca - widoczne" on public.places
  for select using (status = 'opublikowany' and public.places_public());
drop policy if exists "miejsca - admin" on public.places;
create policy "miejsca - admin" on public.places
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "godziny - widoczne" on public.place_hours;
create policy "godziny - widoczne" on public.place_hours
  for select using (public.place_visible(place_id));
drop policy if exists "godziny - admin" on public.place_hours;
create policy "godziny - admin" on public.place_hours
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cennik - widoczny" on public.place_prices;
create policy "cennik - widoczny" on public.place_prices
  for select using (public.place_visible(place_id));
drop policy if exists "cennik - admin" on public.place_prices;
create policy "cennik - admin" on public.place_prices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "miejsca prywatne - admin" on public.place_private;
create policy "miejsca prywatne - admin" on public.place_private
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "zgloszenia miejsc - admin" on public.place_requests;
create policy "zgloszenia miejsc - admin" on public.place_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- FUNKCJE ------------------------------------------------------

-- Klasa wielkości psa z wagi (do "Salony dla: Burek" z Moich zwierząt)
create or replace function public.dog_size_class(kg numeric)
returns text
language sql immutable parallel safe
set search_path = public
as $$
  select case
           when kg is null then null
           when kg < 10 then 'maly'
           when kg < 25 then 'sredni'
           when kg < 40 then 'duzy'
           else 'olbrzymi'
         end;
$$;

-- Szukanie miejsc. Wszystkie parametry są opcjonalne.
--   p_lat, p_lng       pozycja klienta (mapa, "blisko mnie", geokodowany adres)
--   p_radius_km        promień; groomer mobilny pasuje też, gdy klient jest w jego zasięgu dojazdu
--   p_q                nazwa, miasto, dzielnica, ulica, kod pocztowy (bez polskich znaków, po fragmencie)
--   p_service, p_size  cena "od" liczona dla usługi i wielkości psa (np. kapiel + sredni)
--   p_max_price        tylko miejsca z ceną "od" nie wyższą (dla wybranej usługi / wielkości)
--   p_open_now         otwarte teraz (czas polski)
--   p_sort             odleglosc (wymaga pozycji) | cena | nazwa
-- Zwraca {total, page, per_page, pages, items[]}. Widoczność załatwia RLS: klient widzi opublikowane
-- (gdy katalog jest publiczny), administrator także szkice (pole status).
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
  p_per_page   int              default 20
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
  v_sort     text := coalesce(nullif(p_sort, ''), case when p_lat is not null and p_lng is not null then 'odleglosc' else 'nazwa' end);
  v_per      int := least(greatest(coalesce(p_per_page, 20), 1), 200);
  v_page     int := greatest(coalesce(p_page, 1), 1);
  v_total    int;
  v_items    jsonb;
begin
  if v_sort = 'odleglosc' and v_here is null then v_sort := 'nazwa'; end if;

  with base as (
    select p.id, p.slug, p.name, p.kind, p.status, p.city, p.district, p.address, p.lat, p.lng,
           p.species, p.features, p.phone, p.website, p.service_radius_km, p.description,
           case when v_here is not null then extensions.st_distance(p.geog, v_here) end as dist_m,
           (select min(pp.price_from) from public.place_prices pp
             where pp.place_id = p.id
               and (p_service is null or pp.service = p_service)
               and (p_size is null or pp.size_class is null or pp.size_class = p_size)) as price_min,
           exists (select 1 from public.place_hours h
                    where h.place_id = p.id and h.weekday = v_dow
                      and v_time >= h.opens and v_time < h.closes) as is_open
      from public.places p
     where (p_kind is null or p.kind = p_kind)
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
                      lower(name), id) as rn
      from f
  )
  select coalesce(max(total), 0),
         coalesce(jsonb_agg(jsonb_build_object(
                    'id', id, 'slug', slug, 'name', name, 'kind', kind, 'status', status,
                    'city', city, 'district', district, 'address', address,
                    'lat', lat, 'lng', lng, 'species', species, 'features', features,
                    'phone', phone, 'website', website, 'service_radius_km', service_radius_km,
                    'short', left(description, 160),
                    'distance_km', round((dist_m / 1000)::numeric, 1),
                    'price_from', price_min, 'open_now', is_open)
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

-- Profil miejsca jednym zapytaniem (null, gdy nie istnieje albo nie jest widoczne)
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
    'place', to_jsonb(v_p) - 'geog' - 'search_name',
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
                          'distance_km', round((extensions.st_distance(n.geog, v_p.geog) / 1000)::numeric, 1))
                        order by extensions.st_distance(n.geog, v_p.geog))
                          from (select o.* from public.places o
                                 where o.id <> v_p.id
                                 order by o.geog operator(extensions.<->) v_p.geog
                                 limit 4) n), '[]'::jsonb));
end;
$$;

-- Miasta z liczbą widocznych miejsc (lista do filtra)
create or replace function public.places_cities()
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('city', city, 'count', n) order by n desc, city), '[]'::jsonb)
    from (select city, count(*) as n from public.places where city <> '' group by city) t;
$$;

-- Zgłoszenie: poleć salon / popraw dane / usuń mój salon (limit: 5 dziennie z jednego e-maila)
create or replace function public.submit_place_request(
  p_kind    text,
  p_place_id bigint,
  p_name    text,
  p_city    text,
  p_details text,
  p_email   text,
  p_contact_name  text default '',
  p_phone   text default ''
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
    raise exception 'Podaj nazwę salonu i miasto.' using errcode = 'P0001';
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

  insert into public.place_requests (kind, place_id, place_name, city, details, contact_name, contact_email, contact_phone)
  values (p_kind, case when p_kind = 'polecenie' then null else p_place_id end,
          left(trim(coalesce(p_name, '')), 120), left(trim(coalesce(p_city, '')), 80),
          left(trim(coalesce(p_details, '')), 2000), left(trim(coalesce(p_contact_name, '')), 100),
          v_email, left(trim(coalesce(p_phone, '')), 30))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- UPRAWNIENIA --------------------------------------------------

revoke all on public.places_config, public.service_defs, public.feature_defs, public.places,
              public.place_hours, public.place_prices, public.place_private, public.place_requests from anon;

grant select on public.places_config, public.service_defs, public.feature_defs, public.places,
                public.place_hours, public.place_prices to anon;

grant select, update on public.places_config to authenticated;
grant select, insert, update, delete on public.service_defs, public.feature_defs, public.places,
      public.place_hours, public.place_prices, public.place_private, public.place_requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant all on public.places_config, public.service_defs, public.feature_defs, public.places,
             public.place_hours, public.place_prices, public.place_private, public.place_requests to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.places_public() from public;
revoke all on function public.place_visible(bigint) from public;
revoke all on function public.dog_size_class(numeric) from public;
revoke all on function public.search_places(double precision, double precision, numeric, text, text, text, text, text[], text, text, numeric, boolean, text, int, int) from public;
revoke all on function public.place_page(text) from public;
revoke all on function public.places_cities() from public;
revoke all on function public.submit_place_request(text, bigint, text, text, text, text, text, text) from public;

grant execute on function public.places_public() to anon, authenticated;
grant execute on function public.place_visible(bigint) to anon, authenticated;
grant execute on function public.dog_size_class(numeric) to anon, authenticated;
grant execute on function public.search_places(double precision, double precision, numeric, text, text, text, text, text[], text, text, numeric, boolean, text, int, int) to anon, authenticated;
grant execute on function public.place_page(text) to anon, authenticated;
grant execute on function public.places_cities() to anon, authenticated;
grant execute on function public.submit_place_request(text, bigint, text, text, text, text, text, text) to anon, authenticated;
