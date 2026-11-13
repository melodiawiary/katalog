'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function placeOrder(prevState, formData) {
  let items;
  try {
    items = JSON.parse(formData.get('items') || '[]').map((i) => ({
      product_id: Number(i.id),
      quantity: Number(i.quantity),
    }));
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
