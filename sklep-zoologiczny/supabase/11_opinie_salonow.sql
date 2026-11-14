-- =====================================================================
--  ETAP 4: opinie o salonach, ranking, odznaki, ulubione, lista Akademii
--  Uruchamiać PO 09_miejsca.sql i 10_prog_miasta.sql (korzysta z places, is_admin(), search_norm()).
--  Można uruchamiać wielokrotnie, nie kasuje danych.
--
--  - places: nowe kolumny verified (sprawdzony przez nas), rating_count, rating_avg, rank_score,
--    city_rank, badges (liczone przez bazę, nie edytować ręcznie)
--  - places_config.reviews_premoderation: true = nowa opinia czeka na zatwierdzenie (domyślnie),
--    false = publikuje się od razu, a administrator ukrywa tylko wpisy łamiące zasady
--  - place_reviews: opinie o salonach (zalogowani, 1 na salon, 4 oceny cząstkowe, tekst, opcjonalnie
--    usługa / wielkość psa / zapłacona kwota); place_review_reports: zgłoszenia nadużyć
--  - ranking: wynik = (suma wag x ocena + 3 x średnia miasta) / (suma wag + 3) + bonus;
--    waga opinii maleje o połowę co ok. 18 miesięcy (nie mniej niż 0,25); bonus do 0,10 za pełny profil
--    i 0,05 za "zweryfikowany" (tylko salon z opinią). Odznaki: polecany, top_miasta
--  - place_favorites: ulubione salony; academy_waitlist: zapis na listę chętnych na Akademię
--  - funkcje: submit_place_review, place_user_state, report_place_review, toggle_favorite_place,
--    place_reviews_json, refresh_place_ranking (codziennie z crona), city_page, place_city_slug,
--    join_academy; zmienione: search_places (sortowanie najlepsze / opinie, oceny w wyniku),
--    place_page (oceny, opinie, miejsce w mieście), places_cities (dodany slug)
-- =====================================================================

-- ---------- KOLUMNY W places ---------------------------------------------

alter table public.places add column if not exists verified     boolean not null default false;
alter table public.places add column if not exists rating_count int not null default 0;
alter table public.places add column if not exists rating_avg   numeric(3,2);
alter table public.places add column if not exists rank_score   numeric(6,4);
alter table public.places add column if not exists city_rank    int;
alter table public.places add column if not exists badges       text[] not null default '{}';

alter table public.places_config add column if not exists reviews_premoderation boolean not null default true;

-- ---------- OPINIE O SALONACH --------------------------------------------

