'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { shippingInfo } from '@/lib/shipping-time';
import { sendOrderEmails } from '@/lib/order-mail';
import { startPayment } from '@/lib/payments';

const FIELDS = ['name', 'email', 'phone', 'address', 'postal_code', 'city', 'notes'];

export async function placeOrder(prevState, formData) {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) || '')]));
  const fail = (error) => ({ error, values });

  const settings = await getSettings();
  const supabase = await createClient();
  if (!settings.sales_enabled) {
    // przy wyłączonej sprzedaży zamawiać może tylko administrator (zamówienie testowe; sprawdza też baza)
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) return fail('Sklep jeszcze nie przyjmuje zamówień. Zapraszamy wkrótce!');
  }

  let items;
  try {
    // pozycja: { variant_id, quantity } albo (produkt z jednym wariantem) { product_id, quantity }
    items = JSON.parse(formData.get('items') || '[]').slice(0, 50).map((i) => {
      const quantity = Number(i.quantity);
      if (i.variant_id) return { variant_id: Number(i.variant_id), quantity };
      return { product_id: Number(i.product_id ?? i.id), quantity };
    });
  } catch {
    return fail('Nieprawidłowa zawartość koszyka.');
  }

  if (!formData.get('regulamin')) return fail('Zaakceptuj regulamin sklepu.');

  const shipping = String(formData.get('shipping') || '');
  const payment = String(formData.get('payment') || '');
  const customer = {
    ...values,
    locker_id: shipping === 'paczkomat' ? String(formData.get('locker_id') || '') : '',
    locker_desc: shipping === 'paczkomat' ? String(formData.get('locker_desc') || '') : '',
  };
  if (shipping === 'paczkomat') {
    customer.address = '';
    customer.postal_code = '';
    customer.city = '';
  }

  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_customer: customer,
    p_items: items,
    p_shipping: shipping,
    p_payment: payment,
  });

  if (error) return fail(error.message || 'Nie udało się złożyć zamówienia.');

  const site = await siteUrl(settings);
  const delivery = shippingInfo(new Date(), settings.ship_cutoff, settings.ship_handling_days);

  // e-maile po odesłaniu odpowiedzi (klient nie czeka)
  after(async () => {
    try { await sendOrderEmails(orderId, { site, delivery }); } catch { /* błąd trafia do dziennika */ }
  });

  if (payment === 'p24') {
    const r = await startPayment(orderId, site);
    if (r.url) redirect(r.url);
    redirect(`/zamowienie/${orderId}?blad=platnosc`);
  }

  redirect(`/zamowienie/${orderId}`);
}

// "Zapłać teraz" na stronie zamówienia (nowa próba płatności)
export async function payAgain(formData) {
  const id = String(formData.get('id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const settings = await getSettings();
  const r = await startPayment(id, await siteUrl(settings));
  if (r.url) redirect(r.url);
  redirect(`/zamowienie/${id}?blad=platnosc`);
}
