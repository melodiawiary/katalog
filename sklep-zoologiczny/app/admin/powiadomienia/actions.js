'use server';

// "Powiadom o dostępności" (tabela stock_alerts z 05_karta.sql)
import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';

// Oznacza wszystkie czekające zapisy wariantu jako powiadomione (po wysłaniu e-maila)
export async function markNotified(prev, fd) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from('stock_alerts')
    .update({ notified_at: new Date().toISOString() })
    .eq('variant_id', Number(fd.get('variant_id')))
    .is('notified_at', null);
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Oznaczono jako powiadomione.', at: Date.now() };
}

export async function deleteAlert(prev, fd) {
  const supabase = await adminClient();
  const { error } = await supabase.from('stock_alerts').delete().eq('id', Number(fd.get('id')));
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Usunięto.', at: Date.now() };
}
