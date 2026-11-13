'use server';

import { createClient } from '@/lib/supabase/server';

// "Powiadom o dostępności" (funkcja request_stock_alert w 05_karta.sql)
export async function requestStockAlert(prev, fd) {
  if (String(fd.get('website') || '')) return { ok: true }; // pułapka na roboty
  const email = String(fd.get('email') || '').trim().slice(0, 200);
  const variant = Number(fd.get('variant_id'));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Podaj poprawny adres e-mail.' };
  if (!Number.isInteger(variant) || variant < 1) return { error: 'Wybierz wariant produktu.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_stock_alert', { p_variant: variant, p_email: email });
  if (error) {
    if (error.code === 'P0001') return { error: error.message };
    return { error: 'Nie udało się zapisać. Spróbuj ponownie za chwilę.' };
  }
  return { ok: true, already: data === 'juz', email };
}
