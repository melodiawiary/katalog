// Dane do formularza miejsca (tylko serwer)
import { createClient } from '@/lib/supabase/server';

export async function loadFormRefs(supabase) {
  const [services, features] = await Promise.all([
    supabase.from('service_defs').select('code, label').order('sort'),
    supabase.from('feature_defs').select('code, label').order('sort'),
  ]);
  return { services: services.data || [], featureDefs: features.data || [], error: services.error || features.error };
}

export async function loadPlace(id) {
  const supabase = await createClient();
  const n = Number(id);
  if (!Number.isInteger(n)) return { place: null };
  const [place, hours, prices, priv, refs] = await Promise.all([
    supabase.from('places').select('*').eq('id', n).maybeSingle(),
    supabase.from('place_hours').select('weekday, opens, closes').eq('place_id', n).order('weekday').order('opens'),
    supabase.from('place_prices').select('*').eq('place_id', n).order('sort').order('id'),
    supabase.from('place_private').select('*').eq('place_id', n).maybeSingle(),
    loadFormRefs(supabase),
  ]);
  return {
    place: place.data,
    error: place.error,
    hours: (hours.data || []).map((h) => ({ weekday: h.weekday, opens: String(h.opens).slice(0, 5), closes: String(h.closes).slice(0, 5) })),
    prices: prices.data || [],
    priv: priv.data || {},
    services: refs.services,
    featureDefs: refs.featureDefs,
  };
}
