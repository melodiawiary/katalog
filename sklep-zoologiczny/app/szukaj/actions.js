'use server';

import { createClient } from '@/lib/supabase/server';

const text = (fd, key, max) => String(fd.get(key) ?? '').trim().slice(0, max);

// "Nie mamy? Napisz, sprowadzimy" - zapis zgłoszenia (funkcja request_product w 04_szukanie.sql)
export async function requestProduct(prev, fd) {
  if (text(fd, 'website', 100)) return { ok: true, message: 'Dziękujemy!' }; // pułapka na roboty
  const email = text(fd, 'email', 200);
  const query = text(fd, 'query', 200);
  const message = text(fd, 'message', 2000);
  if (!query && !message) return { error: 'Napisz, jakiego produktu szukasz.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Podaj poprawny adres e-mail, żebyśmy mogli odpisać.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_product', {
    p_query: query,
    p_message: message,
    p_name: text(fd, 'name', 100),
    p_email: email,
    p_phone: text(fd, 'phone', 30),
  });
  if (error) {
    if (error.code === 'P0001') return { error: error.message };
    return { error: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.' };
  }
  return { ok: true, message: `Dziękujemy! Zgłoszenie nr ${data} przyjęte. Sprawdzimy, czy możemy sprowadzić ten produkt, i odpiszemy na ${email}.` };
}
