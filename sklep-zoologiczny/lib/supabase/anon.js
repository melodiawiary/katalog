// Klient Supabase BEZ ciasteczek (rola anon). Do stron publicznych z pamięcią podręczną (np. strona miasta),
// gdzie nie wolno czytać sesji użytkownika (inaczej strona byłaby zawsze dynamiczna).
import { createClient } from '@supabase/supabase-js';

export function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
