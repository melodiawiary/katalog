-- =====================================================================
--  ETAP 5: konta salonów (przejmowanie profilu), odpowiedzi na opinie, zdjęcia, Wizytówka Plus (furtka)
--  Uruchamiać PO 09_miejsca.sql, 10_prog_miasta.sql i 11_opinie_salonow.sql.
--  Można uruchamiać wielokrotnie, nie kasuje danych.
--
--  - place_claims: zgłoszenia "To mój salon" (droga e-mailem z kodem albo ręczna, z decyzją Mariusza)
--  - place_claim_codes: kody weryfikacyjne (tylko funkcje bazy, bez dostępu dla klientów i panelu)
--  - place_owners: właściciele salonów (do 3 osób na salon); place_owner_snapshots: stan profilu sprzed przejęcia
--  - place_review_replies: odpowiedź salonu pod opinią (jedna na opinię)
--  - place_photos: zdjęcia salonu (do 8, dodaje właściciel albo admin); place_review_photos: zdjęcia w opiniach
--    (każde czeka na zatwierdzenie)
--  - place_plus_interest: chętni na Wizytówkę Plus; places.plan / plan_until: furtka na przyszłość
--  - places.verified_by_owner: profil zweryfikowany przez przejęcie (po odejściu ostatniego właściciela wraca)
--  - zasobniki zdjęć: salony (publiczny), opinie-salonow (publiczny), przejecia (prywatny, dowody przejęcia)
--  - zmienione: place_reviews_json (odpowiedź i zdjęcia), place_user_state (id i zdjęcia własnej opinii),
--    place_page (zdjęcia salonu, "profil właściciela")
-- =====================================================================

-- ---------- KOLUMNY W places ---------------------------------------------

alter table public.places add column if not exists plan text not null default 'darmowy' check (plan in ('darmowy','plus'));
alter table public.places add column if not exists plan_until date;
alter table public.places add column if not exists verified_by_owner boolean not null default false;

-- ---------- TABELE -------------------------------------------------------

