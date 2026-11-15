-- =====================================================================
--  ETAP 5a: pakiet bezpieczeństwa przejmowania salonów
--  Uruchamiać PO 13_konta_salonow.sql. Można uruchamiać wielokrotnie, nie kasuje danych.
--
--  - powiadomienie dotychczasowych opiekunów i adresów salonu z katalogu o każdym przejęciu,
--    z przyciskiem "To nie ja" (zawieszenie nowego opiekuna + sprzeciw do rozstrzygnięcia przez admina)
--  - 48 godzin wstrzymania zmian krytycznych (telefon, e-mail, strona, rezerwacja, social media) dla nowego opiekuna
--  - limity: jedno otwarte zgłoszenie na konto, 3 salony na konto, 5 zgłoszeń dziennie z jednego IP,
--    jedna domena e-mail potwierdza salony tylko jednego konta
--  - premia rankingowa ("zweryfikowany") tylko przy silnym dowodzie: kod na adres z NASZEGO katalogu
--
--  Nowe tabele: place_takeover_events (dziennik przejęć i sprzeciwów), place_pending_changes (zmiany czekające),
--  claim_ip_hits (skróty IP, kasowane po 2 dniach). Nowe kolumny: place_claims.strength, place_owners.suspended_at.
-- =====================================================================

-- ---------- KOLUMNY ------------------------------------------------------

alter table public.place_claims add column if not exists strength text not null default 'slaba';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'place_claims_strength_check') then
    alter table public.place_claims add constraint place_claims_strength_check check (strength in ('silna','slaba'));
  end if;
end $$;

alter table public.place_owners add column if not exists suspended_at timestamptz;
alter table public.place_owners add column if not exists suspended_note text not null default '';

-- ---------- TABELE -------------------------------------------------------

create table if not exists public.place_takeover_events (
  id             bigint generated always as identity primary key,
  place_id       bigint not null references public.places (id) on delete cascade,
  user_id        uuid references auth.users (id) on delete set null,
  claim_id       bigint references public.place_claims (id) on delete set null,
  claimant_name  text not null default '',
  claimant_role  text not null default 'wlasciciel',
  method         text not null default 'email',
  strength       text not null default 'slaba' check (strength in ('silna','slaba')),
  token          text not null unique,
  notify         jsonb not null default '[]'::jsonb,
  hold_until     timestamptz not null,
  created_at     timestamptz not null default now(),
  notified_at    timestamptz,
  objected_at    timestamptz,
  objection_note text not null default '' check (char_length(objection_note) <= 500),
  resolved_at    timestamptz,
  resolved_by    uuid,
  resolution     text check (resolution in ('przywrocono','odrzucono')),
  admin_note     text not null default '' check (char_length(admin_note) <= 1000)
);
create index if not exists place_takeover_events_open_idx on public.place_takeover_events (objected_at)
  where objected_at is not null and resolved_at is null;
create index if not exists place_takeover_events_unnotified_idx on public.place_takeover_events (id) where notified_at is null;
create index if not exists place_takeover_events_place_idx on public.place_takeover_events (place_id, id desc);

create table if not exists public.place_pending_changes (
  id          bigint generated always as identity primary key,
  place_id    bigint not null,
  user_id     uuid not null,
  changes     jsonb not null,
  apply_at    timestamptz not null,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (place_id, user_id),
  foreign key (place_id, user_id) references public.place_owners (place_id, user_id) on delete cascade
);

