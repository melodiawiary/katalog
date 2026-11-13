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
  // wysyłka (pola są w formularzu dopiero po wklejeniu 05_karta.sql)
  if (formData.has('ship_cutoff')) {
    const cutoff = String(formData.get('ship_cutoff') || '').slice(0, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) return { error: 'Podaj godzinę wysyłki, np. 13:00.', values: settings };
    settings.ship_cutoff = cutoff;
    settings.ship_handling_days = Math.max(0, Math.min(14, Number(formData.get('ship_handling_days')) || 0));
  }

  const missing = missingSettings(settings);
  if (settings.sales_enabled && missing.length > 0) {
    return { error: `Nie można włączyć sprzedaży. Uzupełnij: ${missing.join(', ')}.`, values: settings };
  }

  const { error } = await supabase.from('settings').update(settings).eq('id', 1);
  if (error) return { error: error.message, values: settings };

  revalidatePath('/', 'layout');
  return { ok: true, values: settings };
}
