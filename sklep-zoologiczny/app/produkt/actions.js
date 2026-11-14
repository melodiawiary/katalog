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

// Dodanie / zmiana opinii (funkcja submit_review w 08_konto.sql sprawdza zakup)
export async function submitReview(prev, fd) {
  const product = Number(fd.get('product_id'));
  const rating = Number(fd.get('rating'));
  if (!Number.isInteger(product) || product < 1) return { error: 'Nie znaleziono produktu.' };
  if (!(rating >= 1 && rating <= 5)) return { error: 'Wybierz ocenę od 1 do 5 gwiazdek.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_review', {
    p_product: product,
    p_rating: rating,
    p_title: String(fd.get('title') || '').slice(0, 100),
    p_body: String(fd.get('body') || '').slice(0, 2000),
  });
  if (error) return { error: error.code === 'P0001' ? error.message : 'Nie udało się zapisać opinii. Spróbuj ponownie.' };
  return { ok: 'Dziękujemy za opinię!', at: Date.now() };
}
