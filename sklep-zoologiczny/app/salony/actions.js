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

const stars = (fd, key) => {
  const n = Number(fd.get(key));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

// Dodanie / zmiana opinii o salonie (funkcja submit_place_review w 11_opinie_salonow.sql)
export async function submitPlaceReview(prev, fd) {
  const place = Number(fd.get('place_id'));
  const quality = stars(fd, 'r_quality');
  if (!Number.isInteger(place) || place < 1) return { error: 'Nie znaleziono salonu.' };
  if (!quality) return { error: 'Oceń jakość usługi (1-5 gwiazdek).' };
  const paidRaw = text(fd, 'paid_amount', 12).replace(',', '.');
  const paid = paidRaw === '' ? null : Number(paidRaw);
  if (paid != null && !Number.isFinite(paid)) return { error: 'Zapłacona kwota: wpisz liczbę albo zostaw puste.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_place_review', {
    p_place: place,
    p_quality: quality,
    p_care: stars(fd, 'r_care'),
    p_clean: stars(fd, 'r_clean'),
    p_price: stars(fd, 'r_price'),
    p_body: text(fd, 'body', 2000),
    p_service: text(fd, 'service', 40) || null,
    p_size: text(fd, 'size_class', 20) || null,
    p_paid: paid,
  });
  if (error) return { error: error.code === 'P0001' ? error.message : 'Nie udało się zapisać opinii. Spróbuj ponownie.' };
  return {
    ok: data === 'oczekuje' ? 'Dziękujemy! Opinia pojawi się po sprawdzeniu przez nas.' : 'Dziękujemy za opinię!',
    at: Date.now(),
  };
}

// Zgłoszenie nadużycia pod opinią (funkcja report_place_review)
export async function reportPlaceReview(prev, fd) {
  if (text(fd, 'website', 100)) return { ok: true }; // pułapka na roboty
  const supabase = await createClient();
  const { error } = await supabase.rpc('report_place_review', {
    p_review: Number(fd.get('review_id')),
    p_reason: text(fd, 'reason', 500),
    p_email: text(fd, 'email', 200),
  });
  if (error) return { error: error.code === 'P0001' ? error.message : 'Nie udało się wysłać zgłoszenia.' };
  return { ok: true };
}

// Ulubiony salon: dodaj / usuń (funkcja toggle_favorite_place)
export async function toggleFavoritePlace(placeId) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('toggle_favorite_place', { p_place: Number(placeId) });
  if (error) return { error: error.message };
  return { ok: true, favorite: data === true };
}

// Zapis na listę chętnych na Akademię (funkcja join_academy)
export async function joinAcademy(prev, fd) {
  if (text(fd, 'website', 100)) return { ok: true, message: 'Dziękujemy!' }; // pułapka na roboty
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_academy', {
    p_email: text(fd, 'email', 200),
    p_interest: text(fd, 'interest', 20),
    p_consent: fd.get('consent') === 'on',
  });
  if (error) return { error: error.code === 'P0001' ? error.message : 'Nie udało się zapisać. Spróbuj ponownie za chwilę.' };
  return { ok: true, message: data === 'juz' ? 'Ten adres jest już na liście. Zapisaliśmy Twoje zainteresowanie.' : 'Dziękujemy! Damy znać, gdy ruszą kursy.' };
}
