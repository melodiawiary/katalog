'use server';

// Klucze usług: Resend (e-maile), Przelewy24, InPost (tabela integrations z 06_zamowienie.sql)
import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';
import { getSettings } from '@/lib/settings';
import { getIntegrations, p24Ready } from '@/lib/integrations';
import { sendMail } from '@/lib/mail';
import { testMail } from '@/lib/mail-templates';
import { testAccess } from '@/lib/p24';
import { needsSql } from '@/lib/admin';

const SQL_06 = 'Wklej najpierw w Supabase plik supabase/06_zamowienie.sql.';
const SECRETS = ['resend_api_key', 'p24_crc', 'p24_api_key'];
const PLAIN = ['mail_from', 'notify_email', 'p24_merchant_id', 'p24_pos_id', 'inpost_geowidget_token'];

export async function saveIntegrations(prevState, formData) {
  const supabase = await adminClient();
  const current = await getIntegrations(supabase);
  if (current._missing) return { error: SQL_06 };

  const patch = { updated_at: new Date().toISOString() };
  for (const k of PLAIN) patch[k] = String(formData.get(k) || '').trim().slice(0, k === 'inpost_geowidget_token' ? 4000 : 200);
  for (const k of SECRETS) {
    const v = String(formData.get(k) || '').trim();
    if (formData.get(`clear_${k}`) === 'on') patch[k] = '';
    else if (v) patch[k] = v.slice(0, 300);
  }
  patch.p24_merchant_id = patch.p24_merchant_id.replace(/\D/g, '');
  patch.p24_pos_id = patch.p24_pos_id.replace(/\D/g, '');
  patch.p24_sandbox = formData.get('p24_sandbox') === 'on';
  patch.p24_enabled = formData.get('p24_enabled') === 'on';

  if (patch.mail_from && !/^[^<>]*<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$|^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(patch.mail_from)) {
    return { error: 'Nadawca: wpisz adres (sklep@domena.pl) albo "Nazwa <sklep@domena.pl>".' };
  }
  if (patch.notify_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.notify_email)) {
    return { error: 'Podaj poprawny e-mail do kopii zamówień.' };
  }
  const merged = { ...current, ...patch };
  if (patch.p24_enabled && !p24Ready(merged)) {
    return { error: 'Żeby włączyć Przelewy24, wpisz ID sprzedawcy, klucz CRC i klucz API.' };
  }

  const { error } = await supabase.from('integrations').update(patch).eq('id', 1);
  if (error) return { error: needsSql(error) ? SQL_06 : error.message };
  revalidatePath('/admin/integracje');
  revalidatePath('/zamowienie');
  return { ok: true, message: 'Zapisano.', at: Date.now() };
}

export async function sendTestEmail(prevState, formData) {
  const supabase = await adminClient();
  const integ = await getIntegrations(supabase);
  if (integ._missing) return { error: SQL_06 };
  const to = String(formData.get('to') || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: 'Podaj adres e-mail.' };
  const settings = await getSettings();
  const r = await sendMail(supabase, integ, settings, { ...testMail(settings), to, kind: 'test' });
  if (!r.ok) {
    const hint = /only send testing emails|verify a domain/i.test(r.error || '')
      ? ' Bez własnej domeny Resend wysyła tylko na e-mail, którym założono konto Resend.'
      : '';
    return { error: `${r.error}${hint}` };
  }
  return { ok: true, message: `Wysłano na ${to}. Sprawdź skrzynkę (także Spam).`, at: Date.now() };
}

export async function testP24() {
  const supabase = await adminClient();
  const integ = await getIntegrations(supabase);
  if (integ._missing) return { error: SQL_06 };
  if (!integ.p24_merchant_id || !integ.p24_api_key) return { error: 'Wpisz i zapisz ID sprzedawcy i klucz API.' };
  const r = await testAccess(integ);
  if (!r.ok) return { error: `${r.error}. Sprawdź ID, klucz API i tryb (testowy / prawdziwy).` };
  return { ok: true, message: `Połączenie z Przelewy24 działa (${integ.p24_sandbox ? 'tryb testowy' : 'tryb prawdziwy'}).`, at: Date.now() };
}
