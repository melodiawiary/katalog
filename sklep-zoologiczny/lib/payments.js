// TYLKO NA SERWERZE. Płatności online za zamówienia (Przelewy24).
import { serviceClient } from '@/lib/supabase/service';
import { getIntegrations, p24Ready } from '@/lib/integrations';
import { registerTransaction, verifyTransaction, transactionBySession } from '@/lib/p24';
import { sendStatusEmail } from '@/lib/order-mail';

const SERVICE_MISSING = 'Płatności online wymagają klucza SUPABASE_SERVICE_ROLE_KEY na Vercelu.';

// Nowa próba zapłaty -> { url } albo { error }
export async function startPayment(orderId, site) {
  const db = serviceClient();
  if (!db) return { error: SERVICE_MISSING };
  const integ = await getIntegrations(db);
  if (!p24Ready(integ)) return { error: 'Płatności Przelewy24 nie są włączone (panel: Integracje).' };

  const { data: order } = await db.from('orders')
    .select('id, number, email, customer_name, phone, total, status, payment_method, payment_status, is_test')
    .eq('id', orderId).maybeSingle();
  if (!order) return { error: 'Nie znaleziono zamówienia.' };
  if (order.payment_method !== 'p24') return { error: 'To zamówienie ma inny sposób płatności.' };
  if (order.payment_status === 'oplacone') return { error: 'To zamówienie jest już opłacone.' };
  if (order.status === 'anulowane') return { error: 'To zamówienie zostało anulowane.' };

  const amount = Math.round(Number(order.total) * 100);
  const sessionId = `${order.number}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: settings } = await db.from('settings').select('shop_name').eq('id', 1).maybeSingle();

  const r = await registerTransaction(integ, {
    sessionId,
    amount,
    description: `${order.is_test ? '[TEST] ' : ''}Zamówienie nr ${order.number} - ${settings?.shop_name || 'sklep'}`,
    email: order.email,
    client: order.customer_name,
    phone: order.phone,
    urlReturn: `${site}/zamowienie/${order.id}?platnosc=1`,
    urlStatus: `${site}/api/p24/status`,
  });

  await db.from('payments').insert({
    order_id: order.id, session_id: sessionId, amount, token: r.token || null,
    status: r.ok ? 'nowa' : 'blad', error: r.ok ? null : r.error,
  });

  if (!r.ok) return { error: r.error };
  return { url: r.url };
}

// Potwierdza wpłatę w Przelewy24 i księguje ją w sklepie (z e-mailem do klienta przy pierwszym razie)
async function confirm(db, integ, payment, p24OrderId, methodId, site) {
  const v = await verifyTransaction(integ, { sessionId: payment.session_id, orderId: p24OrderId, amount: payment.amount });
  if (!v.ok) {
    await db.from('payments').update({ error: v.error }).eq('session_id', payment.session_id);
    return { ok: false, error: v.error };
  }
  const { data: res, error } = await db.rpc('payment_paid', {
    p_session: payment.session_id, p_p24_order: Number(p24OrderId), p_method: Number(methodId) || null,
  });
  if (error) return { ok: false, error: error.message };
  if (res?.changed) {
    try { await sendStatusEmail(res.order_id, 'oplacone', { site }); } catch { /* e-mail nie blokuje płatności */ }
  }
  return { ok: true, changed: Boolean(res?.changed) };
}

// Powiadomienie z Przelewy24 (już sprawdzony podpis): n = treść powiadomienia
export async function handleNotification(db, integ, n, site) {
  const { data: payment } = await db.from('payments')
    .select('session_id, amount, status, order_id').eq('session_id', String(n.sessionId)).maybeSingle();
  if (!payment) return { ok: false, error: 'Nieznana płatność' };
  if (Number(n.amount) !== payment.amount || String(n.currency) !== 'PLN') {
    await db.from('payments').update({ error: `Kwota się nie zgadza: ${n.amount} ${n.currency}` }).eq('session_id', payment.session_id);
    return { ok: false, error: 'Kwota się nie zgadza' };
  }
  if (payment.status === 'oplacona') return { ok: true, changed: false };
  return confirm(db, integ, payment, n.orderId, n.methodId, site);
}

// Gdy powiadomienie nie dotarło (albo klient wrócił szybciej): pyta Przelewy24 o niedawne płatności zamówienia.
export async function checkPendingPayments(orderId, site) {
  const db = serviceClient();
  if (!db) return { ok: false };
  const integ = await getIntegrations(db);
  if (!integ.p24_crc || !integ.p24_api_key) return { ok: false };
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: list } = await db.from('payments')
    .select('session_id, amount, status').eq('order_id', orderId).eq('status', 'nowa')
    .gte('created_at', since).order('created_at', { ascending: false }).limit(5);
  for (const p of list || []) {
    const r = await transactionBySession(integ, p.session_id);
    const t = r.ok ? r.data?.data : null;
    if (!t || ![1, 2].includes(Number(t.status)) || Number(t.amount) !== p.amount) continue;
    const res = await confirm(db, integ, p, t.orderId, t.methodId, site);
    if (res.ok) return { ok: true, paid: true };
  }
  return { ok: true, paid: false };
}

// Codziennie (cron): nieopłacone zamówienia Przelewy24 z ostatnich 3 dni
export async function checkRecentUnpaid(site) {
  const db = serviceClient();
  if (!db) return { checked: 0 };
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data: orders } = await db.from('orders').select('id')
    .eq('payment_method', 'p24').eq('payment_status', 'nieoplacone').neq('status', 'anulowane')
    .gte('created_at', since).limit(100);
  let paid = 0;
  for (const o of orders || []) {
    const r = await checkPendingPayments(o.id, site);
    if (r.paid) paid++;
  }
  return { checked: orders?.length || 0, paid };
}
