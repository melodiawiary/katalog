// TYLKO NA SERWERZE. Klient Supabase z kluczem serwisowym (omija RLS).
// Potrzebny tam, gdzie nikt nie jest zalogowany: powiadomienie o płatności z Przelewy24,
// e-mail z potwierdzeniem zamówienia, automat "Produkt znów dostępny".
// Klucz: Supabase -> Project Settings -> API Keys -> secret (albo legacy "service_role"),
// zmienna na Vercelu: SUPABASE_SERVICE_ROLE_KEY. Nigdy nie z przedrostkiem NEXT_PUBLIC_.
import { createClient } from '@supabase/supabase-js';

let cached;

export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cached;
}

export function hasServiceKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
}
