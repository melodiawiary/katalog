'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';
import { validateHours, validatePrices, parseJsonList } from '@/lib/place-validate';

const text = (fd, key, max) => String(fd.get(key) ?? '').trim().slice(0, max);
const friendly = (error, fallback) => (error?.code === 'P0001' ? error.message : fallback);

function fixUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

function refresh(slug) {
  revalidatePath(`/konto/salon/${slug}`);
  revalidatePath(`/salony/${slug}`);
  revalidatePath('/salony');
}

export async function saveOwnerData(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const place = Number(fd.get('place_id'));
  if (!Number.isInteger(place) || place < 1) return { error: 'Nie znaleziono salonu.' };
  const vh = validateHours(parseJsonList(fd.get('hours')));
  if (vh.error) return { error: vh.error };
  const vp = validatePrices(parseJsonList(fd.get('prices')));
  if (vp.error) return { error: vp.error };

  const supabase = await createClient();
  const r1 = await supabase.rpc('owner_update_place', {
    p_place: place,
    p_description: text(fd, 'description', 3000),
    p_phone: text(fd, 'phone', 30),
    p_email: text(fd, 'email', 200),
    p_website: fixUrl(text(fd, 'website', 300)),
    p_booking_url: fixUrl(text(fd, 'booking_url', 300)),
    p_instagram: fixUrl(text(fd, 'instagram', 300)),
    p_facebook: fixUrl(text(fd, 'facebook', 300)),
    p_features: fd.getAll('features').map(String),
    p_species: fd.getAll('species').map(String),
  });
  if (r1.error) return { error: friendly(r1.error, 'Nie udało się zapisać danych. Sprawdź adresy e-mail i linki.') };
  const r2 = await supabase.rpc('owner_save_hours', { p_place: place, p_hours: vh.hours });
  if (r2.error) return { error: friendly(r2.error, 'Dane zapisane, ale godziny nie.') };
  const r3 = await supabase.rpc('owner_save_prices', { p_place: place, p_prices: vp.prices });
  if (r3.error) return { error: friendly(r3.error, 'Dane zapisane, ale cennik nie.') };
  refresh(slug);
  return { ok: 'Zapisano. Zmiany są już widoczne na stronie salonu.', at: Date.now() };
}

export async function replyToReview(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const body = text(fd, 'body', 1500);
  if (body.length < 2) return { error: 'Napisz odpowiedź.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reply_to_review', { p_review: Number(fd.get('review_id')), p_body: body });
  if (error) return { error: friendly(error, 'Nie udało się zapisać odpowiedzi.') };
  refresh(slug);
  return { ok: 'Odpowiedź zapisana.', at: Date.now() };
}

export async function deleteReply(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_review_reply', { p_review: Number(fd.get('review_id')) });
  if (error) return { error: friendly(error, 'Nie udało się usunąć odpowiedzi.') };
  refresh(slug);
  return { ok: 'Odpowiedź usunięta.', at: Date.now() };
}

export async function setNotify(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_owner_notify', { p_place: Number(fd.get('place_id')), p_on: fd.get('on') === 'on' });
  if (error) return { error: friendly(error, 'Nie udało się zapisać.') };
  refresh(slug);
  return { ok: 'Zapisano.', at: Date.now() };
}

export async function setPlus(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_plus_interest', {
    p_place: Number(fd.get('place_id')), p_on: fd.get('on') === '1', p_note: text(fd, 'note', 500),
  });
  if (error) return { error: friendly(error, 'Nie udało się zapisać.') };
  refresh(slug);
  return { ok: fd.get('on') === '1' ? 'Dziękujemy, dopisaliśmy Cię do listy. Odezwiemy się ze szczegółami Wizytówki Plus.' : 'Usunięto z listy.', at: Date.now() };
}

// Zdjęcia: pliki wgrywa przeglądarka (jak w sklepie), tu zapisujemy wpis albo usuwamy
export async function addPhotoRecord(placeId, path, caption) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('owner_add_photo', { p_place: placeId, p_path: path, p_caption: caption || '' });
  if (error) {
    const db = serviceClient();
    if (db) await db.storage.from('salony').remove([path]).catch(() => {});
    return { error: friendly(error, 'Nie udało się dodać zdjęcia.') };
  }
  return { ok: true };
}

async function removeFiles(bucket, paths) {
  if (!paths?.length) return;
  const db = serviceClient();
  if (db) await db.storage.from(bucket).remove(paths).catch(() => {});
}

export async function deletePhotoAction(slug, photoId) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('owner_delete_photo', { p_photo: photoId });
  if (error) return { error: friendly(error, 'Nie udało się usunąć zdjęcia.') };
  if (data) {
    const db = serviceClient();
    const r = await (db || supabase).storage.from('salony').remove([data]);
    void r;
  }
  refresh(slug);
  return { ok: true };
}

export async function mainPhotoAction(slug, photoId) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('owner_set_main_photo', { p_photo: photoId });
  if (error) return { error: friendly(error, 'Nie udało się ustawić zdjęcia.') };
  refresh(slug);
  return { ok: true };
}

export async function releasePlace(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('release_place', {
    p_place: Number(fd.get('place_id')), p_delete_data: fd.get('delete_data') === 'on',
  });
  if (error) return { error: friendly(error, 'Nie udało się zwolnić salonu.') };
  await removeFiles('salony', data?.photo_paths);
  await removeFiles('przejecia', data?.evidence_paths);
  refresh(slug);
  revalidatePath('/konto', 'layout');
  redirect('/konto/salon?zwolniono=1');
}