create table if not exists public.claim_ip_hits (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists claim_ip_hits_idx on public.claim_ip_hits (ip_hash, created_at desc);

alter table public.place_takeover_events enable row level security;
alter table public.place_pending_changes enable row level security;
alter table public.claim_ip_hits         enable row level security;

revoke all on public.place_takeover_events, public.place_pending_changes, public.claim_ip_hits from anon, authenticated;
grant all on public.place_takeover_events, public.place_pending_changes, public.claim_ip_hits to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ---------- UPRAWNIENIA OPIEKUNA: zawieszony nie edytuje -----------------

create or replace function public.is_place_owner(p_place bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select auth.uid() is not null
     and exists (select 1 from public.place_owners
                  where place_id = p_place and user_id = auth.uid() and suspended_at is null);
$$;

create or replace function public.place_has_owner(p_place bigint)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.place_owners where place_id = p_place and suspended_at is null);
$$;

-- Adresy do powiadomienia o przejęciu: pozostali opiekunowie, dodatkowa lista (np. odłączeni właśnie opiekunowie)
-- oraz adresy salonu z katalogu (publiczny i prywatny). Bez adresu samego zgłaszającego.
create or replace function public._takeover_recipients(p_place bigint, p_exclude uuid, p_extra jsonb default '[]'::jsonb)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(t.e order by t.e), '[]'::jsonb)
    from (
      select distinct s.e
        from (
          select lower(trim(u.email)) as e
            from public.place_owners o join auth.users u on u.id = o.user_id
           where o.place_id = p_place and o.user_id is distinct from p_exclude
          union all
          select lower(trim(x)) from jsonb_array_elements_text(coalesce(p_extra, '[]'::jsonb)) x
          union all
          select lower(trim(p.email)) from public.places p where p.id = p_place
          union all
          select lower(trim(pp.contact_email)) from public.place_private pp where pp.place_id = p_place
        ) s
       where s.e is not null and s.e <> ''
         and s.e <> coalesce((select lower(trim(u2.email)) from auth.users u2 where u2.id = p_exclude), '')
    ) t;
$$;

-- ---------- PRZEJĘCIE: nadanie roli (nowa wersja) ------------------------

drop function if exists public._grant_ownership(bigint, uuid, text, text, text, bigint);

