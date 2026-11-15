-- Etap 10: kategorie miejsc "transport" (Transport zwierząt) i "fotograf" (Fotografia zwierząt) w tym samym systemie co pozostałe kategorie.
-- Dodaje rodzaje i kategorie do ograniczeń, słowniki usług (rodzaj transportu, rodzaj sesji) i udogodnień oraz zgłoszenia.
-- Bezpieczne do ponownego uruchomienia (nie kasuje danych). Wymaga wcześniejszych 17_trenerzy_petsitterzy.sql i 18_spacerowicze.sql.

-- ---------- KATEGORIE I RODZAJE -------------------------------------------

alter table public.places drop constraint if exists places_category_ck;
alter table public.places add constraint places_category_ck check (category in ('groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz','transport','fotograf'));

alter table public.places drop constraint if exists places_kind_ck;
alter table public.places add constraint places_kind_ck check (kind in ('salon','mobilny','domowy','gabinet','hotel','trener','szkola','petsitter','behawiorysta','spacerowicz','grupowy','przewoznik','taxi','fotograf','studio'));

alter table public.places drop constraint if exists places_category_kind_ck;
alter table public.places add constraint places_category_kind_ck check (
     (category = 'groomer'    and kind in ('salon','mobilny','domowy'))
  or (category = 'weterynarz' and kind in ('gabinet','mobilny'))
  or (category = 'hotel'      and kind in ('hotel','domowy'))
  or (category = 'trener'     and kind in ('trener','szkola','mobilny'))
  or (category = 'petsitter'  and kind in ('petsitter','domowy'))
  or (category = 'behawiorysta' and kind in ('behawiorysta','mobilny'))
  or (category = 'spacerowicz' and kind in ('spacerowicz','grupowy'))
  or (category = 'transport'  and kind in ('przewoznik','taxi'))
  or (category = 'fotograf'   and kind in ('fotograf','studio')));

alter table public.place_requests drop constraint if exists place_requests_category_ck;
alter table public.place_requests add constraint place_requests_category_ck check (category in ('groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz','transport','fotograf'));

-- ---------- SŁOWNIKI USŁUG I UDOGODNIEŃ -----------------------------------

update public.feature_defs set categories = array['groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz','transport','fotograf']::text[]
 where code in ('rezerwacja-online');
update public.feature_defs set categories = array['groomer','hotel','trener','petsitter','behawiorysta','spacerowicz','fotograf']::text[]
 where code in ('szczeniaki');
update public.feature_defs set categories = array['groomer','hotel','trener','petsitter','behawiorysta','spacerowicz','transport','fotograf']::text[]
 where code in ('trudne-zwierzeta');
update public.feature_defs set categories = array['groomer','hotel','petsitter','spacerowicz','transport']::text[]
 where code in ('duze-rasy');

insert into public.service_defs (code, label, sort, categories) values
  ('trp_miasto',        'Przewóz po mieście',                    800, array['transport']),
  ('trp_kraj',          'Przewóz po kraju',                      810, array['transport']),
  ('trp_zagranica',     'Przewóz za granicę',                    820, array['transport']),
  ('trp_wet',           'Dowóz do weterynarza lub groomera',     830, array['transport']),
  ('trp_lotnisko',      'Odbiór z lotniska i dworca',            840, array['transport']),
  ('trp_adopcja',       'Transport po adopcji',                  850, array['transport']),
  ('trp_wystawy',       'Przewóz na wystawy i zawody',           860, array['transport']),
  ('trp_przeprowadzka', 'Transport przy przeprowadzce',          870, array['transport']),
  ('trp_pilny',         'Transport pilny i nocny',               880, array['transport']),
  ('fot_portret',       'Sesja portretowa',                      900, array['fotograf']),
  ('fot_plener',        'Sesja w plenerze',                      910, array['fotograf']),
  ('fot_studio',        'Sesja w studiu',                        920, array['fotograf']),
  ('fot_dom',           'Sesja w domu klienta',                  930, array['fotograf']),
  ('fot_rodzinna',      'Sesja z właścicielem',                  940, array['fotograf']),
  ('fot_szczeniak',     'Sesja szczeniaka lub kociaka',          950, array['fotograf']),
  ('fot_urodziny',      'Urodziny pupila i sesje okolicznościowe', 960, array['fotograf']),
  ('fot_senior',        'Sesja pamiątkowa seniora',              970, array['fotograf']),
  ('fot_wystawa',       'Zdjęcia hodowlane i wystawowe',         980, array['fotograf']),
  ('fot_akcja',         'Zdjęcia w ruchu i w akcji',             990, array['fotograf'])
on conflict (code) do update set categories = excluded.categories;

insert into public.feature_defs (code, label, sort, categories) values
  ('trp-transporter',   'Przewóz w klatce lub transporterze',    800, array['transport']),
  ('trp-klima',         'Klimatyzowany pojazd',                  810, array['transport']),
  ('trp-dokumenty',     'Pomoc w dokumentach i paszporcie',      820, array['transport']),
  ('trp-gps',           'Śledzenie trasy na żywo',               830, array['transport']),
  ('trp-ubezpieczenie', 'Ubezpieczenie przewozu',                840, array['transport']),
  ('trp-przerwy',       'Przerwy na spacer w trasie',            850, array['transport']),
  ('trp-opiekun',       'Opiekun podróżuje ze zwierzęciem',      860, array['transport']),
  ('trp-licencja',      'Zezwolenie na transport zwierząt',      870, array['transport']),
  ('trp-calodobowo',    'Dostępny całą dobę',                    880, array['transport']),
  ('fot-studio',        'Własne studio',                         900, array['fotograf']),
  ('fot-dojazd',        'Dojazd do klienta',                     910, array['fotograf']),
  ('fot-retusz',        'Retusz i edycja zdjęć',                 920, array['fotograf']),
  ('fot-wydruki',       'Wydruki i albumy',                      930, array['fotograf']),
  ('fot-szybko',        'Zdjęcia w kilka dni',                   940, array['fotograf']),
  ('fot-lekowe',        'Praca ze zwierzętami lękowymi',         950, array['fotograf']),
  ('fot-bony',          'Bony podarunkowe',                      960, array['fotograf'])
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
          case when p_category in ('groomer','weterynarz','hotel','trener','petsitter','behawiorysta','spacerowicz','transport','fotograf') then p_category else 'groomer' end)
  returning id into v_id;
  return v_id;
end;
$$;

notify pgrst, 'reload schema';
