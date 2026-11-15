-- Etap 9: kategoria miejsc "spacerowicz" (Spacery z psami) w tym samym systemie co pozostałe kategorie.
-- Dodaje rodzaje i kategorię do ograniczeń, słowniki usług (rodzaj spaceru) i udogodnień (czas spaceru, wielkość psa) oraz zgłoszenia.
-- Bezpieczne do ponownego uruchomienia (nie kasuje danych). Wymaga wcześniejszego 17_trenerzy_petsitterzy.sql.

-- ---------- KATEGORIE I RODZAJE -------------------------------------------

alter table public.places drop constraint if exists places_category_ck;
alter table public.places add constraint places_category_ck check (category in ('groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz'));

alter table public.places drop constraint if exists places_kind_ck;
alter table public.places add constraint places_kind_ck check (kind in ('salon','mobilny','domowy','gabinet','hotel','trener','szkola','petsitter','behawiorysta','spacerowicz','grupowy'));

alter table public.places drop constraint if exists places_category_kind_ck;
alter table public.places add constraint places_category_kind_ck check (
     (category = 'groomer'    and kind in ('salon','mobilny','domowy'))
  or (category = 'weterynarz' and kind in ('gabinet','mobilny'))
  or (category = 'hotel'      and kind in ('hotel','domowy'))
  or (category = 'trener'     and kind in ('trener','szkola','mobilny'))
  or (category = 'petsitter'  and kind in ('petsitter','domowy'))
  or (category = 'behawiorysta' and kind in ('behawiorysta','mobilny'))
  or (category = 'spacerowicz' and kind in ('spacerowicz','grupowy')));

alter table public.place_requests drop constraint if exists place_requests_category_ck;
alter table public.place_requests add constraint place_requests_category_ck check (category in ('groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz'));

-- ---------- SŁOWNIKI USŁUG I UDOGODNIEŃ -----------------------------------

update public.feature_defs set categories = array['groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz']::text[]
 where code in ('rezerwacja-online');
update public.feature_defs set categories = array['groomer','hotel','trener','petsitter','behawiorysta','spacerowicz']::text[]
 where code in ('szczeniaki','trudne-zwierzeta');
update public.feature_defs set categories = array['groomer','hotel','petsitter','spacerowicz']::text[]
 where code in ('duze-rasy');

insert into public.service_defs (code, label, sort, categories) values
  ('spc_indywidualny', 'Spacer indywidualny',                    700, array['spacerowicz']),
  ('spc_grupowy',      'Spacer w małej grupie',                  710, array['spacerowicz']),
  ('spc_bieganie',     'Bieganie i jogging z psem',              720, array['spacerowicz']),
  ('spc_wycieczka',    'Wycieczka i trekking z psem',            730, array['spacerowicz']),
  ('spc_trening',      'Spacer z elementami treningu',           740, array['spacerowicz']),
  ('spc_senior',       'Spokojny spacer dla seniorów',           750, array['spacerowicz']),
  ('spc_szczeniak',    'Spacer ze szczeniakiem',                 760, array['spacerowicz']),
  ('spc_odbior',       'Spacer z odbiorem i odprowadzeniem do domu', 770, array['spacerowicz'])
on conflict (code) do update set categories = excluded.categories;

insert into public.feature_defs (code, label, sort, categories) values
  ('spc-czas-30',      'Spacery 30 minut',                       700, array['spacerowicz']),
  ('spc-czas-60',      'Spacery 60 minut',                       710, array['spacerowicz']),
  ('spc-czas-90',      'Spacery 90 minut i dłużej',              720, array['spacerowicz']),
  ('spc-psy-male',     'Małe psy',                               730, array['spacerowicz']),
  ('spc-psy-srednie',  'Średnie psy',                            740, array['spacerowicz']),
  ('spc-psy-duze',     'Duże psy',                               750, array['spacerowicz']),
  ('spc-gps',          'Trasa spaceru na mapie (GPS)',           760, array['spacerowicz']),
  ('spc-zdjecia',      'Zdjęcia i raport ze spaceru',            770, array['spacerowicz']),
  ('spc-male-grupy',   'Małe grupy (do 4 psów)',                 780, array['spacerowicz']),
  ('spc-ogrodzony',    'Ogrodzony teren do biegania',            790, array['spacerowicz']),
  ('spc-ubezpieczenie','Ubezpieczenie opiekuna',                 800, array['spacerowicz'])
on conflict (code) do update set categories = excluded.categories;

-- ---------- ZGŁOSZENIA Z NOWĄ KATEGORIĄ -----------------------------------

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
          case when p_category in ('groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz') then p_category else 'groomer' end)
  returning id into v_id;
  return v_id;
end;
$$;

notify pgrst, 'reload schema';