-- p_strong: silny dowód (kod na adres z katalogu) = status "zweryfikowany" (premia rankingowa, odznaki).
-- p_prev: adresy dotychczasowych opiekunów odłączonych tuż przed wywołaniem (zastąpienie przez admina).
create or replace function public._grant_ownership(
  p_place bigint, p_user uuid, p_role text, p_name text, p_method text, p_claim bigint,
  p_strong boolean default false, p_prev jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.places;
  v_notify jsonb;
begin
  select * into p from public.places where id = p_place for update;
  if not found then raise exception 'Nie znaleziono salonu.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.place_owners where place_id = p_place and user_id = p_user) then return; end if;
  if (select count(*) from public.place_owners where place_id = p_place) >= 3 then
    raise exception 'Ten salon ma już trzech właścicieli (limit).' using errcode = 'P0001';
  end if;

  v_notify := public._takeover_recipients(p_place, p_user, coalesce(p_prev, '[]'::jsonb));

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

  if coalesce(p_strong, false) and not p.verified then
    update public.places set verified = true, verified_by_owner = true where id = p_place;
  end if;

  -- właściciel nie ocenia własnego salonu
  update public.place_reviews
     set status = 'ukryta', hidden_note = 'Autor jest właścicielem salonu.'
   where place_id = p_place and user_id = p_user and status <> 'ukryta';

  insert into public.place_takeover_events
    (place_id, user_id, claim_id, claimant_name, claimant_role, method, strength, token, notify, hold_until)
  values
    (p_place, p_user, p_claim, left(coalesce(p_name, ''), 100), coalesce(p_role, 'wlasciciel'), coalesce(p_method, 'email'),
     case when coalesce(p_strong, false) then 'silna' else 'slaba' end,
     encode(extensions.gen_random_bytes(16), 'hex'), v_notify, now() + interval '48 hours');
end;
$$;

-- ---------- KOD E-MAIL: siła dowodu i limit domeny -----------------------

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
  v_strong boolean;
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

  -- silny dowód: kod trafia na adres, który mamy w NASZYM katalogu (niezależnie od tego, jak zgłaszający go wskazał)
  v_strong := coalesce(v_target = nullif(lower(trim(v_place.email)), ''), false) or coalesce(v_target = v_priv, false);

  -- jedna domena = jedno konto: domena, którą już potwierdził opiekun innego konta, idzie drogą ręczną
  if not v_strong and exists (
       select 1 from public.place_owners o
         join public.place_claims c2 on c2.id = o.claim_id
        where o.user_id <> p_user and c2.verify_email <> ''
          and split_part(c2.verify_email, '@', 2) = split_part(v_target, '@', 2)) then
    raise exception 'Ta domena e-mail jest już powiązana z innym kontem. Wybierz weryfikację ręczną (zdjęcie szyldu) - sprawdzimy zgłoszenie.' using errcode = 'P0001';
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

  update public.place_claims
     set verify_email = v_target, strength = case when v_strong then 'silna' else 'slaba' end, updated_at = now()
   where id = p_claim;
  return v_target;
end;
$$;

-- Sprawdzenie kodu (nowa wersja: przekazuje siłę dowodu)
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
  perform public._grant_ownership(c.place_id, c.user_id, c.role, c.contact_name, 'email', c.id, c.strength = 'silna');
  update public.place_claims
     set method = 'email', email_verified_at = now(), status = 'zatwierdzone', decided_at = now(),
         decided_by = null, purge_at = current_date + 30, updated_at = now()
   where id = p_claim;
  return 'zatwierdzone';
end;
$$;

-- Droga ręczna: zawsze słaby dowód (nowa wersja zeruje siłę po wcześniejszym kodzie)
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
     set method = 'reczna', strength = 'slaba', evidence_path = v_path, evidence_note = v_note, status = 'oczekuje_admina',
         conflict = v_conflict, conflict_since = case when v_conflict then now() end, updated_at = now()
   where id = p_claim;
  return 'oczekuje_admina';
end;
$$;

-- Decyzja Mariusza (nowa wersja: adresy odłączonych opiekunów trafiają do powiadomienia, siła dowodu z kodu)
create or replace function public.decide_place_claim(p_claim bigint, p_approve boolean, p_note text default '', p_replace boolean default false)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  c public.place_claims;
  v_prev jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Brak uprawnień.' using errcode = '42501'; end if;
  select * into c from public.place_claims where id = p_claim for update;
  if not found or c.status <> 'oczekuje_admina' then
    raise exception 'To zgłoszenie nie czeka już na decyzję.' using errcode = 'P0001';
  end if;
  if p_approve then
    select coalesce(jsonb_agg(u.email), '[]'::jsonb) into v_prev
      from public.place_owners o join auth.users u on u.id = o.user_id
     where o.place_id = c.place_id and o.user_id <> c.user_id and u.email is not null;
    if coalesce(p_replace, false) then
      delete from public.place_owners where place_id = c.place_id;
    end if;
    perform public._grant_ownership(c.place_id, c.user_id, c.role, c.contact_name,
                                    case when c.method = 'email' then 'email' else 'reczna' end, c.id,
                                    c.method = 'email' and c.strength = 'silna', v_prev);
  end if;
  update public.place_claims
     set status = case when p_approve then 'zatwierdzone' else 'odrzucone' end,
         admin_note = left(trim(coalesce(p_note, '')), 1000),
         decided_at = now(), decided_by = auth.uid(), purge_at = current_date + 30, updated_at = now()
   where id = p_claim;
  return case when p_approve then 'zatwierdzone' else 'odrzucone' end;
end;
$$;

-- ---------- LIMITY ZGŁOSZEŃ ----------------------------------------------

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

  -- niedokończone zgłoszenia wygasają po 2 dniach
  update public.place_claims
     set status = 'wycofane', decided_at = now(), purge_at = current_date, updated_at = now()
   where user_id = auth.uid() and status = 'nowe' and updated_at < now() - interval '2 days';

  select id into v_id from public.place_claims
   where place_id = p_place and user_id = auth.uid() and status in ('nowe','oczekuje_admina');
  if found then
    update public.place_claims set contact_name = left(v_name, 100), role = v_role, contact_phone = v_phone, updated_at = now()
     where id = v_id;
    return v_id;
  end if;

  if exists (select 1 from public.place_claims
              where user_id = auth.uid() and status in ('nowe','oczekuje_admina') and place_id <> p_place) then
    raise exception 'Masz już otwarte zgłoszenie innego salonu. Dokończ je albo wycofaj, potem zgłoś kolejny.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.place_owners where user_id = auth.uid()) >= 3 then
    raise exception 'Jedno konto może prowadzić do 3 salonów. Jeśli zarządzasz większą siecią, napisz do nas.' using errcode = 'P0001';
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

-- Limit z jednego adresu IP (tylko serwer): zapisuje skrót IP, zwraca false po 5 zgłoszeniach w ciągu doby
create or replace function public.claim_ip_hit(p_ip_hash text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(p_ip_hash, '') = '' then return true; end if;
  delete from public.claim_ip_hits where created_at < now() - interval '2 days';
  if (select count(*) from public.claim_ip_hits where ip_hash = p_ip_hash and created_at > now() - interval '1 day') >= 5 then
    return false;
  end if;
  insert into public.claim_ip_hits (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

-- ---------- WSTRZYMANIE ZMIAN KRYTYCZNYCH (48 godzin) --------------------

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
  p          public.places;
  v_hold     timestamptz;
  v_chg      jsonb := '{}'::jsonb;
  v_phone    text := left(trim(coalesce(p_phone, '')), 30);
  v_email    text := left(trim(coalesce(p_email, '')), 200);
  v_website  text := left(trim(coalesce(p_website, '')), 300);
  v_booking  text := left(trim(coalesce(p_booking_url, '')), 300);
  v_insta    text := left(trim(coalesce(p_instagram, '')), 300);
  v_fb       text := left(trim(coalesce(p_facebook, '')), 300);
begin
  if not public.can_edit_place(p_place) then raise exception 'To nie jest Twój salon.' using errcode = 'P0001'; end if;
  if cardinality(v_species) < 1 or not (v_species <@ array['pies','kot']::text[]) then
    raise exception 'Zaznacz, jakie zwierzęta przyjmujesz (psy, koty).' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(code order by sort), '{}') into v_features
    from public.feature_defs where code = any (coalesce(p_features, '{}'));

  select * into p from public.places where id = p_place for update;
  if not found then raise exception 'Nie znaleziono salonu.' using errcode = 'P0001'; end if;

  if not public.is_admin() then
    select o.created_at + interval '48 hours' into v_hold
      from public.place_owners o where o.place_id = p_place and o.user_id = auth.uid();
  end if;

  -- przez 48 godzin od przejęcia zmiany kontaktu i linków czekają (opiekun widzi je jako zaplanowane)
  if v_hold is not null and v_hold > now() then
    if v_phone   is distinct from coalesce(p.phone, '')       then v_chg := v_chg || jsonb_build_object('phone', v_phone);          v_phone   := coalesce(p.phone, ''); end if;
    if v_email   is distinct from coalesce(p.email, '')       then v_chg := v_chg || jsonb_build_object('email', v_email);          v_email   := coalesce(p.email, ''); end if;
    if v_website is distinct from coalesce(p.website, '')     then v_chg := v_chg || jsonb_build_object('website', v_website);      v_website := coalesce(p.website, ''); end if;
    if v_booking is distinct from coalesce(p.booking_url, '') then v_chg := v_chg || jsonb_build_object('booking_url', v_booking); v_booking := coalesce(p.booking_url, ''); end if;
    if v_insta   is distinct from coalesce(p.instagram, '')   then v_chg := v_chg || jsonb_build_object('instagram', v_insta);     v_insta   := coalesce(p.instagram, ''); end if;
    if v_fb      is distinct from coalesce(p.facebook, '')    then v_chg := v_chg || jsonb_build_object('facebook', v_fb);          v_fb      := coalesce(p.facebook, ''); end if;
    if v_chg <> '{}'::jsonb then
      insert into public.place_pending_changes (place_id, user_id, changes, apply_at)
      values (p_place, auth.uid(), v_chg, v_hold)
      on conflict (place_id, user_id) do update set changes = excluded.changes, apply_at = excluded.apply_at;
    else
      delete from public.place_pending_changes where place_id = p_place and user_id = auth.uid();
    end if;
  end if;

  update public.places set
    description = left(trim(coalesce(p_description, '')), 3000),
    phone = v_phone,
    email = v_email,
    website = v_website,
    booking_url = v_booking,
    instagram = v_insta,
    facebook = v_fb,
    features = v_features,
    species = v_species
   where id = p_place
   returning city into v_city;
  perform public._refresh_place_ranking(v_city);
end;
$$;

-- Automat (cron, klucz serwisowy): zmiany, którym minęło 48 godzin, wchodzą w życie
create or replace function public.apply_due_place_changes()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  r     public.place_pending_changes;
  v_n   int := 0;
  v_city text;
begin
  for r in select * from public.place_pending_changes where apply_at <= now() order by id loop
    if exists (select 1 from public.place_owners where place_id = r.place_id and user_id = r.user_id and suspended_at is null) then
      update public.places set
        phone       = case when r.changes ? 'phone'       then r.changes->>'phone'       else phone end,
        email       = case when r.changes ? 'email'       then r.changes->>'email'       else email end,
        website     = case when r.changes ? 'website'     then r.changes->>'website'     else website end,
        booking_url = case when r.changes ? 'booking_url' then r.changes->>'booking_url' else booking_url end,
        instagram   = case when r.changes ? 'instagram'   then r.changes->>'instagram'   else instagram end,
        facebook    = case when r.changes ? 'facebook'    then r.changes->>'facebook'    else facebook end
       where id = r.place_id
       returning city into v_city;
      perform public._refresh_place_ranking(v_city);
      v_n := v_n + 1;
    end if;
    delete from public.place_pending_changes where id = r.id;
  end loop;
  return v_n;
end;
$$;

-- ---------- POWIADOMIENIA (tylko serwer) ---------------------------------

-- Wiadomości do wysłania: o przejęciu (do dotychczasowych opiekunów i adresów katalogu) i o zaplanowanej zmianie
create or replace function public.takeover_pending_notices()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.x order by s.k), '[]'::jsonb) from (
    select e.id * 2 as k,
           jsonb_build_object('kind', 'przejecie', 'id', e.id, 'token', e.token, 'place_name', p.name, 'place_slug', p.slug,
                              'claimant_name', e.claimant_name, 'role', e.claimant_role, 'notify', e.notify,
                              'hold_until', e.hold_until) as x
      from public.place_takeover_events e join public.places p on p.id = e.place_id
     where e.notified_at is null and e.objected_at is null
    union all
    select c.id * 2 + 1 as k,
           jsonb_build_object('kind', 'zmiana', 'id', c.id,
                              'token', (select e.token from public.place_takeover_events e
                                         where e.place_id = c.place_id and e.user_id = c.user_id order by e.id desc limit 1),
                              'place_name', p.name, 'place_slug', p.slug,
                              'fields', array(select jsonb_object_keys(c.changes)),
                              'apply_at', c.apply_at,
                              'notify', public._takeover_recipients(c.place_id, c.user_id, '[]'::jsonb)) as x
      from public.place_pending_changes c join public.places p on p.id = c.place_id
     where c.notified_at is null
  ) s;
