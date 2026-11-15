'use server';

import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';
import { siteUrl } from '@/lib/site';
import { sendOwnerReviewMails } from '@/lib/order-mail';

const done = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
  revalidatePath('/weterynarze', 'layout');
  revalidatePath('/hotele', 'layout');
};

// Zatwierdzenie / ukrycie / przywrócenie / usunięcie opinii o salonie (ranking przelicza baza sama)
export async function moderatePlaceReview(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const op = String(fd.get('op') || '');
  if (!id) return;
  if (op === 'delete') {
    // pliki zdjęć z opinii nie znikają same razem z wierszami
    const { data: ph } = await supabase.from('place_review_photos').select('path').eq('review_id', id);
    if (ph?.length) await supabase.storage.from('opinie-salonow').remove(ph.map((x) => x.path));
    await supabase.from('place_reviews').delete().eq('id', id);
  } else if (op === 'hide') {
    await supabase.from('place_reviews')
      .update({ status: 'ukryta', hidden_note: String(fd.get('note') || '').slice(0, 300) }).eq('id', id);
    await supabase.from('place_review_reports').update({ status: 'zalatwione' }).eq('review_id', id);
  } else if (op === 'show') {
    const { data: before } = await supabase.from('place_reviews').select('status, place_id').eq('id', id).maybeSingle();
    await supabase.from('place_reviews').update({ status: 'opublikowana', hidden_note: '' }).eq('id', id);
    if (before?.status === 'oczekuje') {
      // właściciel dowiaduje się o nowej opinii dopiero po zatwierdzeniu
      try { await sendOwnerReviewMails(before.place_id, await siteUrl()); } catch { /* mail nie blokuje moderacji */ }
    }
  } else if (op === 'keep') {
    // zgłoszenia odrzucone: opinia zostaje
    await supabase.from('place_review_reports').update({ status: 'zalatwione' }).eq('review_id', id);
    await supabase.from('place_reviews').update({ reports_count: 0 }).eq('id', id);
  }
  done();
}

// Przełącznik: nowe opinie czekają na zatwierdzenie / publikują się od razu
export async function setReviewsPremoderation(prev, fd) {
  const supabase = await adminClient();
  const on = fd.get('premoderation') === 'on';
  const { error } = await supabase.from('places_config').update({ reviews_premoderation: on }).eq('id', true);
  if (error) return { error: 'Nie udało się zapisać. Czy uruchomiono supabase/11_opinie_salonow.sql?' };
  done();
  return { ok: true, message: on ? 'Nowe opinie czekają na Twoje zatwierdzenie.' : 'Nowe opinie publikują się od razu.', at: Date.now() };
}

// Zdjęcie z opinii: zatwierdzenie albo odrzucenie (odrzucone znika razem z plikiem)
export async function moderateReviewPhoto(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  if (!id) return;
  const approve = String(fd.get('op')) === 'approve';
  const { data: path } = await supabase.rpc('moderate_review_photo', { p_photo: id, p_approve: approve });
  if (path) await supabase.storage.from('opinie-salonow').remove([path]);
  done();
}

// Odpowiedź właściciela: ukrycie albo przywrócenie
export async function moderateReply(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('review_id'));
  if (!id) return;
  const status = String(fd.get('op')) === 'hide' ? 'ukryta' : 'opublikowana';
  await supabase.from('place_review_replies').update({ status }).eq('review_id', id);
  done();
}
