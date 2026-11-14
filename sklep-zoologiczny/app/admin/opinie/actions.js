'use server';

import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';

// Ukrycie / przywrócenie / usunięcie opinii (tylko administrator; RLS pilnuje też w bazie)
export async function moderateReview(fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const op = String(fd.get('op') || '');
  if (!id) return;
  if (op === 'delete') {
    await supabase.from('product_reviews').delete().eq('id', id);
  } else if (op === 'hide') {
    await supabase.from('product_reviews')
      .update({ status: 'ukryta', hidden_note: String(fd.get('note') || '').slice(0, 300) }).eq('id', id);
  } else if (op === 'show') {
    await supabase.from('product_reviews').update({ status: 'opublikowana', hidden_note: '' }).eq('id', id);
  }
  revalidatePath('/admin/opinie');
}