$$;

create or replace function public.takeover_mark_notified(p_events bigint[], p_changes bigint[])
returns void
language sql security definer
set search_path = public
as $$
  update public.place_takeover_events set notified_at = now() where id = any (coalesce(p_events, '{}')) and notified_at is null;
  update public.place_pending_changes set notified_at = now() where id = any (coalesce(p_changes, '{}')) and notified_at is null;
$$;

-- ---------- "TO NIE JA" (tylko serwer, kod z e-maila) --------------------

create or replace function public.takeover_event_info(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  e public.place_takeover_events;
  v_name text;
begin
  select * into e from public.place_takeover_events where token = coalesce(p_token, '');
  if not found then return null; end if;
  select name into v_name from public.places where id = e.place_id;
  return jsonb_build_object(
    'place_name', v_name, 'claimant_name', e.claimant_name, 'role', e.claimant_role, 'created_at', e.created_at,
    'objected', e.objected_at is not null, 'resolved', e.resolved_at is not null,
    'expired', e.created_at < now() - interval '30 days');
end;
$$;

create or replace function public.takeover_object(p_token text, p_note text default '')
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  e public.place_takeover_events;
  v_place text;
  v_mail  text;
begin
  select * into e from public.place_takeover_events where token = coalesce(p_token, '') for update;
  if not found then return jsonb_build_object('status', 'nie_znaleziono'); end if;
  if e.created_at < now() - interval '30 days' then return jsonb_build_object('status', 'wygasl'); end if;
  if e.objected_at is not null then return jsonb_build_object('status', 'juz'); end if;
  if not exists (select 1 from public.place_owners where place_id = e.place_id and user_id = e.user_id) then
    return jsonb_build_object('status', 'brak');
  end if;

  update public.place_takeover_events
     set objected_at = now(), objection_note = left(trim(coalesce(p_note, '')), 500)
   where id = e.id;
  update public.place_owners
     set suspended_at = now(), suspended_note = 'Sprzeciw: „To nie ja”'
   where place_id = e.place_id and user_id = e.user_id and suspended_at is null;
  delete from public.place_pending_changes where place_id = e.place_id and user_id = e.user_id;

  select name into v_place from public.places where id = e.place_id;
  select email into v_mail from auth.users where id = e.user_id;
  return jsonb_build_object('status', 'ok', 'event_id', e.id, 'place_name', v_place, 'claimant_email', v_mail);
end;
$$;

-- ---------- ROZSTRZYGNIĘCIE SPRZECIWU (admin) ----------------------------

-- Wewnętrzna: profil wraca do kopii sprzed przejęcia; zwraca ścieżki zdjęć dodanych przez opiekunów do usunięcia z zasobnika
create or replace function public._restore_place_snapshot(p_place bigint)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_snap   jsonb;
  v_photos jsonb := '[]'::jsonb;
begin
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
  select coalesce(jsonb_agg(path), '[]'::jsonb) into v_photos from public.place_photos where place_id = p_place and by_owner;
  delete from public.place_photos where place_id = p_place and by_owner;
  delete from public.place_review_replies where place_id = p_place;
  delete from public.place_plus_interest where place_id = p_place;
  return v_photos;
end;
$$;

-- p_uphold = true: opiekun wraca (sprzeciw był niesłuszny); false: przejęcie odrzucone, opiekun usunięty,
-- a gdy był jedyny, profil wraca do stanu sprzed przejęcia i traci status nadany przez przejęcie.
create or replace function public.admin_resolve_takeover(p_event bigint, p_uphold boolean, p_note text default '')
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  e public.place_takeover_events;
  v_last   boolean;
  v_photos jsonb := '[]'::jsonb;
  v_place  text;
  v_mail   text;
begin
  if not public.is_admin() then raise exception 'Brak uprawnień.' using errcode = '42501'; end if;
  select * into e from public.place_takeover_events where id = p_event for update;
  if not found or e.objected_at is null or e.resolved_at is not null then
    raise exception 'Ten sprzeciw nie czeka już na decyzję.' using errcode = 'P0001';
  end if;
  select name into v_place from public.places where id = e.place_id;
  select email into v_mail from auth.users where id = e.user_id;

  if coalesce(p_uphold, false) then
    update public.place_owners set suspended_at = null, suspended_note = ''
     where place_id = e.place_id and user_id = e.user_id;
  else
    v_last := (select count(*) from public.place_owners where place_id = e.place_id) = 1
              and exists (select 1 from public.place_owners where place_id = e.place_id and user_id = e.user_id);
    if v_last then v_photos := public._restore_place_snapshot(e.place_id); end if;
    delete from public.place_owners where place_id = e.place_id and user_id = e.user_id;   -- trigger zdejmuje status i kopię
    if e.claim_id is not null then
      update public.place_claims set status = 'odrzucone', admin_note = left(trim(coalesce(p_note, '')), 1000),
             decided_at = now(), decided_by = auth.uid(), purge_at = current_date + 30, updated_at = now()
       where id = e.claim_id;
    end if;
  end if;

  update public.place_takeover_events
     set resolved_at = now(), resolved_by = auth.uid(),
         resolution = case when coalesce(p_uphold, false) then 'przywrocono' else 'odrzucono' end,
         admin_note = left(trim(coalesce(p_note, '')), 1000)
   where id = e.id;
  return jsonb_build_object('photo_paths', v_photos, 'claimant_email', v_mail, 'place_name', v_place,
                            'uphold', coalesce(p_uphold, false));
end;
$$;

-- ---------- PANEL WŁAŚCICIELA I ADMINA (nowe wersje) ---------------------

create or replace function public.owner_my_places()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'slug', p.slug, 'name', p.name, 'city', p.city, 'status', p.status, 'role', o.role,
           'rating_avg', p.rating_avg, 'rating_count', p.rating_count, 'city_rank', p.city_rank) order by lower(p.name)), '[]'::jsonb)
    from public.place_owners o join public.places p on p.id = o.place_id
   where o.user_id = auth.uid() and o.suspended_at is null;
