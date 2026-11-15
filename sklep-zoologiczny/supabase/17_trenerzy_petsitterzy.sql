-- Etap 8 (obejmuje też dopuszczenie kategorii spacerowicz, jej słowniki dodaje 18_spacerowicze.sql): kategorie miejsc "trener", "petsitter" i "behawiorysta" w tym samym systemie co groomerzy, weterynarze i hotele.
-- Dodaje rodzaje i kategorie do ograniczeń, słowniki usług i udogodnień oraz zgłoszenia z nowymi kategoriami.
-- Bezpieczne do ponownego uruchomienia (nie kasuje danych). Wymaga wcześniejszego 16_kategorie_miejsc.sql.

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

update public.feature_defs set categories = array['groomer','weterynarz','hotel','trener','petsitter','behawiorysta']::text[]
 where code in ('rezerwacja-online','karta','parking');
update public.feature_defs set categories = array['groomer','hotel','trener','petsitter','behawiorysta']::text[]
 where code in ('szczeniaki','trudne-zwierzeta');
update public.feature_defs set categories = array['groomer','hotel','petsitter']::text[]
 where code in ('duze-rasy');

insert into public.service_defs (code, label, sort, categories) values
  ('trn_posluszenstwo', 'Posłuszeństwo podstawowe',              400, array['trener']),
  ('trn_szczeniaki',    'Szkolenie szczeniąt',                   410, array['trener']),
  ('trn_zaawansowane',  'Szkolenie zaawansowane',                420, array['trener']),
  ('trn_problemy',      'Praca nad trudnymi zachowaniami',       430, array['trener']),
  ('trn_indywidualne',  'Lekcje indywidualne',                   440, array['trener']),
  ('trn_grupowe',       'Zajęcia grupowe',                       450, array['trener']),
  ('trn_kot',           'Trening kotów',                         460, array['trener']),
  ('trn_sporty',        'Agility i sporty psie',                 470, array['trener']),
  ('trn_dojazd',        'Szkolenie u klienta w domu',            480, array['trener']),
  ('beh_konsultacja',  'Konsultacja behawioralna',              600, array['behawiorysta']),
  ('beh_terapia',      'Terapia zachowań',                      610, array['behawiorysta']),
  ('beh_lek',          'Lęk separacyjny i fobie',               620, array['behawiorysta']),
  ('beh_agresja',      'Agresja i reaktywność',                 630, array['behawiorysta']),
  ('beh_szczeniak',    'Konsultacja dla szczeniąt',             640, array['behawiorysta']),
  ('beh_kot',          'Behawiorysta kotów',                    650, array['behawiorysta']),
  ('beh_online',       'Konsultacja online',                    660, array['behawiorysta']),
  ('beh_dom',          'Wizyta w domu klienta',                 670, array['behawiorysta']),
  ('beh_adopcja',      'Wsparcie po adopcji',                   680, array['behawiorysta']),
  ('pet_dom_klienta',   'Opieka w domu klienta',                 500, array['petsitter']),
  ('pet_u_opiekuna',    'Opieka u opiekuna (nocleg)',            510, array['petsitter']),
  ('pet_wizyta',        'Wizyta w domu: karmienie i zabawa',     520, array['petsitter']),
  ('pet_spacer',        'Spacer z psem',                         530, array['petsitter']),
  ('pet_leki',          'Podawanie leków',                       540, array['petsitter']),
  ('pet_transport',     'Odbiór i dowóz zwierzęcia',             550, array['petsitter']),
  ('pet_dlugi',         'Opieka długoterminowa (urlop)',         560, array['petsitter'])
on conflict (code) do update set categories = excluded.categories;

insert into public.feature_defs (code, label, sort, categories) values
  ('trn-pozytywne',     'Metody pozytywne',                      400, array['trener']),
  ('trn-clicker',       'Trening z klikerem',                    410, array['trener']),
  ('trn-egzaminy',      'Przygotowanie do egzaminów i testów',   420, array['trener']),
  ('trn-teren',         'Teren do ćwiczeń',                      430, array['trener']),
  ('trn-dojazd',        'Dojazd do klienta',                     440, array['trener']),
  ('trn-certyfikat',    'Certyfikaty i kursy trenera',           450, array['trener']),
  ('beh-online',       'Konsultacje online',                    600, array['behawiorysta']),
  ('beh-dojazd',       'Dojazd do klienta',                     610, array['behawiorysta']),
  ('beh-certyfikat',   'Certyfikaty i wykształcenie',           620, array['behawiorysta']),
  ('beh-lekarz',       'Współpraca z weterynarzem',             630, array['behawiorysta']),
  ('beh-pozytywne',    'Metody pozytywne',                      640, array['behawiorysta']),
  ('beh-plan',         'Pisemny plan terapii',                  650, array['behawiorysta']),
  ('ps-ogrod',          'Ogrodzony ogród',                       500, array['petsitter']),
  ('ps-bez-dzieci',     'Spokojny dom bez małych dzieci',        510, array['petsitter']),
  ('ps-aktualizacje',   'Zdjęcia i wieści z opieki',             520, array['petsitter']),
  ('ps-leki',           'Podaje leki',                           530, array['petsitter']),
  ('ps-doswiadczenie',  'Doświadczenie z seniorami i chorymi',   540, array['petsitter']),
  ('ps-ubezpieczenie',  'Ubezpieczenie opiekuna',                550, array['petsitter'])
on conflict (code) do update set categories = excluded.categories;

-- ---------- ZGŁOSZENIA Z NOWYMI KATEGORIAMI -------------------------------

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
