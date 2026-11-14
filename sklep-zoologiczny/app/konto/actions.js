'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { sendLoginEmail } from '@/lib/order-mail';
import { afterLogin, requireUser, safeNext } from '@/lib/account';
import { foodDaysEstimate } from '@/lib/pets';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LOGIN_LIMIT_PER_HOUR = 5;

// ---------- LOGOWANIE ------------------------------------------------------

// Krok 1: e-mail -> wysyłamy link i kod (przez nasz Resend; gdy go nie ma - zwykły mail Supabase)
export async function sendLoginLink(prev, fd) {
  if (String(fd.get('website') || '')) return { sent: true, email: 'x' }; // pułapka na roboty
  const email = String(fd.get('email') || '').trim().toLowerCase().slice(0, 160);
  const next = safeNext(fd.get('next'));
  if (!EMAIL_RE.test(email)) return { error: 'Podaj poprawny adres e-mail.' };

  const db = serviceClient();
  if (db) {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await db.from('email_log').select('id', { count: 'exact', head: true })
      .eq('kind', 'logowanie').eq('to_email', email).gte('created_at', since);
    if ((count || 0) >= LOGIN_LIMIT_PER_HOUR) {
      return { error: 'Wysłaliśmy już kilka linków na ten adres. Sprawdź skrzynkę (także spam) albo spróbuj za godzinę.' };
    }
  }

  const settings = await getSettings();
  const site = await siteUrl(settings);

  const r = await sendLoginEmail(email, { site, next });
  if (r.ok) return { sent: true, email, next };

  if (r.unavailable) {
    // brak klucza serwisowego albo Resend: awaryjnie zwykły mail z Supabase (kod działa tak samo)
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (!error) return { sent: true, email, next };
    return { error: 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.' };
  }
  return { error: 'Nie udało się wysłać wiadomości. Sprawdź adres i spróbuj ponownie za chwilę.' };
}

// Weryfikacja: różne wersje Supabase nazywają ten typ różnie, więc próbujemy po kolei
async function verifyAny(supabase, params) {
  for (const type of ['email', 'magiclink', 'signup']) {
    const { data, error } = await supabase.auth.verifyOtp({ ...params, type });
    if (!error && data?.user) return data.user;
  }
  return null;
}

// Krok 2a: kod z e-maila
export async function verifyLoginCode(prev, fd) {
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const code = String(fd.get('code') || '').replace(/\D/g, '');
  const next = safeNext(fd.get('next'));
  if (!EMAIL_RE.test(email) || code.length < 6) return { error: 'Wpisz 6-cyfrowy kod z e-maila.', email, next, sent: true };
  const supabase = await createClient();
  const user = await verifyAny(supabase, { email, token: code });
  if (!user) return { error: 'Kod jest nieprawidłowy albo wygasł. Poproś o nowy.', email, next, sent: true };
  await afterLogin(supabase, user);
  redirect(next);
}

// Krok 2b: przycisk na stronie /auth/potwierdz (link z e-maila; dopiero kliknięcie zużywa link)
export async function confirmLoginLink(prev, fd) {
  const tokenHash = String(fd.get('token_hash') || '');
  const next = safeNext(fd.get('next'));
  if (!tokenHash) return { error: 'Link jest niepełny. Poproś o nowy.' };
  const supabase = await createClient();
  const user = await verifyAny(supabase, { token_hash: tokenHash });
  if (!user) return { error: 'Link wygasł albo został już użyty. Poproś o nowy.' };
  await afterLogin(supabase, user);
  redirect(next);
}

export async function signOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

// ---------- DANE ------------------------------------------------------------

export async function saveProfile(prev, fd) {
  const { supabase, user } = await requireUser('/konto/dane');
  const phone = String(fd.get('phone') || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (phone && !/^(48)?\d{9}$/.test(digits)) return { error: 'Telefon: 9 cyfr, np. 600 100 200.' };
  const shipping = fd.get('shipping_method') === 'kurier' ? 'kurier' : 'paczkomat';
  const postal = String(fd.get('postal_code') || '').trim();
  if (postal && !/^\d{2}-\d{3}$/.test(postal)) return { error: 'Kod pocztowy w formacie 00-000.' };
  const row = {
    user_id: user.id,
    full_name: String(fd.get('full_name') || '').trim().slice(0, 120),
    phone: phone.slice(0, 30),
    shipping_method: shipping,
    address: String(fd.get('address') || '').trim().slice(0, 200),
    postal_code: postal,
    city: String(fd.get('city') || '').trim().slice(0, 80),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('customer_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) return { error: 'Nie udało się zapisać. Spróbuj ponownie.' };
  revalidatePath('/konto/dane');
  return { ok: 'Zapisano.' };
}

export async function setRemindersEnabled(fd) {
  const { supabase, user } = await requireUser('/konto/przypomnienia');
  const on = fd.get('enabled') === '1';
  await supabase.from('customer_profiles').upsert(
    { user_id: user.id, reminders_enabled: on, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  revalidatePath('/konto/przypomnienia');
  revalidatePath('/konto/dane');
}

// Usunięcie konta: znikają profil, zwierzęta, przypomnienia i opinie; zamówienia zostają (księgowość), bez powiązania z kontem
export async function deleteAccount(fd) {
  const { supabase, user } = await requireUser('/konto/dane');
  if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'USUŃ') return;
  const db = serviceClient();
  if (!db) return;
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return;
  await supabase.auth.signOut();
  redirect('/?konto=usuniete');
}

// ---------- ZWIERZĘTA ------------------------------------------------------

export async function savePet(prev, fd) {
  const { supabase, user } = await requireUser('/konto/zwierzeta');
  const id = Number(fd.get('id')) || null;
  const name = String(fd.get('name') || '').trim().slice(0, 60);
  if (!name) return { error: 'Podaj imię zwierzaka.' };
  const species = ['pies', 'kot', 'inne'].includes(fd.get('species')) ? fd.get('species') : 'pies';
  const weightRaw = String(fd.get('weight_kg') || '').trim().replace(',', '.');
  const weight = weightRaw === '' ? null : Number(weightRaw);
  if (weight != null && !(weight > 0 && weight <= 120)) return { error: 'Waga: liczba kilogramów, np. 12,5.' };
  const birth = String(fd.get('birth_date') || '').trim() || null;
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return { error: 'Data urodzenia: wybierz z kalendarza.' };
  const row = {
    name,
    species,
    breed: String(fd.get('breed') || '').trim().slice(0, 80),
    birth_date: birth,
    weight_kg: weight,
    notes: String(fd.get('notes') || '').trim().slice(0, 500),
  };
  const q = id
    ? supabase.from('pets').update(row).eq('id', id)
    : supabase.from('pets').insert({ ...row, user_id: user.id });
  const { error } = await q;
  if (error) return { error: error.message?.includes('do 10') ? error.message : 'Nie udało się zapisać (sprawdź datę urodzenia i wagę).' };
  revalidatePath('/konto/zwierzeta');
  return { ok: id ? 'Zapisano zmiany.' : `Dodano: ${name}.`, at: Date.now() };
}

export async function deletePet(fd) {
  const { supabase } = await requireUser('/konto/zwierzeta');
  await supabase.from('pets').delete().eq('id', Number(fd.get('id')));
  revalidatePath('/konto/zwierzeta');
}

// ---------- PRZYPOMNIENIA O KARMIE ------------------------------------------

// Dzień ostatniego zakupu tego wariantu (od niego liczymy, na ile starcza opakowanie)
async function lastPurchaseDate(supabase, variantId) {
  const { data } = await supabase.from('order_items')
    .select('orders!inner(created_at, status)').eq('variant_id', variantId).neq('orders.status', 'anulowane');
  const times = (data || []).map((r) => new Date(r.orders.created_at).getTime()).filter(Boolean);
  if (!times.length) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date(Math.max(...times)));
}

export async function saveReminder(prev, fd) {
  const { supabase, user } = await requireUser('/konto/przypomnienia');
  const variantId = Number(fd.get('variant_id'));
  if (!variantId) return { error: 'Wybierz produkt.' };
  const petId = Number(fd.get('pet_id')) || null;

  const { data: variant } = await supabase.from('product_variants')
    .select('id, unit, net_quantity').eq('id', variantId).maybeSingle();
  if (!variant) return { error: 'Ten produkt nie jest już dostępny w sklepie.' };

  let days = Number(String(fd.get('interval_days') || '').trim());
  let estimated = false;
  if (!days) {
    let pet = null;
    if (petId) ({ data: pet } = await supabase.from('pets').select('species, weight_kg').eq('id', petId).maybeSingle());
    const est = pet && variant.unit === 'kg' ? foodDaysEstimate(pet.species, pet.weight_kg, variant.net_quantity) : null;
    days = est || 30;
    estimated = Boolean(est);
  }
  if (!Number.isInteger(days) || days < 7 || days > 365) return { error: 'Liczba dni: od 7 do 365.' };

  const anchor = await lastPurchaseDate(supabase, variantId);
  const row = { user_id: user.id, variant_id: variantId, pet_id: petId, interval_days: days, active: true, last_sent_at: null };
  if (anchor) row.anchor_date = anchor;
  const { error } = await supabase.from('reminders').upsert(row, { onConflict: 'user_id,variant_id' });
  if (error) return { error: error.message?.includes('do 30') ? error.message : 'Nie udało się zapisać przypomnienia.' };
  await supabase.from('customer_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  revalidatePath('/konto/przypomnienia');
  return {
    ok: estimated
      ? `Dodano. Orientacyjnie opakowanie starczy na ok. ${days} dni (liczone dla karmy suchej i wagi zwierzaka). Możesz to zmienić na liście.`
      : `Dodano. Przypomnimy na kilka dni przed końcem opakowania (${days} dni od zakupu).`,
    at: Date.now(),
  };
}

export async function updateReminder(fd) {
  const { supabase } = await requireUser('/konto/przypomnienia');
  const id = Number(fd.get('id'));
  const op = String(fd.get('op') || '');
  if (op === 'delete') {
    await supabase.from('reminders').delete().eq('id', id);
  } else if (op === 'pause' || op === 'resume') {
    await supabase.from('reminders').update({ active: op === 'resume' }).eq('id', id);
  } else if (op === 'days') {
    const days = Number(fd.get('interval_days'));
    if (Number.isInteger(days) && days >= 7 && days <= 365) await supabase.from('reminders').update({ interval_days: days, last_sent_at: null }).eq('id', id);
  } else if (op === 'bought') {
    // "Kupiłem w innym miejscu / właśnie otworzyłem nowe": liczymy od dziś
    await supabase.from('reminders').update({
      anchor_date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date()), last_sent_at: null,
    }).eq('id', id);
  }
  revalidatePath('/konto/przypomnienia');
}

// ---------- ZAMÓW PONOWNIE --------------------------------------------------

const idsOf = (list) => [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))];

// Pozycje starego zamówienia w kształcie koszyka, z aktualnymi cenami i stanami
export async function reorderItems(orderId) {
  const { supabase } = await requireUser('/konto/zamowienia');
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) return { items: [], skipped: [] };
  const { data: lines } = await supabase.from('order_items')
    .select('variant_id, quantity, product_name, variant_name').eq('order_id', orderId);
  if (!lines?.length) return { items: [], skipped: [] };

  const variantIds = idsOf(lines.filter((l) => l.variant_id).map((l) => l.variant_id));
  const { data: variants } = variantIds.length
    ? await supabase.from('product_variants')
        .select('id, product_id, name, stock, effective_price, products(name, slug, image_url)').in('id', variantIds)
    : { data: [] };
  const byId = new Map((variants || []).map((v) => [v.id, v]));
  const productIds = idsOf((variants || []).map((v) => v.product_id));
  const { data: siblings } = productIds.length
    ? await supabase.from('product_variants').select('product_id').in('product_id', productIds)
    : { data: [] };
  const count = new Map();
  for (const s of siblings || []) count.set(s.product_id, (count.get(s.product_id) || 0) + 1);

  const items = [];
  const skipped = [];
  for (const l of lines) {
    const label = `${l.product_name}${l.variant_name ? ` (${l.variant_name})` : ''}`;
    const v = l.variant_id ? byId.get(l.variant_id) : null;
    if (!v || v.stock < 1) { skipped.push(label); continue; }
    const multi = (count.get(v.product_id) || 1) > 1;
    const quantity = Math.min(l.quantity, v.stock, 99);
    if (quantity < l.quantity) skipped.push(`${label} (tylko ${quantity} z ${l.quantity} szt.)`);
    items.push({
      key: multi ? `v:${v.id}` : `p:${v.product_id}`,
      product_id: v.product_id,
      variant_id: v.id,
      name: v.products?.name || l.product_name,
      variant_name: multi ? v.name : '',
      slug: v.products?.slug,
      price: Number(v.effective_price),
      image_url: v.products?.image_url || null,
      stock: v.stock,
      quantity,
    });
  }
  return { items, skipped };
}
