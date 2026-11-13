'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STATUS } from '@/lib/shop';
import { SETTINGS_FIELDS, missingSettings } from '@/lib/settings-fields';
import { adminClient } from '@/lib/admin-server';


export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/logowanie');
}

export async function updateOrderStatus(formData) {
  const supabase = await adminClient();
  const status = formData.get('status');
  if (!STATUS[status]) return;
  await supabase.from('orders').update({ status }).eq('id', formData.get('id'));
  revalidatePath('/admin');
}

export async function saveSettings(prevState, formData) {
  const supabase = await adminClient();

  const settings = {};
  for (const f of SETTINGS_FIELDS) settings[f.key] = String(formData.get(f.key) || '').trim().slice(0, 200);
  settings.vat_status = formData.get('vat_status') === 'czynny' ? 'czynny' : 'zwolniony';
  settings.sales_enabled = formData.get('sales_enabled') === 'on';

  const missing = missingSettings(settings);
  if (settings.sales_enabled && missing.length > 0) {
    return { error: `Nie można włączyć sprzedaży. Uzupełnij: ${missing.join(', ')}.`, values: settings };
  }

  const { error } = await supabase.from('settings').update(settings).eq('id', 1);
  if (error) return { error: error.message, values: settings };

  revalidatePath('/', 'layout');
  return { ok: true, values: settings };
}