create table if not exists public.place_claims (
  id            bigint generated always as identity primary key,
  place_id      bigint not null references public.places (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  contact_name  text not null check (char_length(trim(contact_name)) between 2 and 100),
  role          text not null default 'wlasciciel' check (role in ('wlasciciel','zarzadzajacy')),
  contact_phone text not null default '' check (char_length(contact_phone) <= 30),
  method        text check (method in ('email','reczna')),
  verify_email  text not null default '' check (char_length(verify_email) <= 200),
  email_verified_at timestamptz,
  evidence_path text check (evidence_path is null or char_length(evidence_path) <= 300),
  evidence_note text not null default '' check (char_length(evidence_note) <= 1000),
  status        text not null default 'nowe' check (status in ('nowe','oczekuje_admina','zatwierdzone','odrzucone','wycofane')),
  conflict      boolean not null default false,
  conflict_since timestamptz,
  admin_note    text not null default '' check (char_length(admin_note) <= 1000),
  decided_at    timestamptz,
  decided_by    uuid,                       -- null = automat (poprawny kod e-mail)
  purge_at      date,                       -- po tej dacie kasujemy dowody i telefon
  purged_at     timestamptz,
  consent_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists place_claims_open_idx on public.place_claims (place_id, user_id) where status in ('nowe','oczekuje_admina');
create index if not exists place_claims_status_idx on public.place_claims (status, created_at desc);
create index if not exists place_claims_user_idx   on public.place_claims (user_id, created_at desc);

-- Kody weryfikacyjne: bez żadnych uprawnień dla klientów (czyta i zapisuje tylko funkcja bazy)
create table if not exists public.place_claim_codes (
  claim_id     bigint primary key references public.place_claims (id) on delete cascade,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  email        text not null,
  hour_start   timestamptz not null default now(),
  sent_in_hour int not null default 1
);

create table if not exists public.place_owners (
  place_id     bigint not null references public.places (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'wlasciciel' check (role in ('wlasciciel','zarzadzajacy')),
  contact_name text not null default '' check (char_length(contact_name) <= 100),
  method       text not null default 'email' check (method in ('email','reczna','admin')),
  claim_id     bigint references public.place_claims (id) on delete set null,
  notify_reviews boolean not null default true,
  created_at   timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index if not exists place_owners_user_idx on public.place_owners (user_id);

create table if not exists public.place_owner_snapshots (
  place_id bigint primary key references public.places (id) on delete cascade,
  taken_at timestamptz not null default now(),
  data     jsonb not null
);

create table if not exists public.place_review_replies (
  review_id   bigint primary key references public.place_reviews (id) on delete cascade,
  place_id    bigint not null references public.places (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(trim(body)) between 3 and 1000),
  status      text not null default 'opublikowana' check (status in ('opublikowana','ukryta')),
  hidden_note text not null default '' check (char_length(hidden_note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists place_review_replies_place_idx on public.place_review_replies (place_id);

create table if not exists public.place_photos (
  id         bigint generated always as identity primary key,
  place_id   bigint not null references public.places (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  by_owner   boolean not null default false,
  path       text not null unique check (char_length(path) <= 300),
  caption    text not null default '' check (char_length(caption) <= 120),
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists place_photos_place_idx on public.place_photos (place_id, sort, id);

create table if not exists public.place_review_photos (
  id         bigint generated always as identity primary key,
  review_id  bigint not null references public.place_reviews (id) on delete cascade,
  place_id   bigint not null references public.places (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  path       text not null unique check (char_length(path) <= 300),
  status     text not null default 'oczekuje' check (status in ('oczekuje','opublikowane')),
  created_at timestamptz not null default now()
);
create index if not exists place_review_photos_review_idx on public.place_review_photos (review_id);
create index if not exists place_review_photos_status_idx on public.place_review_photos (status, created_at);

create table if not exists public.place_plus_interest (
  place_id      bigint primary key references public.places (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  contact_email text not null default '' check (char_length(contact_email) <= 200),
  note          text not null default '' check (char_length(note) <= 500),
  created_at    timestamptz not null default now()
);

-- ---------- FUNKCJE POMOCNICZE -------------------------------------------

create or replace function public.is_place_owner(p_place bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.place_owners where place_id = p_place and user_id = auth.uid());
$$;

create or replace function public.can_edit_place(p_place bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_admin() or public.is_place_owner(p_place);
$$;

create or replace function public.place_has_owner(p_place bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.place_owners where place_id = p_place);
$$;

-- Domena ze strony www salonu ("https://www.salon.pl/cennik" -> "salon.pl")
create or replace function public.site_domain(p_url text)
returns text
language sql immutable
as $$
  select coalesce(nullif(regexp_replace(lower(trim(coalesce(p_url, ''))), '^https?://(www\.)?([^/:?#]+).*$', '\2'), lower(trim(coalesce(p_url, '')))), '');
$$;

-- Czy ten adres e-mail może potwierdzić przejęcie salonu? Tak, gdy to adres salonu z naszej bazy
-- (publiczny albo prywatny) albo adres w domenie strony www salonu (poza portalami i pocztą darmową).
create or replace function public.claim_email_allowed(p_place bigint, p_email text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_place public.places;
  v_priv  text;
  v_wd    text;
  v_md    text;
  v_host  text;
  v_bad   text[] := array['facebook.com','instagram.com','booksy.com','linktr.ee','wixsite.com','business.site','google.com',
                          'tiktok.com','youtube.com','olx.pl','allegro.pl','wordpress.com','blogspot.com','weebly.com',
                          'carrd.co','fresha.com','strikingly.com','squarespace.com','sites.google.com','gmail.com'];
  v_free  text[] := array['gmail.com','googlemail.com','wp.pl','o2.pl','onet.pl','onet.eu','interia.pl','interia.eu','op.pl',
                          'poczta.fm','yahoo.com','outlook.com','hotmail.com','live.com','icloud.com','proton.me','protonmail.com',
                          'tlen.pl','gazeta.pl','vp.pl','buziaczek.pl','wp.eu','onet.com.pl','email.com','mail.com'];
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then return false; end if;
  select * into v_place from public.places where id = p_place;
  if not found then return false; end if;
  select nullif(lower(trim(contact_email)), '') into v_priv from public.place_private where place_id = p_place;
  if v_email = nullif(lower(trim(v_place.email)), '') or v_email = v_priv then return true; end if;

  v_wd := public.site_domain(v_place.website);
  v_md := split_part(v_email, '@', 2);
  if v_wd = '' or v_md = any (v_free) then return false; end if;
  foreach v_host in array v_bad loop
    if v_wd = v_host or v_wd like '%.' || v_host then return false; end if;
  end loop;
  return v_md = v_wd or v_md like '%.' || v_wd;
end;
$$;

-- Adres z bazy do maskowania w podpowiedzi: "j***@salon.pl"
create or replace function public.mask_email(p_email text)
returns text
language sql immutable
as $$
  select case when position('@' in coalesce(p_email, '')) < 2 then ''
              else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2) end;
$$;

-- Zamiana godzin / cennika na dane z JSON (używają funkcje właściciela i przywracanie stanu sprzed przejęcia)
create or replace function public._replace_hours(p_place bigint, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(p_hours, '[]'::jsonb)) <> 'array' then raise exception 'Niepoprawne godziny.' using errcode = 'P0001'; end if;
  if jsonb_array_length(coalesce(p_hours, '[]'::jsonb)) > 40 then raise exception 'Za dużo przedziałów godzin.' using errcode = 'P0001'; end if;
  delete from public.place_hours where place_id = p_place;
  insert into public.place_hours (place_id, weekday, opens, closes)
  select p_place, x.weekday, x.opens, x.closes
    from jsonb_to_recordset(coalesce(p_hours, '[]'::jsonb)) as x(weekday smallint, opens time, closes time);
end;
$$;

create or replace function public._replace_prices(p_place bigint, p_prices jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(p_prices, '[]'::jsonb)) <> 'array' then raise exception 'Niepoprawny cennik.' using errcode = 'P0001'; end if;
  if jsonb_array_length(coalesce(p_prices, '[]'::jsonb)) > 60 then raise exception 'Za dużo pozycji cennika (maksymalnie 60).' using errcode = 'P0001'; end if;
  delete from public.place_prices where place_id = p_place;
  insert into public.place_prices (place_id, service, size_class, breed, price_from, price_to, duration_min, note, sort)
  select p_place, x.service, nullif(x.size_class, ''), nullif(x.breed, ''), x.price_from, x.price_to, x.duration_min,
         coalesce(x.note, ''), coalesce(x.sort, 0)
    from jsonb_to_recordset(coalesce(p_prices, '[]'::jsonb))
         as x(service text, size_class text, breed text, price_from numeric, price_to numeric, duration_min int, note text, sort int);
end;
$$;

-- ---------- PRZEJĘCIE PROFILU: nadanie roli właściciela -------------------

-- Wewnętrzna: zapisuje stan profilu sprzed przejęcia (przy pierwszym właścicielu), dodaje właściciela,
-- oznacza salon jako zweryfikowany (jeśli nie był) i ukrywa opinię właściciela o własnym salonie.
create or replace function public._grant_ownership(p_place bigint, p_user uuid, p_role text, p_name text, p_method text, p_claim bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.places;
begin
  select * into p from public.places where id = p_place for update;
  if not found then raise exception 'Nie znaleziono salonu.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.place_owners where place_id = p_place and user_id = p_user) then return; end if;
  if (select count(*) from public.place_owners where place_id = p_place) >= 3 then
    raise exception 'Ten salon ma już trzech właścicieli (limit).' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.place_owner_snapshots where place_id = p_place) then
    insert into public.place_owner_snapshots (place_id, data)
    values (p_place, jsonb_build_object(
      'description', p.description, 'phone', p.phone, 'email', p.email, 'website', p.website,
      'booking_url', p.booking_url, 'instagram', p.instagram, 'facebook', p.facebook,
      'features', to_jsonb(p.features), 'species', to_jsonb(p.species),
      'hours', coalesce((select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', h.opens, 'closes', h.closes)
                                         order by h.weekday, h.opens)
                           from public.place_hours h where h.place_id = p_place), '[]'::jsonb),
      'prices', coalesce((select jsonb_agg(jsonb_build_object('service', x.service, 'size_class', x.size_class, 'breed', x.breed,
                                                              'price_from', x.price_from, 'price_to', x.price_to,
                                                              'duration_min', x.duration_min, 'note', x.note, 'sort', x.sort)
                                         order by x.sort, x.id)
                           from public.place_prices x where x.place_id = p_place), '[]'::jsonb)));
  end if;

  insert into public.place_owners (place_id, user_id, role, contact_name, method, claim_id)
  values (p_place, p_user, p_role, left(coalesce(p_name, ''), 100), p_method, p_claim);

  if not p.verified then
    update public.places set verified = true, verified_by_owner = true where id = p_place;
  end if;

  -- właściciel nie ocenia własnego salonu
  update public.place_reviews
     set status = 'ukryta', hidden_note = 'Autor jest właścicielem salonu.'
   where place_id = p_place and user_id = p_user and status <> 'ukryta';
end;
$$;

-- Po odejściu ostatniego właściciela (zwolnienie, odłączenie przez admina, usunięcie konta):
-- jeśli salon był zweryfikowany tylko przez przejęcie, wraca do "niezweryfikowany"; kopia stanu jest kasowana
create or replace function public.place_owners_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.place_owners where place_id = old.place_id) then
    update public.places
       set verified = case when verified_by_owner then false else verified end,
           verified_by_owner = false
     where id = old.place_id;
    delete from public.place_owner_snapshots where place_id = old.place_id;
  end if;
  return null;
end;
$$;

drop trigger if exists place_owners_after_delete on public.place_owners;
create trigger place_owners_after_delete
  after delete on public.place_owners
  for each row execute function public.place_owners_after_delete();

-- Właściciel nie może oceniać własnego salonu (dotyczy też edycji istniejącej opinii)
create or replace function public.place_reviews_no_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.place_owners where place_id = new.place_id and user_id = new.user_id) then
    raise exception 'Właściciel salonu nie może oceniać własnego salonu.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists place_reviews_no_owner on public.place_reviews;
create trigger place_reviews_no_owner
  before insert or update of body, rating on public.place_reviews
  for each row execute function public.place_reviews_no_owner();

-- ---------- ZGŁOSZENIE "TO MÓJ SALON" ------------------------------------

-- Informacje do strony przejmowania: salon, czy zalogowany jest już właścicielem, jego zgłoszenie, podpowiedzi
create or replace function public.place_claim_info(p_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  p      public.places;
  c      public.place_claims;
  k      public.place_claim_codes;
  v_priv text;
  v_known text;
begin
  select * into p from public.places where slug = lower(trim(coalesce(p_slug, '')));
  if not found or not (public.place_visible(p.id) or public.is_admin()) then return null; end if;
  select nullif(lower(trim(contact_email)), '') into v_priv from public.place_private where place_id = p.id;
  v_known := coalesce(nullif(lower(trim(p.email)), ''), v_priv);

  if auth.uid() is not null then
    select * into c from public.place_claims
     where place_id = p.id and user_id = auth.uid() order by (status in ('nowe','oczekuje_admina')) desc, id desc limit 1;
    if found then select * into k from public.place_claim_codes where claim_id = c.id; end if;
  end if;

  return jsonb_build_object(
    'place', jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name, 'city', p.city, 'address', p.address, 'website', p.website),
    'logged_in', auth.uid() is not null,
    'is_owner', public.is_place_owner(p.id),
    'owners_count', (select count(*) from public.place_owners where place_id = p.id),
    'known_email_hint', case when v_known is null then null else public.mask_email(v_known) end,
    'website_domain', nullif(public.site_domain(p.website), ''),
    'claim', case when c.id is null then null else jsonb_build_object(
        'id', c.id, 'status', c.status, 'method', c.method, 'conflict', c.conflict, 'role', c.role,
        'contact_name', c.contact_name, 'contact_phone', c.contact_phone, 'created_at', c.created_at,
        'admin_note', c.admin_note,
        'code_active', k.claim_id is not null and k.expires_at > now(),
        'code_hint', case when k.claim_id is not null then public.mask_email(k.email) end) end);
end;
$$;

-- Krok 1: zgłoszenie (imię, rola, telefon, zgoda). Zwraca numer zgłoszenia.
create or replace function public.start_place_claim(p_place bigint, p_name text, p_role text, p_phone text, p_consent boolean)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_name  text := trim(coalesce(p_name, ''));
  v_role  text := case when p_role = 'zarzadzajacy' then 'zarzadzajacy' else 'wlasciciel' end;
  v_phone text := left(trim(coalesce(p_phone, '')), 30);
  v_id    bigint;
begin
  if auth.uid() is null then raise exception 'Zaloguj się, żeby zgłosić swój salon.' using errcode = 'P0001'; end if;
  if not (public.place_visible(p_place) or public.is_admin()) then
    raise exception 'Nie znaleziono tego salonu.' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 2 then raise exception 'Podaj imię i nazwisko.' using errcode = 'P0001'; end if;
  if not coalesce(p_consent, false) then
    raise exception 'Zaznacz zgodę na weryfikację, bez niej nie możemy przekazać profilu.' using errcode = 'P0001';
  end if;
  if public.is_place_owner(p_place) then raise exception 'Ten salon jest już na Twoim koncie.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.place_claims where place_id = p_place and user_id = auth.uid()
                and status = 'odrzucone' and decided_at > now() - interval '30 days') then
    raise exception 'Poprzednie zgłoszenie tego salonu zostało odrzucone. Napisz do nas przez „Zgłoś poprawkę”.' using errcode = 'P0001';
  end if;

  select id into v_id from public.place_claims
   where place_id = p_place and user_id = auth.uid() and status in ('nowe','oczekuje_admina');
  if found then
    update public.place_claims set contact_name = left(v_name, 100), role = v_role, contact_phone = v_phone, updated_at = now()
     where id = v_id;
    return v_id;
  end if;

  if (select count(*) from public.place_claims where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Dziś zgłosiłeś już kilka salonów. Wróć jutro.' using errcode = 'P0001';
  end if;
  insert into public.place_claims (place_id, user_id, contact_name, role, contact_phone)
  values (p_place, auth.uid(), left(v_name, 100), v_role, v_phone)
  returning id into v_id;
  return v_id;
end;
$$;

-- Krok 2 (tylko serwer, klucz serwisowy): zapisuje kod wygenerowany przez serwer i zwraca adres, na który go wysłać.
-- Kod trafia do bazy wyłącznie jako skrót; sprawdza go verify_place_claim.
create or replace function public.claim_issue_code(p_claim bigint, p_user uuid, p_mode text, p_email text, p_code text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c       public.place_claims;
  v_place public.places;
  v_priv  text;
  v_target text;
  v_row   public.place_claim_codes;
begin
  select * into c from public.place_claims where id = p_claim and user_id = p_user and status = 'nowe';
  if not found then raise exception 'Nie znaleziono zgłoszenia.' using errcode = 'P0001'; end if;
  select * into v_place from public.places where id = c.place_id;
  select nullif(lower(trim(contact_email)), '') into v_priv from public.place_private where place_id = c.place_id;

  if p_mode = 'known' then
    v_target := coalesce(nullif(lower(trim(v_place.email)), ''), v_priv);
    if v_target is null then
      raise exception 'Nie mamy adresu e-mail tego salonu. Wpisz adres w domenie strony salonu albo wybierz weryfikację ręczną.' using errcode = 'P0001';
    end if;
  else
    v_target := lower(trim(coalesce(p_email, '')));
    if not public.claim_email_allowed(c.place_id, v_target) then
      raise exception 'Ten adres nie pasuje do salonu. Użyj adresu w domenie strony salonu albo wybierz weryfikację ręczną.' using errcode = 'P0001';
    end if;
  end if;

  if p_code !~ '^[0-9]{6}$' then raise exception 'Błąd wewnętrzny kodu.' using errcode = 'P0001'; end if;

  select * into v_row from public.place_claim_codes where claim_id = p_claim;
  if found and v_row.hour_start > now() - interval '1 hour' and v_row.sent_in_hour >= 3 then
    raise exception 'Wysłano już 3 kody w ciągu godziny. Poczekaj chwilę albo użyj kodu z ostatniej wiadomości.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_claims
       where verify_email = v_target and id <> p_claim and updated_at > now() - interval '1 hour') >= 3 then
    raise exception 'Na ten adres wysłano już kilka kodów. Spróbuj później.' using errcode = 'P0001';
  end if;

  insert into public.place_claim_codes (claim_id, code_hash, expires_at, attempts, email, hour_start, sent_in_hour)
  values (p_claim, encode(extensions.digest(p_claim::text || ':' || p_code, 'sha256'), 'hex'),
          now() + interval '15 minutes', 0, v_target, now(), 1)
  on conflict (claim_id) do update
    set code_hash    = excluded.code_hash,
        expires_at   = excluded.expires_at,
        attempts     = 0,
        email        = excluded.email,
        hour_start   = case when place_claim_codes.hour_start > now() - interval '1 hour' then place_claim_codes.hour_start else now() end,
        sent_in_hour = case when place_claim_codes.hour_start > now() - interval '1 hour' then place_claim_codes.sent_in_hour + 1 else 1 end;

  update public.place_claims set verify_email = v_target, updated_at = now() where id = p_claim;
  return v_target;
end;
$$;

-- Krok 3: sprawdzenie kodu. Zwraca: zly_kod | wygasl | za_duzo | zatwierdzone | oczekuje_admina
-- (błędny kod nie rzuca wyjątku, żeby licznik prób się zapisał)
create or replace function public.verify_place_claim(p_claim bigint, p_code text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c public.place_claims;
  k public.place_claim_codes;
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
begin
  if auth.uid() is null then raise exception 'Zaloguj się.' using errcode = 'P0001'; end if;
  select * into c from public.place_claims where id = p_claim and user_id = auth.uid() and status = 'nowe' for update;
  if not found then raise exception 'Nie znaleziono zgłoszenia.' using errcode = 'P0001'; end if;
  select * into k from public.place_claim_codes where claim_id = p_claim for update;
  if not found or k.expires_at < now() then return 'wygasl'; end if;
  if k.attempts >= 5 then return 'za_duzo'; end if;
  if k.code_hash <> encode(extensions.digest(p_claim::text || ':' || v_code, 'sha256'), 'hex') then
    update public.place_claim_codes set attempts = attempts + 1 where claim_id = p_claim;
    return 'zly_kod';
  end if;

  delete from public.place_claim_codes where claim_id = p_claim;
  if exists (select 1 from public.place_owners where place_id = c.place_id) then
    update public.place_claims
       set method = 'email', email_verified_at = now(), status = 'oczekuje_admina',
           conflict = true, conflict_since = now(), updated_at = now()
     where id = p_claim;
    return 'oczekuje_admina';
  end if;
  perform public._grant_ownership(c.place_id, c.user_id, c.role, c.contact_name, 'email', c.id);
  update public.place_claims
     set method = 'email', email_verified_at = now(), status = 'zatwierdzone', decided_at = now(),
         decided_by = null, purge_at = current_date + 30, updated_at = now()
   where id = p_claim;
  return 'zatwierdzone';
end;
$$;

-- Droga ręczna: zdjęcie szyldu / drzwi (ścieżka w zasobniku "przejecia") i opis; decyduje Mariusz
create or replace function public.submit_manual_claim(p_claim bigint, p_evidence_path text, p_note text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  c public.place_claims;
  v_path text := nullif(trim(coalesce(p_evidence_path, '')), '');
  v_note text := left(trim(coalesce(p_note, '')), 1000);
  v_conflict boolean;
begin
  if auth.uid() is null then raise exception 'Zaloguj się.' using errcode = 'P0001'; end if;
  select * into c from public.place_claims where id = p_claim and user_id = auth.uid() and status = 'nowe' for update;
  if not found then raise exception 'Nie znaleziono zgłoszenia.' using errcode = 'P0001'; end if;
  if v_path is not null and v_path not like auth.uid()::text || '/%' then
    raise exception 'Niepoprawny plik.' using errcode = 'P0001';
  end if;
  if v_path is null and char_length(v_note) < 15 then
    raise exception 'Dodaj zdjęcie szyldu albo napisz kilka zdań, jak możemy potwierdzić, że salon jest Twój (np. dane z CEIDG: nazwa i adres).' using errcode = 'P0001';
  end if;
  v_conflict := exists (select 1 from public.place_owners where place_id = c.place_id);
  delete from public.place_claim_codes where claim_id = p_claim;
  update public.place_claims
     set method = 'reczna', evidence_path = v_path, evidence_note = v_note, status = 'oczekuje_admina',
         conflict = v_conflict, conflict_since = case when v_conflict then now() end, updated_at = now()
   where id = p_claim;
  return 'oczekuje_admina';
end;
$$;

create or replace function public.withdraw_place_claim(p_claim bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.place_claims
     set status = 'wycofane', decided_at = now(), purge_at = current_date, updated_at = now()
   where id = p_claim and user_id = auth.uid() and status in ('nowe','oczekuje_admina');
  delete from public.place_claim_codes where claim_id = p_claim;
end;
$$;

-- Decyzja Mariusza. p_replace = true: zatwierdzając, odłącza dotychczasowych właścicieli.
create or replace function public.decide_place_claim(p_claim bigint, p_approve boolean, p_note text default '', p_replace boolean default false)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  c public.place_claims;
begin
  if not public.is_admin() then raise exception 'Brak uprawnień.' using errcode = '42501'; end if;
  select * into c from public.place_claims where id = p_claim for update;
  if not found or c.status <> 'oczekuje_admina' then
    raise exception 'To zgłoszenie nie czeka już na decyzję.' using errcode = 'P0001';
  end if;
  if p_approve then
    if coalesce(p_replace, false) then
      delete from public.place_owners where place_id = c.place_id;
    end if;
    perform public._grant_ownership(c.place_id, c.user_id, c.role, c.contact_name, case when c.method = 'email' then 'email' else 'reczna' end, c.id);
  end if;
  update public.place_claims
     set status = case when p_approve then 'zatwierdzone' else 'odrzucone' end,
         admin_note = left(trim(coalesce(p_note, '')), 1000),
         decided_at = now(), decided_by = auth.uid(), purge_at = current_date + 30, updated_at = now()
   where id = p_claim;
  return case when p_approve then 'zatwierdzone' else 'odrzucone' end;
end;
$$;

-- Admin odłącza właściciela (dane profilu zostają)
create or replace function public.revoke_place_owner(p_place bigint, p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Brak uprawnień.' using errcode = '42501'; end if;
  delete from public.place_owners where place_id = p_place and user_id = p_user;
end;
$$;

-- Właściciel zwalnia salon. p_delete_data = true i to ostatni właściciel: profil wraca do stanu sprzed przejęcia,
-- zdjęcia dodane przez właścicieli są kasowane (zwraca ich ścieżki do usunięcia z zasobnika), a dane z weryfikacji czyszczone.
-- Wynik: { last: bool, photo_paths: [], evidence_paths: [] }
create or replace function public.release_place(p_place bigint, p_delete_data boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_last   boolean;
  v_snap   jsonb;
  v_photos jsonb := '[]'::jsonb;
  v_evid   jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_place_owner(p_place) then
    raise exception 'To nie jest Twój salon.' using errcode = 'P0001';
  end if;
  v_last := (select count(*) from public.place_owners where place_id = p_place) = 1;

  if coalesce(p_delete_data, false) then
    select coalesce(jsonb_agg(evidence_path), '[]'::jsonb) into v_evid
      from public.place_claims where place_id = p_place and user_id = auth.uid() and evidence_path is not null;
    update public.place_claims
       set evidence_path = null, evidence_note = '', contact_phone = '', purged_at = now()
     where place_id = p_place and user_id = auth.uid();
  end if;

  if v_last and coalesce(p_delete_data, false) then
    select data into v_snap from public.place_owner_snapshots where place_id = p_place;
    if v_snap is not null then
      update public.places set
        description = v_snap->>'description', phone = v_snap->>'phone', email = v_snap->>'email',
        website = v_snap->>'website', booking_url = v_snap->>'booking_url', instagram = v_snap->>'instagram',
        facebook = v_snap->>'facebook',
        features = coalesce(array(select jsonb_array_elements_text(v_snap->'features')), '{}'),
        species  = coalesce(nullif(array(select jsonb_array_elements_text(v_snap->'species')), '{}'), array['pies'])
       where id = p_place;
      perform public._replace_hours(p_place, v_snap->'hours');
      perform public._replace_prices(p_place, v_snap->'prices');
    end if;
    select coalesce(jsonb_agg(path), '[]'::jsonb) into v_photos
      from public.place_photos where place_id = p_place and by_owner;
    delete from public.place_photos where place_id = p_place and by_owner;
    delete from public.place_review_replies where place_id = p_place;
    delete from public.place_plus_interest where place_id = p_place;
  end if;

  delete from public.place_owners where place_id = p_place and user_id = auth.uid();   -- trigger sprząta resztę
  return jsonb_build_object('last', v_last, 'photo_paths', v_photos, 'evidence_paths', v_evid);
end;
$$;

-- ---------- PANEL WŁAŚCICIELA --------------------------------------------

create or replace function public.owner_my_places()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'slug', p.slug, 'name', p.name, 'city', p.city, 'status', p.status, 'role', o.role,
           'rating_avg', p.rating_avg, 'rating_count', p.rating_count, 'city_rank', p.city_rank) order by lower(p.name)), '[]'::jsonb)
    from public.place_owners o join public.places p on p.id = o.place_id
   where o.user_id = auth.uid();
$$;

-- Wszystko, co widzi właściciel (albo admin) na stronie salonu w koncie
create or replace function public.owner_dashboard(p_slug text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  p public.places;
begin
  select * into p from public.places where slug = lower(trim(coalesce(p_slug, '')));
  if not found or not public.can_edit_place(p.id) then return null; end if;

  return jsonb_build_object(
    'place', to_jsonb(p) - 'geog' - 'search_name' - 'rank_score' - 'verified_by_owner',
    'is_admin', public.is_admin(),
    'city_slug', public.place_city_slug(p.city),
    'city_ranked', (select count(*) from public.places o
                     where lower(o.city) = lower(p.city) and o.status = 'opublikowany' and o.rank_score is not null),
    'hours', coalesce((select jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', to_char(h.opens, 'HH24:MI'),
                                                           'closes', to_char(h.closes, 'HH24:MI')) order by h.weekday, h.opens)
                         from public.place_hours h where h.place_id = p.id), '[]'::jsonb),
    'prices', coalesce((select jsonb_agg(to_jsonb(x) - 'place_id' order by x.sort, x.id)
                          from public.place_prices x where x.place_id = p.id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'caption', ph.caption, 'by_owner', ph.by_owner)
                                         order by ph.sort, ph.id)
                          from public.place_photos ph where ph.place_id = p.id), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', r.id, 'author', r.author, 'rating', r.rating, 'body', r.body, 'created_at', r.created_at,
                           'service', sd.label, 'size_class', r.size_class,
                           'reply', (select jsonb_build_object('body', x.body, 'status', x.status, 'created_at', x.created_at)
                                       from public.place_review_replies x where x.review_id = r.id),
                           'photos', coalesce((select jsonb_agg(ph.path order by ph.id) from public.place_review_photos ph
                                                where ph.review_id = r.id and ph.status = 'opublikowane'), '[]'::jsonb))
                         order by r.created_at desc)
                          from (select * from public.place_reviews where place_id = p.id and status = 'opublikowana'
                                 order by created_at desc limit 50) r
                          left join public.service_defs sd on sd.code = r.service), '[]'::jsonb),
    'owners', coalesce((select jsonb_agg(jsonb_build_object('name', o.contact_name, 'role', o.role, 'me', o.user_id = auth.uid(),
                                                            'since', o.created_at) order by o.created_at)
                          from public.place_owners o where o.place_id = p.id), '[]'::jsonb),
    'my_notify', coalesce((select o.notify_reviews from public.place_owners o where o.place_id = p.id and o.user_id = auth.uid()), true),
    'plus_interest', exists (select 1 from public.place_plus_interest i where i.place_id = p.id),
    'plus_note', (select i.note from public.place_plus_interest i where i.place_id = p.id)
  );
end;
$$;

-- Dane salonu edytowane przez właściciela (nazwa, adres, pinezka, rodzaj i status zostają w gestii Mariusza)
create or replace function public.owner_update_place(
  p_place bigint, p_description text, p_phone text, p_email text, p_website text, p_booking_url text,
  p_instagram text, p_facebook text, p_features text[], p_species text[]
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_species  text[] := coalesce(p_species, '{}');
  v_features text[];
  v_city     text;
begin
  if not public.can_edit_place(p_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  if cardinality(v_species) < 1 or not (v_species <@ array['pies','kot']::text[]) then
    raise exception 'Zaznacz, jakie zwierzęta przyjmujesz (psy, koty).' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(code order by sort), '{}') into v_features
    from public.feature_defs where code = any (coalesce(p_features, '{}'));
  update public.places set
    description = left(trim(coalesce(p_description, '')), 3000),
    phone = left(trim(coalesce(p_phone, '')), 30),
    email = left(trim(coalesce(p_email, '')), 200),
    website = left(trim(coalesce(p_website, '')), 300),
    booking_url = left(trim(coalesce(p_booking_url, '')), 300),
    instagram = left(trim(coalesce(p_instagram, '')), 300),
    facebook = left(trim(coalesce(p_facebook, '')), 300),
    features = v_features,
    species = v_species
   where id = p_place
   returning city into v_city;
  perform public._refresh_place_ranking(v_city);
end;
$$;

create or replace function public.owner_save_hours(p_place bigint, p_hours jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_city text;
begin
  if not public.can_edit_place(p_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  perform public._replace_hours(p_place, p_hours);
  select city into v_city from public.places where id = p_place;
  perform public._refresh_place_ranking(v_city);
end;
$$;

create or replace function public.owner_save_prices(p_place bigint, p_prices jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_city text;
begin
  if not public.can_edit_place(p_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  perform public._replace_prices(p_place, p_prices);
  select city into v_city from public.places where id = p_place;
  perform public._refresh_place_ranking(v_city);
end;
$$;

create or replace function public.set_owner_notify(p_place bigint, p_on boolean)
returns void
language sql security definer
set search_path = public
as $$
  update public.place_owners set notify_reviews = coalesce(p_on, true) where place_id = p_place and user_id = auth.uid();
$$;

-- ---------- ZDJĘCIA SALONU -----------------------------------------------

create or replace function public.owner_add_photo(p_place bigint, p_path text, p_caption text default '')
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not public.can_edit_place(p_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  if p_path is null or p_path not like p_place::text || '/%' then raise exception 'Niepoprawny plik.' using errcode = 'P0001'; end if;
  if (select count(*) from public.place_photos where place_id = p_place) >= 8 then
    raise exception 'Salon może mieć najwyżej 8 zdjęć. Usuń któreś, żeby dodać nowe.' using errcode = 'P0001';
  end if;
  insert into public.place_photos (place_id, user_id, by_owner, path, caption, sort)
  values (p_place, auth.uid(), not public.is_admin(), p_path, left(trim(coalesce(p_caption, '')), 120),
          coalesce((select max(sort) + 1 from public.place_photos where place_id = p_place), 0))
  returning id into v_id;
  return v_id;
end;
$$;

-- Zwraca ścieżkę pliku do usunięcia z zasobnika
create or replace function public.owner_delete_photo(p_photo bigint)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v public.place_photos;
begin
  select * into v from public.place_photos where id = p_photo;
  if not found or not public.can_edit_place(v.place_id) then raise exception 'Nie znaleziono zdjęcia.' using errcode = 'P0001'; end if;
  delete from public.place_photos where id = p_photo;
  return v.path;
end;
$$;

create or replace function public.owner_set_main_photo(p_photo bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v public.place_photos;
begin
  select * into v from public.place_photos where id = p_photo;
  if not found or not public.can_edit_place(v.place_id) then raise exception 'Nie znaleziono zdjęcia.' using errcode = 'P0001'; end if;
  update public.place_photos set sort = (select coalesce(min(sort), 0) - 1 from public.place_photos where place_id = v.place_id)
   where id = p_photo;
end;
$$;

-- ---------- ODPOWIEDZI WŁAŚCICIELA ---------------------------------------

-- Dodanie / poprawa odpowiedzi. Odpowiedź ukryta przez Mariusza nie wraca do widoku po edycji. Zwraca status.
create or replace function public.reply_to_review(p_review bigint, p_body text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  r public.place_reviews;
  v_body text := trim(coalesce(p_body, ''));
  v_old  text;
begin
  select * into r from public.place_reviews where id = p_review;
  if not found or r.status <> 'opublikowana' then raise exception 'Odpowiadać można tylko na opublikowane opinie.' using errcode = 'P0001'; end if;
  if not public.is_place_owner(r.place_id) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  if char_length(v_body) < 3 then raise exception 'Napisz odpowiedź (min. 3 znaki).' using errcode = 'P0001'; end if;
  if char_length(v_body) > 1000 then raise exception 'Odpowiedź może mieć do 1000 znaków.' using errcode = 'P0001'; end if;
  select status into v_old from public.place_review_replies where review_id = p_review;
  if found then
    update public.place_review_replies set body = v_body, user_id = auth.uid(), updated_at = now() where review_id = p_review;
    return v_old;
  end if;
  insert into public.place_review_replies (review_id, place_id, user_id, body) values (p_review, r.place_id, auth.uid(), v_body);
  return 'opublikowana';
end;
$$;

create or replace function public.delete_review_reply(p_review bigint)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_place bigint;
begin
  select place_id into v_place from public.place_review_replies where review_id = p_review;
  if not found then return; end if;
  if not public.can_edit_place(v_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  delete from public.place_review_replies where review_id = p_review;
end;
$$;

-- Adresy właścicieli do powiadomienia o nowej opinii (tylko serwer)
create or replace function public.place_owner_emails(p_place bigint)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'name', o.contact_name)), '[]'::jsonb)
    from public.place_owners o join auth.users u on u.id = o.user_id
   where o.place_id = p_place and o.notify_reviews and u.email is not null;
$$;

-- Adresy wszystkich właścicieli (np. zawiadomienie o spornym zgłoszeniu; tylko serwer)
create or replace function public.place_owner_emails_all(p_place bigint)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'name', o.contact_name)), '[]'::jsonb)
    from public.place_owners o join auth.users u on u.id = o.user_id
   where o.place_id = p_place and u.email is not null;
$$;

-- ---------- ZDJĘCIA W OPINIACH -------------------------------------------

create or replace function public.add_review_photo(p_review bigint, p_path text)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  r public.place_reviews;
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Zaloguj się.' using errcode = 'P0001'; end if;
  select * into r from public.place_reviews where id = p_review and user_id = auth.uid();
  if not found then raise exception 'Nie znaleziono Twojej opinii.' using errcode = 'P0001'; end if;
  if r.status = 'ukryta' then raise exception 'Ta opinia jest ukryta.' using errcode = 'P0001'; end if;
  if p_path is null or p_path not like auth.uid()::text || '/%' then raise exception 'Niepoprawny plik.' using errcode = 'P0001'; end if;
  if (select count(*) from public.place_review_photos where review_id = p_review) >= 3 then
    raise exception 'Do opinii można dodać najwyżej 3 zdjęcia.' using errcode = 'P0001';
  end if;
  insert into public.place_review_photos (review_id, place_id, user_id, path)
  values (p_review, r.place_id, auth.uid(), p_path)
  returning id into v_id;
  return v_id;
end;
$$;

-- Autor lub admin usuwa zdjęcie; zwraca ścieżkę pliku do usunięcia z zasobnika
create or replace function public.delete_review_photo(p_photo bigint)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v public.place_review_photos;
begin
  select * into v from public.place_review_photos where id = p_photo;
  if not found or not (v.user_id = auth.uid() or public.is_admin()) then raise exception 'Nie znaleziono zdjęcia.' using errcode = 'P0001'; end if;
  delete from public.place_review_photos where id = p_photo;
  return v.path;
end;
$$;

-- Moderacja: zatwierdzenie albo odrzucenie (odrzucone jest usuwane; zwraca ścieżkę pliku albo null)
create or replace function public.moderate_review_photo(p_photo bigint, p_approve boolean)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v public.place_review_photos;
begin
  if not public.is_admin() then raise exception 'Brak uprawnień.' using errcode = '42501'; end if;
  select * into v from public.place_review_photos where id = p_photo;
  if not found then return null; end if;
  if p_approve then
    update public.place_review_photos set status = 'opublikowane' where id = p_photo;
    return null;
  end if;
  delete from public.place_review_photos where id = p_photo;
  return v.path;
end;
$$;

-- ---------- WIZYTÓWKA PLUS (furtka) --------------------------------------

create or replace function public.set_plus_interest(p_place bigint, p_on boolean, p_note text default '')
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_place_owner(p_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  if coalesce(p_on, true) then
    insert into public.place_plus_interest (place_id, user_id, contact_email, note)
    values (p_place, auth.uid(), coalesce((select email from auth.users where id = auth.uid()), ''), left(trim(coalesce(p_note, '')), 500))
    on conflict (place_id) do update set user_id = excluded.user_id, contact_email = excluded.contact_email, note = excluded.note;
  else
    delete from public.place_plus_interest where place_id = p_place;
  end if;
end;
$$;

-- ---------- PANEL ADMINA -------------------------------------------------

-- Zgłoszenia do decyzji, ostatnie decyzje, właściciele, chętni na Plus (z adresami e-mail kont)
create or replace function public.admin_claims_overview()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Brak uprawnień.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'place_id', c.place_id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city,
        'email', u.email, 'contact_name', c.contact_name, 'role', c.role, 'contact_phone', c.contact_phone,
        'method', c.method, 'verify_email', c.verify_email, 'email_verified', c.email_verified_at is not null,
        'evidence_path', c.evidence_path, 'evidence_note', c.evidence_note,
        'conflict', c.conflict, 'conflict_since', c.conflict_since, 'created_at', c.created_at,
        'owners', coalesce((select jsonb_agg(jsonb_build_object('name', o.contact_name, 'email', ou.email))
                              from public.place_owners o join auth.users ou on ou.id = o.user_id
                             where o.place_id = c.place_id), '[]'::jsonb)) order by c.created_at)
        from public.place_claims c join public.places p on p.id = c.place_id join auth.users u on u.id = c.user_id
       where c.status = 'oczekuje_admina'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(s.t order by s.decided_at desc) from (
        select jsonb_build_object('id', c.id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city, 'email', u.email,
                                  'contact_name', c.contact_name, 'method', c.method, 'status', c.status,
                                  'auto', c.decided_by is null, 'admin_note', c.admin_note) as t, c.decided_at
          from public.place_claims c join public.places p on p.id = c.place_id join auth.users u on u.id = c.user_id
         where c.status in ('zatwierdzone','odrzucone') order by c.decided_at desc limit 30) s), '[]'::jsonb),
    'owners', coalesce((select jsonb_agg(jsonb_build_object(
        'place_id', o.place_id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city, 'user_id', o.user_id,
        'email', u.email, 'name', o.contact_name, 'role', o.role, 'method', o.method, 'since', o.created_at)
        order by lower(p.name), o.created_at)
        from public.place_owners o join public.places p on p.id = o.place_id join auth.users u on u.id = o.user_id), '[]'::jsonb),
    'plus', coalesce((select jsonb_agg(jsonb_build_object(
        'place_name', p.name, 'place_slug', p.slug, 'city', p.city, 'email', i.contact_email, 'note', i.note, 'created_at', i.created_at)
        order by i.created_at desc)
        from public.place_plus_interest i join public.places p on p.id = i.place_id), '[]'::jsonb));
end;
$$;

-- Liczba spraw dla panelu: zgłoszenia przejęć do decyzji + zdjęcia w opiniach do zatwierdzenia
create or replace function public.admin_stage5_counts()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select case when not public.is_admin() then jsonb_build_object('claims', 0, 'photos', 0)
         else jsonb_build_object(
           'claims', (select count(*) from public.place_claims where status = 'oczekuje_admina'),
           'photos', (select count(*) from public.place_review_photos where status = 'oczekuje')) end;
$$;

-- ---------- AUTOMAT DZIENNY: kasowanie dowodów po 30 dniach --------------

create or replace function public.claims_due_purge()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'evidence_path', evidence_path)), '[]'::jsonb)
    from public.place_claims
   where purge_at is not null and purge_at <= current_date and purged_at is null;
$$;

create or replace function public.claims_mark_purged(p_ids bigint[])
returns void
language sql security definer
set search_path = public
as $$
  update public.place_claims
     set evidence_path = null, evidence_note = '', contact_phone = '', purged_at = now()
   where id = any (coalesce(p_ids, '{}')) and purged_at is null;
$$;

-- ---------- RLS ----------------------------------------------------------

alter table public.place_claims          enable row level security;
alter table public.place_claim_codes     enable row level security;
alter table public.place_owners          enable row level security;
alter table public.place_owner_snapshots enable row level security;
alter table public.place_review_replies  enable row level security;
alter table public.place_photos          enable row level security;
alter table public.place_review_photos   enable row level security;
alter table public.place_plus_interest   enable row level security;

drop policy if exists "przejecia - wlasne" on public.place_claims;
create policy "przejecia - wlasne" on public.place_claims for select to authenticated using (user_id = auth.uid());
drop policy if exists "przejecia - admin" on public.place_claims;
create policy "przejecia - admin" on public.place_claims for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wlasciciele - wlasne" on public.place_owners;
create policy "wlasciciele - wlasne" on public.place_owners for select to authenticated using (user_id = auth.uid());
drop policy if exists "wlasciciele - admin" on public.place_owners;
create policy "wlasciciele - admin" on public.place_owners for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kopie profili - admin" on public.place_owner_snapshots;
create policy "kopie profili - admin" on public.place_owner_snapshots for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "odpowiedzi - widoczne" on public.place_review_replies;
create policy "odpowiedzi - widoczne" on public.place_review_replies
  for select using (status = 'opublikowana' and public.place_visible(place_id));
drop policy if exists "odpowiedzi - admin" on public.place_review_replies;
create policy "odpowiedzi - admin" on public.place_review_replies for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "zdjecia salonow - widoczne" on public.place_photos;
create policy "zdjecia salonow - widoczne" on public.place_photos for select using (public.place_visible(place_id));
drop policy if exists "zdjecia salonow - admin" on public.place_photos;
create policy "zdjecia salonow - admin" on public.place_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "zdjecia opinii - opublikowane" on public.place_review_photos;
create policy "zdjecia opinii - opublikowane" on public.place_review_photos
  for select using (status = 'opublikowane' and public.place_visible(place_id));
drop policy if exists "zdjecia opinii - wlasne" on public.place_review_photos;
create policy "zdjecia opinii - wlasne" on public.place_review_photos for select to authenticated using (user_id = auth.uid());
drop policy if exists "zdjecia opinii - admin" on public.place_review_photos;
create policy "zdjecia opinii - admin" on public.place_review_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "plus - admin" on public.place_plus_interest;
create policy "plus - admin" on public.place_plus_interest for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- ZASOBNIKI NA ZDJĘCIA (Storage) -------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('salony',          'salony',          true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('opinie-salonow',  'opinie-salonow',  true,  5242880, array['image/jpeg','image/png','image/webp']),
  ('przejecia',       'przejecia',       false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Czy pierwszy człon ścieżki ("123/plik.jpg") to salon użytkownika?
create or replace function public.storage_place_folder_ok(p_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case when (storage.foldername(p_name))[1] ~ '^[0-9]{1,18}$'
              then public.can_edit_place(((storage.foldername(p_name))[1])::bigint)
              else false end;
$$;

-- Pierwszy człon ścieżki to identyfikator zalogowanego użytkownika ("uuid/plik.jpg")
create or replace function public.storage_own_folder_ok(p_name text)
returns boolean
language sql stable
set search_path = public
as $$
  select auth.uid() is not null and (storage.foldername(p_name))[1] = auth.uid()::text;
$$;

-- Wysyłać zdjęcia do opinii może tylko ktoś, kto napisał opinię; dowody przejęcia tylko ktoś z otwartym zgłoszeniem
create or replace function public.can_upload_review_photo()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.place_reviews where user_id = auth.uid());
$$;

create or replace function public.can_upload_claim_evidence()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.place_claims where user_id = auth.uid() and status = 'nowe');
$$;

drop policy if exists "salony - dodaje wlasciciel" on storage.objects;
create policy "salony - dodaje wlasciciel" on storage.objects for insert to authenticated
  with check (bucket_id = 'salony' and public.storage_place_folder_ok(name));
drop policy if exists "salony - czyta wlasciciel" on storage.objects;
create policy "salony - czyta wlasciciel" on storage.objects for select to authenticated
  using (bucket_id = 'salony' and public.storage_place_folder_ok(name));
drop policy if exists "salony - usuwa wlasciciel" on storage.objects;
create policy "salony - usuwa wlasciciel" on storage.objects for delete to authenticated
  using (bucket_id = 'salony' and public.storage_place_folder_ok(name));

drop policy if exists "opinie salonow - dodaje autor" on storage.objects;
create policy "opinie salonow - dodaje autor" on storage.objects for insert to authenticated
  with check (bucket_id = 'opinie-salonow' and public.storage_own_folder_ok(name) and public.can_upload_review_photo());
drop policy if exists "opinie salonow - czyta autor lub admin" on storage.objects;
create policy "opinie salonow - czyta autor lub admin" on storage.objects for select to authenticated
  using (bucket_id = 'opinie-salonow' and (public.storage_own_folder_ok(name) or public.is_admin()));
drop policy if exists "opinie salonow - usuwa autor lub admin" on storage.objects;
create policy "opinie salonow - usuwa autor lub admin" on storage.objects for delete to authenticated
  using (bucket_id = 'opinie-salonow' and (public.storage_own_folder_ok(name) or public.is_admin()));

drop policy if exists "przejecia - dodaje zglaszajacy" on storage.objects;
create policy "przejecia - dodaje zglaszajacy" on storage.objects for insert to authenticated
  with check (bucket_id = 'przejecia' and public.storage_own_folder_ok(name) and public.can_upload_claim_evidence());
drop policy if exists "przejecia - czyta zglaszajacy lub admin" on storage.objects;
create policy "przejecia - czyta zglaszajacy lub admin" on storage.objects for select to authenticated
  using (bucket_id = 'przejecia' and (public.storage_own_folder_ok(name) or public.is_admin()));
drop policy if exists "przejecia - usuwa zglaszajacy lub admin" on storage.objects;
create policy "przejecia - usuwa zglaszajacy lub admin" on storage.objects for delete to authenticated
  using (bucket_id = 'przejecia' and (public.storage_own_folder_ok(name) or public.is_admin()));

-- ---------- ZMIENIONE FUNKCJE Z ETAPU 4 -----------------------------------

-- Opublikowane opinie salonu + odpowiedź salonu + zatwierdzone zdjęcia
create or replace function public.place_reviews_json(p_place bigint, p_limit int default 30)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'author', r.author, 'rating', r.rating,
           'r_quality', r.r_quality, 'r_care', r.r_care, 'r_clean', r.r_clean, 'r_price', r.r_price,
           'body', r.body, 'service', sd.label, 'size_class', r.size_class, 'paid_amount', r.paid_amount,
           'created_at', r.created_at,
           'reply', (select jsonb_build_object('body', x.body, 'created_at', x.created_at, 'updated_at', x.updated_at)
                       from public.place_review_replies x where x.review_id = r.id and x.status = 'opublikowana'),
           'photos', coalesce((select jsonb_agg(ph.path order by ph.id) from public.place_review_photos ph
                                where ph.review_id = r.id and ph.status = 'opublikowane'), '[]'::jsonb)
         ) order by r.created_at desc), '[]'::jsonb)
    from (select * from public.place_reviews
           where place_id = p_place and status = 'opublikowana'
             and (public.place_visible(p_place) or public.is_admin())
           order by created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100)) r
    left join public.service_defs sd on sd.code = r.service;
