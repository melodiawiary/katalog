// TYLKO NA SERWERZE. E-maile związane z zamówieniem i automat "Produkt znów dostępny".
import { serviceClient } from '@/lib/supabase/service';
import { getIntegrations } from '@/lib/integrations';
import { sendMail, sendBatch } from '@/lib/mail';
import {
  orderConfirmation, adminNewOrder, orderStatusMail, hasStatusMail, backInStockMail, loginMail, foodReminderMail,
} from '@/lib/mail-templates';

async function loadSettings(db) {
  const { data } = await db.from('settings').select('*').eq('id', 1).maybeSingle();
  return data || {};
}

// db: klient serwisowy; fallback: przekazany klient administratora (panel)
async function context(fallbackDb) {
  const db = serviceClient() || fallbackDb;
  if (!db) return { error: 'Brak klucza SUPABASE_SERVICE_ROLE_KEY na Vercelu - e-maile nie wychodzą.' };
  const integ = await getIntegrations(db);
  if (!integ.resend_api_key) return { error: 'Brak klucza Resend (panel: Integracje) - e-maile nie wychodzą.' };
  const settings = await loadSettings(db);
  return { db, integ, settings };
}

// Potwierdzenie dla klienta + kopia dla sklepu
// extra: { site, payUrl, delivery }
export async function sendOrderEmails(orderId, extra = {}, fallbackDb) {
  const ctx = await context(fallbackDb);
  if (ctx.error) return { ok: false, error: ctx.error };
  const { db, integ, settings } = ctx;
  const { data: order } = await db.rpc('get_order', { p_id: orderId });
  if (!order) return { ok: false, error: 'Nie znaleziono zamówienia.' };

  const orderUrl = extra.site ? `${extra.site}/zamowienie/${orderId}` : '';
  const mail = orderConfirmation(order, settings, { orderUrl, payUrl: extra.payUrl, delivery: extra.delivery });
  const r = await sendMail(db, integ, settings, {
    ...mail, to: order.email, kind: 'potwierdzenie', orderId, replyTo: settings.email || undefined,
  });

  const shopTo = String(integ.notify_email || settings.email || '').trim();
  if (shopTo && extra.notifyShop !== false) {
    const copy = adminNewOrder(order, settings, { adminUrl: extra.site ? `${extra.site}/admin` : '' });
    await sendMail(db, integ, settings, { ...copy, to: shopTo, kind: 'kopia_sklep', orderId, replyTo: order.email });
  }
  return r;
}

// E-mail o zmianie statusu (oplacone, wyslane, zrealizowane, anulowane)
export async function sendStatusEmail(orderId, status, extra = {}, fallbackDb) {
  if (!hasStatusMail(status)) return { ok: false, skipped: true, error: 'Ten status nie ma e-maila.' };
  const ctx = await context(fallbackDb);
  if (ctx.error) return { ok: false, error: ctx.error };
  const { db, integ, settings } = ctx;
  const { data: order } = await db.rpc('get_order', { p_id: orderId });
  if (!order) return { ok: false, error: 'Nie znaleziono zamówienia.' };
  const orderUrl = extra.site ? `${extra.site}/zamowienie/${orderId}` : '';
  const mail = orderStatusMail(order, settings, status, { orderUrl });
  return sendMail(db, integ, settings, {
    ...mail, to: order.email, kind: `status_${status}`, orderId, replyTo: settings.email || undefined,
  });
}

