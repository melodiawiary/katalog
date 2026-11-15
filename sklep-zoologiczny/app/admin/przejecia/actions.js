'use server';

import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';
import { serviceClient } from '@/lib/supabase/service';

const done = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
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