$$;

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
                          from public.place_owners o where o.place_id = p.id and o.suspended_at is null), '[]'::jsonb),
    'my_notify', coalesce((select o.notify_reviews from public.place_owners o where o.place_id = p.id and o.user_id = auth.uid()), true),
    'hold_until', (select o.created_at + interval '48 hours' from public.place_owners o
                    where o.place_id = p.id and o.user_id = auth.uid() and o.created_at + interval '48 hours' > now()),
    'pending_changes', (select jsonb_build_object('fields', array(select jsonb_object_keys(c.changes)), 'apply_at', c.apply_at)
                          from public.place_pending_changes c where c.place_id = p.id and c.user_id = auth.uid()),
    'plus_interest', exists (select 1 from public.place_plus_interest i where i.place_id = p.id),
    'plus_note', (select i.note from public.place_plus_interest i where i.place_id = p.id)
  );
end;
$$;

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
        'method', c.method, 'strength', c.strength, 'verify_email', c.verify_email, 'email_verified', c.email_verified_at is not null,
        'evidence_path', c.evidence_path, 'evidence_note', c.evidence_note,
        'conflict', c.conflict, 'conflict_since', c.conflict_since, 'created_at', c.created_at,
        'owners', coalesce((select jsonb_agg(jsonb_build_object('name', o.contact_name, 'email', ou.email))
                              from public.place_owners o join auth.users ou on ou.id = o.user_id
                             where o.place_id = c.place_id), '[]'::jsonb)) order by c.created_at)
        from public.place_claims c join public.places p on p.id = c.place_id join auth.users u on u.id = c.user_id
       where c.status = 'oczekuje_admina'), '[]'::jsonb),
    'objections', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'place_id', e.place_id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city,
        'claimant_email', u.email, 'claimant_name', e.claimant_name, 'role', e.claimant_role, 'method', e.method,
        'strength', e.strength, 'created_at', e.created_at, 'objected_at', e.objected_at, 'note', e.objection_note,
        'others', coalesce((select jsonb_agg(jsonb_build_object('name', o.contact_name, 'email', ou.email))
                              from public.place_owners o join auth.users ou on ou.id = o.user_id
                             where o.place_id = e.place_id and o.user_id is distinct from e.user_id), '[]'::jsonb))
        order by e.objected_at)
        from public.place_takeover_events e join public.places p on p.id = e.place_id left join auth.users u on u.id = e.user_id
       where e.objected_at is not null and e.resolved_at is null), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(l.t order by l.created_at desc) from (
        select jsonb_build_object('id', e.id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city,
                                  'claimant_email', u.email, 'claimant_name', e.claimant_name, 'method', e.method,
                                  'strength', e.strength, 'created_at', e.created_at, 'hold_until', e.hold_until,
                                  'objected_at', e.objected_at, 'resolution', e.resolution, 'admin_note', e.admin_note) as t,
               e.created_at
          from public.place_takeover_events e join public.places p on p.id = e.place_id left join auth.users u on u.id = e.user_id
         order by e.created_at desc limit 30) l), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(s.t order by s.decided_at desc) from (
        select jsonb_build_object('id', c.id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city, 'email', u.email,
                                  'contact_name', c.contact_name, 'method', c.method, 'status', c.status,
                                  'auto', c.decided_by is null, 'admin_note', c.admin_note) as t, c.decided_at
          from public.place_claims c join public.places p on p.id = c.place_id join auth.users u on u.id = c.user_id
         where c.status in ('zatwierdzone','odrzucone') order by c.decided_at desc limit 30) s), '[]'::jsonb),
    'owners', coalesce((select jsonb_agg(jsonb_build_object(
        'place_id', o.place_id, 'place_name', p.name, 'place_slug', p.slug, 'city', p.city, 'user_id', o.user_id,
        'email', u.email, 'name', o.contact_name, 'role', o.role, 'method', o.method, 'since', o.created_at,
        'suspended', o.suspended_at is not null, 'verified', p.verified)
        order by lower(p.name), o.created_at)
        from public.place_owners o join public.places p on p.id = o.place_id join auth.users u on u.id = o.user_id), '[]'::jsonb),
    'plus', coalesce((select jsonb_agg(jsonb_build_object(
        'place_name', p.name, 'place_slug', p.slug, 'city', p.city, 'email', i.contact_email, 'note', i.note, 'created_at', i.created_at)
        order by i.created_at desc)
        from public.place_plus_interest i join public.places p on p.id = i.place_id), '[]'::jsonb));