create table if not exists public.place_reviews (
  id          bigint generated always as identity primary key,
  place_id    bigint not null references public.places (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author      text not null default 'Klient',
  rating      numeric(3,2) not null check (rating between 1 and 5),      -- ogólna = średnia z podanych ocen
  r_quality   smallint not null check (r_quality between 1 and 5),
  r_care      smallint check (r_care between 1 and 5),
  r_clean     smallint check (r_clean between 1 and 5),
  r_price     smallint check (r_price between 1 and 5),
  body        text not null default '' check (char_length(body) <= 2000),
  service     text references public.service_defs (code) on update cascade on delete set null,
  size_class  text check (size_class is null or size_class in ('maly','sredni','duzy','olbrzymi','kot')),
  paid_amount numeric(8,2) check (paid_amount is null or (paid_amount >= 1 and paid_amount <= 5000)),
  status      text not null default 'oczekuje' check (status in ('oczekuje','opublikowana','ukryta')),
  hidden_note text not null default '' check (char_length(hidden_note) <= 300),
  reports_count int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (place_id, user_id)
);
create index if not exists place_reviews_place_idx  on public.place_reviews (place_id, status, created_at desc);
create index if not exists place_reviews_status_idx on public.place_reviews (status, created_at);

create table if not exists public.place_review_reports (
  id            bigint generated always as identity primary key,
  review_id     bigint not null references public.place_reviews (id) on delete cascade,
  reason        text not null check (char_length(reason) between 3 and 500),
  contact_email text not null check (char_length(contact_email) <= 200),
  status        text not null default 'nowe' check (status in ('nowe','zalatwione')),
  created_at    timestamptz not null default now(),
  unique (review_id, contact_email)
);
create index if not exists place_review_reports_status_idx on public.place_review_reports (status, created_at desc);

create table if not exists public.place_favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  place_id   bigint not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table if not exists public.academy_waitlist (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  interest   text not null default 'inne' check (interest in ('pies','kot','zawodowo','inne')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists academy_waitlist_email_idx on public.academy_waitlist (lower(email));

-- ---------- RLS ----------------------------------------------------------

alter table public.place_reviews        enable row level security;
alter table public.place_review_reports enable row level security;
alter table public.place_favorites      enable row level security;
alter table public.academy_waitlist     enable row level security;

drop policy if exists "opinie salonow - wlasne" on public.place_reviews;
create policy "opinie salonow - wlasne" on public.place_reviews
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "opinie salonow - wlasne usuwanie" on public.place_reviews;
create policy "opinie salonow - wlasne usuwanie" on public.place_reviews
  for delete to authenticated using (user_id = auth.uid());
drop policy if exists "opinie salonow - admin" on public.place_reviews;
create policy "opinie salonow - admin" on public.place_reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "zgloszenia opinii - admin" on public.place_review_reports;
create policy "zgloszenia opinii - admin" on public.place_review_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ulubione salony - wlasne" on public.place_favorites;
create policy "ulubione salony - wlasne" on public.place_favorites
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "ulubione salony - wlasne usuwanie" on public.place_favorites;
create policy "ulubione salony - wlasne usuwanie" on public.place_favorites
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "akademia - admin" on public.academy_waitlist;
create policy "akademia - admin" on public.academy_waitlist
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- RANKING ------------------------------------------------------

-- Slug miasta do adresu strony: "Gdańsk" -> "gdansk", "Bielsko-Biała" -> "bielsko-biala"
create or replace function public.place_city_slug(p_city text)
returns text
language sql stable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(public.search_norm(coalesce(p_city, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Przeliczenie średnich, wyniku rankingu, miejsca w mieście i odznak (bez sprawdzania uprawnień:
-- wołają ją wyłącznie triggery i funkcja refresh_place_ranking)
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
    select lower(p.city) as c, sum(pp.swr) / sum(pp.sw) as m
      from per_place pp join public.places p on p.id = pp.place_id
     where p.status = 'opublikowany'
     group by lower(p.city)
  ),
  glob as (
    select coalesce(sum(swr) / nullif(sum(sw), 0), 4.0) as m from per_place
  ),
  calc as (
    select p.id, lower(p.city) as c, p.status, p.verified,
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
      left join city_mean cm on cm.c = lower(p.city)
      cross join glob g
     where p_city is null or lower(p.city) = lower(p_city)
  ),
  elig as (
    select id,
           row_number() over (partition by c order by score desc, cnt desc, id) as rk,
           count(*) over (partition by c) as nr
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

-- Publiczny wrapper: administrator (po zapisie salonu) albo cron (klucz serwisowy)
create or replace function public.refresh_place_ranking(p_city text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  perform public._refresh_place_ranking(nullif(trim(coalesce(p_city, '')), ''));
end;
$$;

-- Po zmianie opinii przeliczamy miasto salonu
create or replace function public.place_reviews_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place bigint := case when tg_op = 'DELETE' then old.place_id else new.place_id end;
  v_city  text;
begin
  select city into v_city from public.places where id = v_place;
  if found then perform public._refresh_place_ranking(v_city); end if;
  return null;
end;
$$;

drop trigger if exists place_reviews_after on public.place_reviews;
create trigger place_reviews_after
  after insert or update of status, rating or delete on public.place_reviews
  for each row execute function public.place_reviews_after();

-- Po zmianie miasta, statusu, "zweryfikowany", opisu lub telefonu salonu (stare i nowe miasto)
create or replace function public.places_rank_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and lower(old.city) is distinct from lower(new.city) then
    perform public._refresh_place_ranking(old.city);
  end if;
  if tg_op = 'DELETE' then
    perform public._refresh_place_ranking(old.city);
  else
    perform public._refresh_place_ranking(new.city);
  end if;
  return null;
end;
$$;

drop trigger if exists places_rank_after on public.places;
create trigger places_rank_after
  after insert or delete or update of status, city, verified, description, phone on public.places
  for each row execute function public.places_rank_after();

-- ---------- OPINIE: FUNKCJE ----------------------------------------------

-- Stan zalogowanego klienta względem salonu: { logged_in, favorite, mine, today }
create or replace function public.place_user_state(p_place bigint)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select case when auth.uid() is null then jsonb_build_object('logged_in', false)
  else jsonb_build_object(
    'logged_in', true,
    'favorite', exists (select 1 from public.place_favorites f where f.user_id = auth.uid() and f.place_id = p_place),
    'mine', (select jsonb_build_object('rating', r.rating, 'r_quality', r.r_quality, 'r_care', r.r_care,
                                       'r_clean', r.r_clean, 'r_price', r.r_price, 'body', r.body,
                                       'service', r.service, 'size_class', r.size_class,
                                       'paid_amount', r.paid_amount, 'status', r.status)
               from public.place_reviews r where r.place_id = p_place and r.user_id = auth.uid()),
    'today', (select count(*) from public.place_reviews r
               where r.user_id = auth.uid() and r.created_at > now() - interval '1 day')
  ) end;
$$;

-- Dodanie / poprawa opinii o salonie. Zwraca status opinii (oczekuje / opublikowana / ukryta).
create or replace function public.submit_place_review(
  p_place   bigint,
  p_quality int,
  p_care    int default null,
  p_clean   int default null,
  p_price   int default null,
  p_body    text default '',
  p_service text default null,
  p_size    text default null,
  p_paid    numeric default null
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_name    text;
  v_author  text;
  v_pre     boolean;
  v_status  text;
  v_old     text;
  v_overall numeric;
  v_service text := nullif(trim(coalesce(p_service, '')), '');
  v_size    text := nullif(trim(coalesce(p_size, '')), '');
begin
  if auth.uid() is null then raise exception 'Zaloguj się, żeby dodać opinię.' using errcode = 'P0001'; end if;
  if not (public.place_visible(p_place) or public.is_admin()) then
    raise exception 'Nie znaleziono tego salonu.' using errcode = 'P0001';
  end if;
  if p_quality is null or p_quality not between 1 and 5 then
    raise exception 'Oceń jakość usługi (1-5 gwiazdek).' using errcode = 'P0001';
  end if;
  if (p_care is not null and p_care not between 1 and 5) or (p_clean is not null and p_clean not between 1 and 5)
     or (p_price is not null and p_price not between 1 and 5) then
    raise exception 'Oceny muszą mieścić się w skali 1-5.' using errcode = 'P0001';
  end if;
  if v_service is not null and not exists (select 1 from public.service_defs where code = v_service) then v_service := null; end if;
  if v_size is not null and v_size not in ('maly','sredni','duzy','olbrzymi','kot') then v_size := null; end if;
  if p_paid is not null and (p_paid < 1 or p_paid > 5000) then
    raise exception 'Zapłacona kwota powinna mieścić się między 1 a 5000 zł (albo zostaw puste).' using errcode = 'P0001';
  end if;

  select avg(x) into v_overall from unnest(array[p_quality, p_care, p_clean, p_price]) x;

  select nullif(trim(full_name), '') into v_name from public.customer_profiles where user_id = auth.uid();
  v_author := case
    when v_name is null then 'Klient'
    when position(' ' in v_name) > 0
      then split_part(v_name, ' ', 1) || ' ' || upper(left(regexp_replace(v_name, '^.*\s', ''), 1)) || '.'
    else v_name end;

  select coalesce(reviews_premoderation, true) into v_pre from public.places_config where id;
  v_status := case when coalesce(v_pre, true) then 'oczekuje' else 'opublikowana' end;

  select status into v_old from public.place_reviews where place_id = p_place and user_id = auth.uid();
  if found then
    if v_old = 'ukryta' then v_status := 'ukryta'; end if;   -- ukrytej opinii nie da się "odkryć" edycją
    update public.place_reviews
       set rating = round(v_overall, 2), r_quality = p_quality, r_care = p_care, r_clean = p_clean, r_price = p_price,
           body = left(trim(coalesce(p_body, '')), 2000), service = v_service, size_class = v_size, paid_amount = p_paid,
           author = left(v_author, 80), status = v_status, updated_at = now()
     where place_id = p_place and user_id = auth.uid();
  else
    if (select count(*) from public.place_reviews where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
      raise exception 'Dziś dodałeś już kilka opinii. Wróć jutro.' using errcode = 'P0001';
    end if;
    insert into public.place_reviews (place_id, user_id, author, rating, r_quality, r_care, r_clean, r_price,
                                      body, service, size_class, paid_amount, status)
    values (p_place, auth.uid(), left(v_author, 80), round(v_overall, 2), p_quality, p_care, p_clean, p_price,
            left(trim(coalesce(p_body, '')), 2000), v_service, v_size, p_paid, v_status);
  end if;
  return v_status;
end;
$$;

-- Opublikowane opinie salonu (bez identyfikatora konta autora). Administrator widzi je także przy podglądzie.
create or replace function public.place_reviews_json(p_place bigint, p_limit int default 30)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'author', r.author, 'rating', r.rating,
           'r_quality', r.r_quality, 'r_care', r.r_care, 'r_clean', r.r_clean, 'r_price', r.r_price,
           'body', r.body, 'service', sd.label, 'size_class', r.size_class, 'paid_amount', r.paid_amount,
           'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
    from (select * from public.place_reviews
           where place_id = p_place and status = 'opublikowana'
             and (public.place_visible(p_place) or public.is_admin())
           order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)) r
    left join public.service_defs sd on sd.code = r.service;
$$;

-- Zgłoszenie nadużycia pod opinią (bez konta; limit 5 dziennie z jednego e-maila)
create or replace function public.report_place_review(p_review bigint, p_reason text, p_email text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Podaj poprawny adres e-mail.' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 then raise exception 'Napisz, co jest nie tak z tą opinią.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.place_reviews r where r.id = p_review and r.status = 'opublikowana'
                  and (public.place_visible(r.place_id) or public.is_admin())) then
    raise exception 'Nie znaleziono tej opinii.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_review_reports where contact_email = v_email and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Wysłano już kilka zgłoszeń z tego adresu. Rozpatrzymy je wkrótce.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_review_reports where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Za dużo zgłoszeń naraz. Spróbuj za chwilę.' using errcode = 'P0001';
  end if;
  insert into public.place_review_reports (review_id, reason, contact_email)
  values (p_review, left(v_reason, 500), v_email)
  on conflict (review_id, contact_email) do nothing;
  if found then
    update public.place_reviews set reports_count = reports_count + 1 where id = p_review;
  end if;
end;
$$;

-- Ulubione: true = dodany, false = usunięty (limit 100)
create or replace function public.toggle_favorite_place(p_place bigint)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Zaloguj się, żeby zapisać salon.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.place_favorites where user_id = auth.uid() and place_id = p_place) then
    delete from public.place_favorites where user_id = auth.uid() and place_id = p_place;
    return false;
  end if;
  if not public.place_visible(p_place) then raise exception 'Nie znaleziono tego salonu.' using errcode = 'P0001'; end if;
  if (select count(*) from public.place_favorites where user_id = auth.uid()) >= 100 then
    raise exception 'Masz już 100 ulubionych salonów.' using errcode = 'P0001';
  end if;
  insert into public.place_favorites (user_id, place_id) values (auth.uid(), p_place);
  return true;
end;
$$;

-- ---------- AKADEMIA: LISTA CHĘTNYCH -------------------------------------

create or replace function public.join_academy(p_email text, p_interest text, p_consent boolean)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_int   text := case when p_interest in ('pies','kot','zawodowo','inne') then p_interest else 'inne' end;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Podaj poprawny adres e-mail.' using errcode = 'P0001';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Zaznacz zgodę na kontakt w sprawie Akademii.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.academy_waitlist where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Za dużo zapisów naraz. Spróbuj za chwilę.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.academy_waitlist where lower(email) = v_email) then
    update public.academy_waitlist set interest = v_int where lower(email) = v_email;
    return 'juz';
  end if;
  insert into public.academy_waitlist (email, interest) values (v_email, v_int);
  return 'ok';
end;
$$;

-- ---------- SZUKANIE: sortowanie po ocenach ------------------------------

-- Ta sama sygnatura co w 09_miejsca.sql. Nowe: p_sort = najlepsze | opinie; w wyniku oceny, miejsce w mieście, odznaki.
-- Bez pozycji klienta domyślnie "najlepsze" (salony bez opinii na końcu, po nazwie).
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
  v_sort     text := coalesce(nullif(p_sort, ''), case when p_lat is not null and p_lng is not null then 'odleglosc' else 'najlepsze' end);
  v_per      int := least(greatest(coalesce(p_per_page, 20), 1), 200);
  v_page     int := greatest(coalesce(p_page, 1), 1);
  v_total    int;
  v_items    jsonb;
begin
  if v_sort = 'odleglosc' and v_here is null then v_sort := 'najlepsze'; end if;

  with base as (
    select p.id, p.slug, p.name, p.kind, p.status, p.city, p.district, p.address, p.lat, p.lng,
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
                      case when v_sort = 'najlepsze' then rank_score end desc nulls last,
                      case when v_sort = 'opinie' then rating_count end desc nulls last,
                      case when v_sort = 'opinie' then rank_score end desc nulls last,
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

-- ---------- PROFIL SALONU: oceny, opinie, miejsce w mieście --------------

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
    'place', to_jsonb(v_p) - 'geog' - 'search_name' - 'rank_score',
    'city_slug', public.place_city_slug(v_p.city),
    'city_ranked', (select count(*) from public.places o
                     where lower(o.city) = lower(v_p.city) and o.status = 'opublikowany' and o.rank_score is not null),
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
                                 where o.id <> v_p.id
                                 order by o.geog operator(extensions.<->) v_p.geog
                                 limit 4) n), '[]'::jsonb));
end;
$$;

-- Miasta z liczbą widocznych miejsc (do filtra i linków do stron miast)
create or replace function public.places_cities()
returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('city', city, 'count', n, 'slug', public.place_city_slug(city))
                            order by n desc, city), '[]'::jsonb)
    from (select city, count(*) as n from public.places where city <> '' group by city) t;
$$;

-- Strona miasta (np. "Groomer Gdańsk"): top 10 rankingu + pozostałe salony. null, gdy miasto nie ma widocznych salonów.
create or replace function public.city_page(p_slug text)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  v_city text;
begin
  select city into v_city
    from public.places
   where status = 'opublikowany' and city <> '' and public.place_city_slug(city) = lower(trim(coalesce(p_slug, '')))
   group by city order by count(*) desc limit 1;
  if v_city is null then return null; end if;

  return jsonb_build_object(
    'city', v_city,
    'slug', public.place_city_slug(v_city),
    'total', (select count(*) from public.places where status = 'opublikowany' and lower(city) = lower(v_city)),
    'reviews', (select coalesce(sum(rating_count), 0) from public.places where status = 'opublikowany' and lower(city) = lower(v_city)),
    'top', coalesce((select jsonb_agg(to_jsonb(t) order by t.city_rank)
                       from (select slug, name, kind, district, address, verified, rating_avg, rating_count, city_rank, badges,
                                    left(description, 140) as short
                               from public.places
                              where status = 'opublikowany' and lower(city) = lower(v_city) and city_rank is not null
                              order by city_rank limit 10) t), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(to_jsonb(t) order by lower(t.name))
                          from (select slug, name, kind, district, address, verified, rating_avg, rating_count, city_rank, badges,
                                       left(description, 140) as short
                                  from public.places
                                 where status = 'opublikowany' and lower(city) = lower(v_city)
                                   and (city_rank is null or city_rank > 10)
                                 order by lower(name) limit 60) t), '[]'::jsonb));
end;
$$;

-- ---------- UPRAWNIENIA --------------------------------------------------

revoke all on public.place_reviews, public.place_review_reports, public.place_favorites, public.academy_waitlist from anon;
grant select, insert, update, delete on public.place_reviews, public.place_review_reports, public.academy_waitlist to authenticated;
grant select, delete on public.place_favorites to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on public.place_reviews, public.place_review_reports, public.place_favorites, public.academy_waitlist to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.place_city_slug(text) from public;
revoke all on function public._refresh_place_ranking(text) from public, anon, authenticated;
revoke all on function public.refresh_place_ranking(text) from public, anon;
revoke all on function public.place_reviews_after() from public, anon, authenticated;
revoke all on function public.places_rank_after() from public, anon, authenticated;
revoke all on function public.place_user_state(bigint) from public;
revoke all on function public.submit_place_review(bigint, int, int, int, int, text, text, text, numeric) from public, anon;
revoke all on function public.place_reviews_json(bigint, int) from public;
revoke all on function public.report_place_review(bigint, text, text) from public;
revoke all on function public.toggle_favorite_place(bigint) from public, anon;
revoke all on function public.join_academy(text, text, boolean) from public;
revoke all on function public.city_page(text) from public;

grant execute on function public.place_city_slug(text) to anon, authenticated;
grant execute on function public.refresh_place_ranking(text) to authenticated, service_role;
grant execute on function public.place_user_state(bigint) to anon, authenticated;
grant execute on function public.submit_place_review(bigint, int, int, int, int, text, text, text, numeric) to authenticated;
grant execute on function public.place_reviews_json(bigint, int) to anon, authenticated;
grant execute on function public.report_place_review(bigint, text, text) to anon, authenticated;
grant execute on function public.toggle_favorite_place(bigint) to authenticated;
grant execute on function public.join_academy(text, text, boolean) to anon, authenticated;
grant execute on function public.city_page(text) to anon, authenticated;

grant execute on function public.search_places(double precision, double precision, numeric, text, text, text, text, text[], text, text, numeric, boolean, text, int, int) to anon, authenticated;
grant execute on function public.place_page(text) to anon, authenticated;
grant execute on function public.places_cities() to anon, authenticated;
