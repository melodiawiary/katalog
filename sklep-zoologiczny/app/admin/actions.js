'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { STATUS } from '@/lib/shop';
import { SETTINGS_FIELDS, missingSettings } from '@/lib/settings-fields';
import { adminClient } from '@/lib/admin-server';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { sendStatusEmail, sendOrderEmails } from '@/lib/order-mail';
import { hasStatusMail } from '@/lib/mail-templates';


export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/logowanie');
}

// Zmiana statusu / numeru przesyłki, z e-mailem do klienta
export async function updateOrder(prevState, formData) {
  const supabase = await adminClient();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (!STATUS[status]) return { error: 'Wybierz status.' };
  const tracking = String(formData.get('tracking_number') ?? '').trim().slice(0, 60);
  const notify = formData.get('notify') === 'on';

  const { data: old } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (!old) return { error: 'Nie znaleziono zamówienia.' };

  const patch = { status };
  if ('tracking_number' in old) patch.tracking_number = tracking;
  const { error } = await supabase.from('orders').update(patch).eq('id', id);
  if (error) return { error: error.message };

  let message = 'Zapisano.';
  const statusChanged = old.status !== status;
  const trackingAdded = status === 'wyslane' && tracking && tracking !== (old.tracking_number || '');
  if (notify && (statusChanged || trackingAdded) && hasStatusMail(status)) {
    const settings = await getSettings();
    const r = await sendStatusEmail(id, status, { site: await siteUrl(settings) }, supabase);
    message += r.ok ? ' E-mail do klienta wysłany.' : ` E-mail nie wyszedł: ${r.error}`;
  }
  revalidatePath('/admin');
  return { ok: true, message, at: Date.now() };
}

// Ponowne wysłanie potwierdzenia zamówienia do klienta
export async function resendConfirmation(prevState, formData) {
  const supabase = await adminClient();
  const settings = await getSettings();
  const r = await sendOrderEmails(String(formData.get('id')), { site: await siteUrl(settings), notifyShop: false }, supabase);
  revalidatePath('/admin');
  return r.ok ? { ok: true, message: 'Potwierdzenie wysłane.', at: Date.now() } : { error: r.error };
}

// Usunięcie zamówienia testowego (baza oddaje towar na stan i nie pozwoli usunąć prawdziwego)
export async function deleteTestOrder(prevState, formData) {
  const supabase = await adminClient();
  const { error } = await supabase.from('orders').delete().eq('id', String(formData.get('id'))).eq('is_test', true);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { ok: true, message: 'Usunięto.', at: Date.now() };
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
