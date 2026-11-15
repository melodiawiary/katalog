-- 12_poczta_gmail.sql - wysylka e-maili przez SMTP Gmaila (do czasu wlasnej domeny w Resend)
-- Mozna uruchomic ponownie. Kolumny sa w tabeli integrations (widzi ja tylko administrator).
alter table public.integrations add column if not exists gmail_user text not null default '';
alter table public.integrations add column if not exists gmail_app_password text not null default '';

-- shop_features(): "email" = jest jakikolwiek sposob wysylki (Resend albo Gmail)
create or replace function public.shop_features()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'p24', coalesce(i.p24_enabled
                    and i.p24_merchant_id ~ '^\d+$'
                    and i.p24_crc <> '' and i.p24_api_key <> '', false),
    'p24_sandbox', coalesce(i.p24_sandbox, true),
    'geowidget_token', coalesce(i.inpost_geowidget_token, ''),
    'email', coalesce(i.resend_api_key <> '' or (i.gmail_user <> '' and i.gmail_app_password <> ''), false)
  )
  from (select 1) x left join public.integrations i on i.id = 1;
$$;
revoke all on function public.shop_features() from public;
grant execute on function public.shop_features() to anon, authenticated;
