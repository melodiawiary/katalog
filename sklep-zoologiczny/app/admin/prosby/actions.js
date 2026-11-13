'use server';

// Zgłoszenia "Nie mamy? Napisz, sprowadzimy" (tabela product_requests z 04_szukanie.sql)
import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';
import { REQUEST_STATUS } from '@/lib/requests';

export async function updateRequest(prev, fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const status = String(fd.get('status') || '');
  if (!REQUEST_STATUS[status]) return { error: 'Nieznany status.' };
  const { error } = await supabase
    .from('product_requests')
    .update({ status, admin_note: String(fd.get('admin_note') || '').trim().slice(0, 2000) })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Zapisano.', at: Date.now() };
}

export async function deleteRequest(prev, fd) {
  const supabase = await adminClient();
  const { error } = await supabase.from('product_requests').delete().eq('id', Number(fd.get('id')));
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Usunięto.', at: Date.now() };
}
