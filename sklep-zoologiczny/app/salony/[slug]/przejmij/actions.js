'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';
import { sendClaimCode, sendClaimConflict } from '@/lib/order-mail';

const text = (fd, key, max) => String(fd.get(key) ?? '').trim().slice(0, max);
const friendly = (error, fallback) => (error?.code === 'P0001' ? error.message : fallback);

async function claimInfo(supabase, slug) {
  const { data } = await supabase.rpc('place_claim_info', { p_slug: slug });
  return data;
}

// Krok 1: dane zgłaszającego, potem wysyłka kodu na adres z domeny salonu (albo znany adres salonu)
export async function startClaim(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const mode = text(fd, 'mode', 10) === 'known' ? 'known' : 'domain';
  const email = text(fd, 'email', 200);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Zaloguj się, żeby zgłosić swój salon.' };
  const info = await claimInfo(supabase, slug);
  if (!info) return { error: 'Nie znaleziono salonu.' };
  const db = serviceClient();
  if (!db) return { error: 'Wysyłka kodów jest chwilowo niedostępna. Wybierz weryfikację ręczną.' };

  if (mode === 'domain' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Podaj poprawny adres e-mail.' };

  // zgłoszenie (zostaje to samo, jeśli ktoś wraca do kroku z kodem)
  let claimId = info.claim?.status === 'nowe' ? info.claim.id : null;
  if (!claimId) {
    const { data, error } = await supabase.rpc('start_place_claim', {
      p_place: info.place.id,
      p_name: text(fd, 'name', 120),
      p_role: text(fd, 'role', 20),
      p_phone: text(fd, 'phone', 30),
      p_consent: fd.get('consent') === 'on',
    });
    if (error) return { error: friendly(error, 'Nie udało się zapisać zgłoszenia. Spróbuj ponownie.') };
    claimId = data;
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const { data: target, error: e2 } = await db.rpc('claim_issue_code', {
    p_claim: claimId, p_user: user.id, p_mode: mode, p_email: mode === 'domain' ? email : null, p_code: code,
  });
  if (e2) return { error: friendly(e2, 'Nie udało się wysłać kodu. Spróbuj ponownie za chwilę.'), claimId };
  const sent = await sendClaimCode(target, code, info.place.name);
  if (!sent.ok) return { error: 'Nie udało się wysłać e-maila z kodem. Spróbuj ponownie albo wybierz weryfikację ręczną.', claimId };
  revalidatePath(`/salony/${slug}/przejmij`);
  return { step: 'code', claimId, sentTo: info.claim?.code_hint || maskMail(target) };
}

function maskMail(m) {
  const [a, b] = String(m).split('@');
  if (!b) return '';
  return `${a.slice(0, 1)}***@${b}`;
}

// Krok 2: wpisanie kodu
export async function verifyClaim(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const claimId = Number(fd.get('claim_id'));
  if (!Number.isInteger(claimId) || claimId < 1) return { error: 'Brak zgłoszenia.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('verify_place_claim', { p_claim: claimId, p_code: text(fd, 'code', 12) });
  if (error) return { error: friendly(error, 'Nie udało się sprawdzić kodu.'), step: 'code', claimId };
  if (data === 'zly_kod') return { error: 'Zły kod. Sprawdź wiadomość i spróbuj jeszcze raz.', step: 'code', claimId };
  if (data === 'wygasl') return { error: 'Kod wygasł. Poproś o nowy.', step: 'form', claimId };
  if (data === 'za_duzo') return { error: 'Za dużo prób. Poproś o nowy kod albo wybierz weryfikację ręczną.', step: 'form', claimId };
  if (data === 'oczekuje_admina') {
    const info = await claimInfo(supabase, slug);
    if (info?.owners_count > 0) await sendClaimConflict(info.place.id, info.place.name).catch(() => {});
  }
  revalidatePath(`/salony/${slug}`);
  revalidatePath(`/salony/${slug}/przejmij`);
  revalidatePath('/konto', 'layout');
  return { done: data };
}

// Droga ręczna: zdjęcie dokumentu (już wgrane do prywatnego zasobnika) + opis
export async function submitManual(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Zaloguj się, żeby zgłosić swój salon.' };
  const info = await claimInfo(supabase, slug);
  if (!info) return { error: 'Nie znaleziono salonu.' };

  let claimId = info.claim?.status === 'nowe' ? info.claim.id : null;
  if (!claimId) {
    const { data, error } = await supabase.rpc('start_place_claim', {
      p_place: info.place.id,
      p_name: text(fd, 'name', 120),
      p_role: text(fd, 'role', 20),
      p_phone: text(fd, 'phone', 30),
      p_consent: fd.get('consent') === 'on',
    });
    if (error) return { error: friendly(error, 'Nie udało się zapisać zgłoszenia.') };
    claimId = data;
  }
  const path = text(fd, 'evidence_path', 300);
  const { error } = await supabase.rpc('submit_manual_claim', {
    p_claim: claimId, p_evidence_path: path || null, p_note: text(fd, 'note', 1500),
  });
  if (error) return { error: friendly(error, 'Nie udało się wysłać zgłoszenia.') };
  if (info.owners_count > 0) await sendClaimConflict(info.place.id, info.place.name).catch(() => {});
  revalidatePath(`/salony/${slug}/przejmij`);
  return { done: 'oczekuje_admina' };
}

// Droga ręczna, krok 0: samo zgłoszenie (bez tego nie można wgrać zdjęcia do prywatnego zasobnika)
export async function createDraft(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Zaloguj się, żeby zgłosić swój salon.' };
  const info = await claimInfo(supabase, slug);
  if (!info) return { error: 'Nie znaleziono salonu.' };
  if (info.claim?.status === 'nowe') return { draft: info.claim.id, userId: user.id };
  const { data, error } = await supabase.rpc('start_place_claim', {
    p_place: info.place.id,
    p_name: text(fd, 'name', 120),
    p_role: text(fd, 'role', 20),
    p_phone: text(fd, 'phone', 30),
    p_consent: fd.get('consent') === 'on',
  });
  if (error) return { error: friendly(error, 'Nie udało się zapisać zgłoszenia.') };
  return { draft: data, userId: user.id };
}

export async function withdrawClaim(prev, fd) {
  const slug = text(fd, 'slug', 160);
  const supabase = await createClient();
  const { error } = await supabase.rpc('withdraw_place_claim', { p_claim: Number(fd.get('claim_id')) });
  if (error) return { error: friendly(error, 'Nie udało się wycofać zgłoszenia.') };
  revalidatePath(`/salony/${slug}/przejmij`);
  return { withdrawn: true };
}
