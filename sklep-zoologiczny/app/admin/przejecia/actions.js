'use server';

import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';
import { serviceClient } from '@/lib/supabase/service';
import { siteUrl } from '@/lib/site';
import { sendPendingTakeoverNotices, sendTakeoverDecisionMail } from '@/lib/order-mail';

const done = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
  revalidatePath('/weterynarze', 'layout');
  revalidatePath('/hotele', 'layout');
  revalidatePath('/trenerzy', 'layout');
  revalidatePath('/petsitterzy', 'layout');
};

// Decyzja w sprawie zgłoszenia: zatwierdź (dodaj opiekuna albo zastąp dotychczasowych) / odrzuć
export async function decideClaim(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const op = String(fd.get('op') || '');
  if (!id) return;
  await supabase.rpc('decide_place_claim', {
    p_claim: id,
    p_approve: op !== 'reject',
    p_note: String(fd.get('note') || '').slice(0, 500),
    p_replace: op === 'replace',
  });
  // dowód (zdjęcie) kasuje automat po 30 dniach; po decyzji nie jest już potrzebny w panelu
  if (op !== 'reject') {
    try {
      const db = serviceClient();
      if (db) {
        const { data: settings } = await db.from('settings').select('domain').eq('id', 1).maybeSingle();
        await sendPendingTakeoverNotices(await siteUrl(settings));
      }
    } catch { /* resztę dosyła automat dzienny */ }
  }
  done();
}

export async function revokeOwner(fd) {
  const supabase = await adminClient();
  await supabase.rpc('revoke_place_owner', { p_place: Number(fd.get('place_id')), p_user: String(fd.get('user_id')) });
  done();
}

// Podpisany adres do prywatnego zdjęcia dowodowego (ważny 10 minut)
export async function evidenceUrl(path) {
  const db = serviceClient() || (await adminClient());
  const { data } = await db.storage.from('przejecia').createSignedUrl(path, 600);
  return data?.signedUrl || null;
}

// Sprzeciw „To nie ja”: przywróć dostęp zgłaszającego albo odrzuć przejęcie (profil wraca do stanu sprzed przejęcia)
export async function resolveTakeover(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const uphold = String(fd.get('op')) === 'uphold';
  if (!id) return;
  const { data } = await supabase.rpc('admin_resolve_takeover', {
    p_event: id, p_uphold: uphold, p_note: String(fd.get('note') || '').slice(0, 500),
  });
  if (!data) { done(); return; }
  const db = serviceClient();
  const paths = Array.isArray(data.photo_paths) ? data.photo_paths.filter(Boolean) : [];
  if (db && paths.length) await db.storage.from('salony').remove(paths).catch(() => {});
  await sendTakeoverDecisionMail(uphold ? 'przywrocono' : 'odrzucono', data.claimant_email, data.place_name).catch(() => {});
  done();
}
