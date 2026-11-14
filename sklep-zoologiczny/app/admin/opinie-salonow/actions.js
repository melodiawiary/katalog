'use server';

import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';

const done = () => {
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
};

// Zatwierdzenie / ukrycie / przywrócenie / usunięcie opinii o salonie (ranking przelicza baza sama)
export async function moderatePlaceReview(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const op = String(fd.get('op') || '');
  if (!id) return;
  if (op === 'delete') {
    await supabase.from('place_reviews').delete().eq('id', id);
  } else if (op === 'hide') {
    await supabase.from('place_reviews')
      .update({ status: 'ukryta', hidden_note: String(fd.get('note') || '').slice(0, 300) }).eq('id', id);
    await supabase.from('place_review_reports').update({ status: 'zalatwione' }).eq('review_id', id);
  } else if (op === 'show') {
    await supabase.from('place_reviews').update({ status: 'opublikowana', hidden_note: '' }).eq('id', id);
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