$$;

-- Stan zalogowanego klienta względem salonu (dodane: id własnej opinii, jej zdjęcia, czy jest właścicielem)
create or replace function public.place_user_state(p_place bigint)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select case when auth.uid() is null then jsonb_build_object('logged_in', false)
  else jsonb_build_object(
    'logged_in', true,
    'is_owner', public.is_place_owner(p_place),
    'favorite', exists (select 1 from public.place_favorites f where f.user_id = auth.uid() and f.place_id = p_place),
    'mine', (select jsonb_build_object('id', r.id, 'rating', r.rating, 'r_quality', r.r_quality, 'r_care', r.r_care,
                                       'r_clean', r.r_clean, 'r_price', r.r_price, 'body', r.body,
                                       'service', r.service, 'size_class', r.size_class,
                                       'paid_amount', r.paid_amount, 'status', r.status,
                                       'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'status', ph.status) order by ph.id)
                                                             from public.place_review_photos ph where ph.review_id = r.id), '[]'::jsonb))
               from public.place_reviews r where r.place_id = p_place and r.user_id = auth.uid()),
    'today', (select count(*) from public.place_reviews r
               where r.user_id = auth.uid() and r.created_at > now() - interval '1 day')
  ) end;
$$;

-- Profil salonu (dodane: zdjęcia salonu, "profil właściciela", plan)
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