end;
$$;

-- Licznik w menu: zgłoszenia do decyzji + sprzeciwy + zdjęcia w opiniach
create or replace function public.admin_stage5_counts()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select case when not public.is_admin() then jsonb_build_object('claims', 0, 'photos', 0)
         else jsonb_build_object(
           'claims', (select count(*) from public.place_claims where status = 'oczekuje_admina')
                   + (select count(*) from public.place_takeover_events where objected_at is not null and resolved_at is null),
           'photos', (select count(*) from public.place_review_photos where status = 'oczekuje')) end;
$$;

-- ---------- UPRAWNIENIA --------------------------------------------------

-- wewnętrzne
revoke all on function public._grant_ownership(bigint, uuid, text, text, text, bigint, boolean, jsonb) from public, anon, authenticated;
revoke all on function public._takeover_recipients(bigint, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._restore_place_snapshot(bigint) from public, anon, authenticated;

-- tylko serwer (klucz serwisowy)
revoke all on function public.claim_ip_hit(text) from public, anon, authenticated;
revoke all on function public.apply_due_place_changes() from public, anon, authenticated;
revoke all on function public.takeover_pending_notices() from public, anon, authenticated;
revoke all on function public.takeover_mark_notified(bigint[], bigint[]) from public, anon, authenticated;
revoke all on function public.takeover_event_info(text) from public, anon, authenticated;
revoke all on function public.takeover_object(text, text) from public, anon, authenticated;
grant execute on function public.claim_ip_hit(text) to service_role;
grant execute on function public.apply_due_place_changes() to service_role;
grant execute on function public.takeover_pending_notices() to service_role;
grant execute on function public.takeover_mark_notified(bigint[], bigint[]) to service_role;
grant execute on function public.takeover_event_info(text) to service_role;
grant execute on function public.takeover_object(text, text) to service_role;

-- admin
revoke all on function public.admin_resolve_takeover(bigint, boolean, text) from public, anon;
grant execute on function public.admin_resolve_takeover(bigint, boolean, text) to authenticated;

-- ponownie zdefiniowane funkcje (te same podpisy, ale dla pewności)
revoke all on function public.claim_issue_code(bigint, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_issue_code(bigint, uuid, text, text, text) to service_role;
revoke all on function public.verify_place_claim(bigint, text) from public, anon;
revoke all on function public.submit_manual_claim(bigint, text, text) from public, anon;
revoke all on function public.decide_place_claim(bigint, boolean, text, boolean) from public, anon;
revoke all on function public.start_place_claim(bigint, text, text, text, boolean) from public, anon;
revoke all on function public.owner_update_place(bigint, text, text, text, text, text, text, text, text[], text[]) from public, anon;
revoke all on function public.owner_my_places() from public, anon;
revoke all on function public.owner_dashboard(text) from public, anon;
revoke all on function public.admin_claims_overview() from public, anon;
revoke all on function public.admin_stage5_counts() from public, anon;
grant execute on function public.verify_place_claim(bigint, text) to authenticated;
grant execute on function public.submit_manual_claim(bigint, text, text) to authenticated;
grant execute on function public.decide_place_claim(bigint, boolean, text, boolean) to authenticated;
grant execute on function public.start_place_claim(bigint, text, text, text, boolean) to authenticated;
grant execute on function public.owner_update_place(bigint, text, text, text, text, text, text, text, text[], text[]) to authenticated;
grant execute on function public.owner_my_places() to authenticated;
grant execute on function public.owner_dashboard(text) to authenticated;
grant execute on function public.admin_claims_overview() to authenticated;
grant execute on function public.admin_stage5_counts() to authenticated;

revoke all on function public.is_place_owner(bigint) from public;
revoke all on function public.place_has_owner(bigint) from public;
grant execute on function public.is_place_owner(bigint) to anon, authenticated;
grant execute on function public.place_has_owner(bigint) to anon, authenticated;