// "Produkt znów dostępny": wysyła do wszystkich czekających na warianty, które są już na stanie,
// i oznacza ich jako powiadomionych. Zwraca { sent, variants } albo { error }.
export async function runStockAlerts(site, fallbackDb) {
  const ctx = await context(fallbackDb);
  if (ctx.error) return { error: ctx.error, sent: 0 };
  const { db, integ, settings } = ctx;
  const base = site || (settings.domain ? `https://${String(settings.domain).replace(/^https?:\/\//, '').replace(/\/+$/, '')}` : '');

  const { data: rows, error } = await db
    .from('stock_alerts')
    .select('id, email, variant_id, product_variants!inner(id, name, stock, active, products!inner(id, name, slug, active))')
    .is('notified_at', null)
    .gt('product_variants.stock', 0)
    .eq('product_variants.active', true)
    .eq('product_variants.products.active', true)
    .limit(1000);
  if (error) return { error: error.message, sent: 0 };
  if (!rows?.length) return { sent: 0, variants: 0 };

  // nazwa wariantu tylko wtedy, gdy produkt ma ich kilka
  const productIds = [...new Set(rows.map((r) => r.product_variants.products.id))];
  const { data: siblings } = await db.from('product_variants')
    .select('product_id').in('product_id', productIds).eq('active', true);
  const perProduct = {};
  for (const s of siblings || []) perProduct[s.product_id] = (perProduct[s.product_id] || 0) + 1;

  const mails = rows.map((r) => {
    const v = r.product_variants;
    const p = v.products;
    const title = `${p.name}${perProduct[p.id] > 1 && v.name ? ` (${v.name})` : ''}`;
    const url = `${base}/produkt/${p.slug}?wariant=${v.id}`;
    return { ...backInStockMail(title, url, settings), to: r.email, kind: 'dostepny', alertId: r.id, replyTo: settings.email || undefined };
  });

  const result = await sendBatch(db, integ, settings, mails);
  const sentIds = mails.filter((m) => m.ok).map((m) => m.alertId);
  if (sentIds.length) {
    await db.from('stock_alerts').update({ notified_at: new Date().toISOString() }).in('id', sentIds);
  }
  return {
    sent: sentIds.length,
    variants: new Set(rows.map((r) => r.variant_id)).size,
    error: result.ok ? undefined : result.error,
  };
}

// Link logowania (konto klienta). db: klient serwisowy z kluczem service_role.
// Zwraca { ok } albo { error }. Kod 6-cyfrowy idzie w tym samym mailu.
export async function sendLoginEmail(email, { site, next = '/konto' }) {
  const ctx = await context(null);
  if (ctx.error) return { ok: false, unavailable: true, error: ctx.error };
  const { db, integ, settings } = ctx;
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  const props = data?.properties;
  if (error || !props?.hashed_token) return { ok: false, error: error?.message || 'Nie udało się przygotować linku.' };
  const url = `${site}/auth/potwierdz?token_hash=${encodeURIComponent(props.hashed_token)}&next=${encodeURIComponent(next)}`;
  const mail = loginMail(url, props.email_otp, settings);
  const r = await sendMail(db, integ, settings, { ...mail, to: email, kind: 'logowanie', replyTo: settings.email || undefined });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

// Przypomnienia o karmie (codziennie z crona): jeden mail na klienta
export async function runFoodReminders(site, fallbackDb) {
  const ctx = await context(fallbackDb);
  if (ctx.error) return { error: ctx.error, sent: 0 };
  const { db, integ, settings } = ctx;
  const { data: rows, error } = await db.rpc('reminders_due');
  if (error) return { error: error.message, sent: 0 };
  if (!rows?.length) return { sent: 0 };

  const byUser = new Map();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);

  const mails = [...byUser.values()].map((list) => {
    const first = list[0];
    const items = list.map((r) => ({
      title: `${r.product_name}${r.multi && r.variant_name ? ` (${r.variant_name})` : ''}`,
      pet: r.pet_name,
      url: `${site}/produkt/${r.slug}?wariant=${r.variant_id}`,
      endsOn: r.ends_on,
    }));
    const unsubUrl = `${site}/konto/wypisz?t=${first.unsub_token}`;
    return {
      ...foodReminderMail(String(first.full_name || '').split(' ')[0], items, `${site}/konto/przypomnienia`, unsubUrl, settings),
      to: first.email,
      kind: 'przypomnienie',
      ids: list.map((r) => r.reminder_id),
      replyTo: settings.email || undefined,
      headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
    };
  });

  const result = await sendBatch(db, integ, settings, mails);
  const sentIds = mails.filter((m) => m.ok).flatMap((m) => m.ids);
  if (sentIds.length) await db.rpc('reminders_mark_sent', { p_ids: sentIds });
  return { sent: mails.filter((m) => m.ok).length, error: result.ok ? undefined : result.error };
}