-- ---------- UPRAWNIENIA --------------------------------------------------

revoke all on public.place_claims, public.place_claim_codes, public.place_owners, public.place_owner_snapshots,
              public.place_review_replies, public.place_photos, public.place_review_photos, public.place_plus_interest from anon, authenticated;
grant select on public.place_claims, public.place_owners to authenticated;
grant select, insert, update, delete on public.place_owner_snapshots, public.place_plus_interest to authenticated;   -- tylko admin (RLS)
grant select on public.place_review_replies, public.place_photos, public.place_review_photos to anon;
grant select, insert, update, delete on public.place_review_replies, public.place_photos, public.place_review_photos to authenticated;
grant insert, update, delete on public.place_claims, public.place_owners to authenticated;                           -- tylko admin (RLS)
grant all on public.place_claims, public.place_claim_codes, public.place_owners, public.place_owner_snapshots,
             public.place_review_replies, public.place_photos, public.place_review_photos, public.place_plus_interest to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- funkcje wewnętrzne: bez wywołań z zewnątrz
revoke all on function public._grant_ownership(bigint, uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public._replace_hours(bigint, jsonb) from public, anon, authenticated;
revoke all on function public._replace_prices(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.place_owners_after_delete() from public, anon, authenticated;
revoke all on function public.place_reviews_no_owner() from public, anon, authenticated;

-- tylko serwer (klucz serwisowy)
revoke all on function public.claim_issue_code(bigint, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.place_owner_emails(bigint) from public, anon, authenticated;
revoke all on function public.place_owner_emails_all(bigint) from public, anon, authenticated;
revoke all on function public.claims_due_purge() from public, anon, authenticated;
revoke all on function public.claims_mark_purged(bigint[]) from public, anon, authenticated;
grant execute on function public.claim_issue_code(bigint, uuid, text, text, text) to service_role;
grant execute on function public.place_owner_emails(bigint) to service_role;
grant execute on function public.place_owner_emails_all(bigint) to service_role;
grant execute on function public.claims_due_purge() to service_role;
grant execute on function public.claims_mark_purged(bigint[]) to service_role;

-- pomocnicze (do reguł RLS i widoków)
revoke all on function public.is_place_owner(bigint) from public;
revoke all on function public.can_edit_place(bigint) from public;
revoke all on function public.place_has_owner(bigint) from public;
revoke all on function public.claim_email_allowed(bigint, text) from public, anon, authenticated;
revoke all on function public.storage_place_folder_ok(text) from public;
revoke all on function public.storage_own_folder_ok(text) from public;
revoke all on function public.can_upload_review_photo() from public;
revoke all on function public.can_upload_claim_evidence() from public;
grant execute on function public.is_place_owner(bigint) to anon, authenticated;
grant execute on function public.can_edit_place(bigint) to anon, authenticated;
grant execute on function public.place_has_owner(bigint) to anon, authenticated;
grant execute on function public.storage_place_folder_ok(text) to authenticated;
grant execute on function public.storage_own_folder_ok(text) to authenticated;
grant execute on function public.can_upload_review_photo() to authenticated;
grant execute on function public.can_upload_claim_evidence() to authenticated;

-- funkcje dla zalogowanych
revoke all on function public.place_claim_info(text) from public;
revoke all on function public.start_place_claim(bigint, text, text, text, boolean) from public, anon;
revoke all on function public.verify_place_claim(bigint, text) from public, anon;
revoke all on function public.submit_manual_claim(bigint, text, text) from public, anon;
revoke all on function public.withdraw_place_claim(bigint) from public, anon;
revoke all on function public.decide_place_claim(bigint, boolean, text, boolean) from public, anon;
revoke all on function public.revoke_place_owner(bigint, uuid) from public, anon;
revoke all on function public.release_place(bigint, boolean) from public, anon;
revoke all on function public.owner_my_places() from public, anon;
revoke all on function public.owner_dashboard(text) from public, anon;
revoke all on function public.owner_update_place(bigint, text, text, text, text, text, text, text, text[], text[]) from public, anon;
revoke all on function public.owner_save_hours(bigint, jsonb) from public, anon;
revoke all on function public.owner_save_prices(bigint, jsonb) from public, anon;
revoke all on function public.set_owner_notify(bigint, boolean) from public, anon;
revoke all on function public.owner_add_photo(bigint, text, text) from public, anon;
revoke all on function public.owner_delete_photo(bigint) from public, anon;
revoke all on function public.owner_set_main_photo(bigint) from public, anon;
revoke all on function public.reply_to_review(bigint, text) from public, anon;
revoke all on function public.delete_review_reply(bigint) from public, anon;
revoke all on function public.add_review_photo(bigint, text) from public, anon;
revoke all on function public.delete_review_photo(bigint) from public, anon;
revoke all on function public.moderate_review_photo(bigint, boolean) from public, anon;
revoke all on function public.set_plus_interest(bigint, boolean, text) from public, anon;
revoke all on function public.admin_claims_overview() from public, anon;
revoke all on function public.admin_stage5_counts() from public, anon;

grant execute on function public.place_claim_info(text) to anon, authenticated;
grant execute on function public.start_place_claim(bigint, text, text, text, boolean) to authenticated;
grant execute on function public.verify_place_claim(bigint, text) to authenticated;
grant execute on function public.submit_manual_claim(bigint, text, text) to authenticated;
grant execute on function public.withdraw_place_claim(bigint) to authenticated;
grant execute on function public.decide_place_claim(bigint, boolean, text, boolean) to authenticated;
grant execute on function public.revoke_place_owner(bigint, uuid) to authenticated;
grant execute on function public.release_place(bigint, boolean) to authenticated;
grant execute on function public.owner_my_places() to authenticated;
grant execute on function public.owner_dashboard(text) to authenticated;
grant execute on function public.owner_update_place(bigint, text, text, text, text, text, text, text, text[], text[]) to authenticated;
grant execute on function public.owner_save_hours(bigint, jsonb) to authenticated;
grant execute on function public.owner_save_prices(bigint, jsonb) to authenticated;
grant execute on function public.set_owner_notify(bigint, boolean) to authenticated;
grant execute on function public.owner_add_photo(bigint, text, text) to authenticated;
grant execute on function public.owner_delete_photo(bigint) to authenticated;
grant execute on function public.owner_set_main_photo(bigint) to authenticated;
grant execute on function public.reply_to_review(bigint, text) to authenticated;
grant execute on function public.delete_review_reply(bigint) to authenticated;
grant execute on function public.add_review_photo(bigint, text) to authenticated;
grant execute on function public.delete_review_photo(bigint) to authenticated;
grant execute on function public.moderate_review_photo(bigint, boolean) to authenticated;
grant execute on function public.set_plus_interest(bigint, boolean, text) to authenticated;
grant execute on function public.admin_claims_overview() to authenticated;
grant execute on function public.admin_stage5_counts() to authenticated;

revoke all on function public.place_reviews_json(bigint, int) from public;
grant execute on function public.place_reviews_json(bigint, int) to anon, authenticated;
grant execute on function public.place_user_state(bigint) to anon, authenticated;
grant execute on function public.place_page(text) to anon, authenticated;
