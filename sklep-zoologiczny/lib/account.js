// TYLKO NA SERWERZE. Pomocnicze funkcje konta klienta.
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';

// Zalogowany klient (raz na żądanie, nawet gdy wołają layout i strona)
export const currentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user: user || null };
});

export async function requireUser(next = '/konto') {
  const { supabase, user } = await currentUser();
  if (!user) redirect(`/konto/logowanie?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

// Dozwolone są tylko adresy w obrębie sklepu (zabezpieczenie przed przekierowaniem na obcą stronę)
export function safeNext(value, fallback = '/konto') {
  const n = String(value || '');
  if (!n.startsWith('/') || n.startsWith('//') || n.startsWith('/\\')) return fallback;
  return n.slice(0, 300);
}

// Po zalogowaniu: dopięcie wcześniejszych zamówień z tym e-mailem i pusty profil (do zapisania danych)
export async function afterLogin(supabase, user) {
  try { await supabase.rpc('claim_orders'); } catch { /* nie blokuje logowania */ }
  try {
    await supabase.from('customer_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  } catch { /* profil powstanie przy pierwszym zapisie */ }
}

// Czy w Supabase jest włączone logowanie przez Google (publiczny adres ustawień). Wynik na minutę w pamięci.
let googleCache = { at: 0, value: false };
export async function googleEnabled() {
  if (Date.now() - googleCache.at < 60000) return googleCache.value;
  let value = false;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      cache: 'no-store',
    });
    if (res.ok) value = Boolean((await res.json())?.external?.google);
  } catch { /* bez Google */ }
  googleCache = { at: Date.now(), value };
  return value;
}

export { serviceClient };
