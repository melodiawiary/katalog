'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';

export async function placeOrder(prevState, formData) {
  const settings = await getSettings();
  if (!settings.sales_enabled) {
    return { error: 'Sklep jeszcze nie przyjmuje zamówień. Zapraszamy wkrótce!' };
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
    return { error: 'Nieprawidłowa zawartość koszyka.' };
  }

  if (!formData.get('regulamin')) {
    return { error: 'Zaakceptuj regulamin sklepu.' };
  }

  const customer = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    postal_code: formData.get('postal_code'),
    city: formData.get('city'),
    notes: formData.get('notes') || '',
  };

  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_customer: customer,
    p_items: items,
    p_shipping: formData.get('shipping'),
    p_payment: formData.get('payment'),
  });

  if (error) {
    return { error: error.message || 'Nie udało się złożyć zamówienia.' };
  }

  redirect(`/zamowienie/${orderId}`);
}
