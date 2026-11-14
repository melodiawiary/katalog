-- Etap 3: próg włączenia katalogu liczony dla miasta, nie dla całej bazy.
-- Katalog można włączyć, gdy co najmniej w jednym mieście jest min_published
-- (domyślnie 5) opublikowanych salonów. Małe miasta z mniejszą liczbą salonów
-- otwiera admin ręcznie po przeglądzie (kolejny krok: otwieranie miast osobno).
-- Bezpieczne do ponownego uruchomienia.

alter table public.places_config alter column min_published set default 5;
update public.places_config set min_published = 5 where min_published = 20;

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
    select coalesce(max(c), 0) into v_n
    from (
      select count(*) as c
      from public.places
      where status = 'opublikowany' and city is not null
      group by lower(city)
    ) t;
    if v_n < new.min_published then
      raise exception 'Katalog można włączyć, gdy w jednym mieście jest co najmniej % opublikowanych miejsc (najwięcej w jednym mieście: %).',
        new.min_published, v_n using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
