'use server';

import { createClient } from '@/lib/supabase/server';

const text = (fd, key, max) => String(fd.get(key) ?? '').trim().slice(0, max);

// "Poleć salon", "Zgłoś zmianę", "Usuń mój salon" (funkcja submit_place_request w 09_miejsca.sql)
export async function submitPlaceRequest(prev, fd) {
  if (text(fd, 'website', 100)) return { ok: true, message: 'Dziękujemy!' }; // pułapka na roboty
  const kind = text(fd, 'kind', 20);
  const email = text(fd, 'email', 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Podaj poprawny adres e-mail, żebyśmy mogli odpisać.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_place_request', {
    p_kind: kind,
    p_place_id: Number(fd.get('place_id')) || null,
    p_name: text(fd, 'place_name', 120),
    p_city: text(fd, 'city', 80),
    p_details: text(fd, 'details', 2000),
    p_email: email,
    p_contact_name: text(fd, 'contact_name', 100),
    p_phone: text(fd, 'phone', 30),
  });
  if (error) {
    if (error.code === 'P0001') return { error: error.message };
    return { error: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.' };
  }
  const what = kind === 'polecenie' ? 'Sprawdzimy salon i dodamy go do katalogu' : kind === 'usuniecie' ? 'Zweryfikujemy prośbę i usuniemy wpis' : 'Sprawdzimy i poprawimy dane';
  return { ok: true, message: `Dziękujemy! Zgłoszenie nr ${data} przyjęte. ${what}, a odpowiedź wyślemy na ${email}.` };
}
