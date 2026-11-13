'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { slugify, STATUS } from '@/lib/shop';
import { SETTINGS_FIELDS, missingSettings } from '@/lib/settings-fields';

async function adminClient() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new Error('Brak uprawnień administratora');
  return supabase;
}

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

export async function saveProduct(prevState, formData) {
  const supabase = await adminClient();
  const id = formData.get('id');
  const name = String(formData.get('name') || '').trim();
  if (!name) return { error: 'Podaj nazwę produktu.' };

  const product = {
    name,
    slug: slugify(formData.get('slug') || name),
    category_id: formData.get('category_id') ? Number(formData.get('category_id')) : null,
    description: String(formData.get('description') || ''),
    price: Number(String(formData.get('price')).replace(',', '.')),
    stock: Number(formData.get('stock') || 0),
    active: formData.get('active') === 'on',
  };

  if (!(product.price >= 0)) return { error: 'Nieprawidłowa cena.' };
  if (!Number.isInteger(product.stock) || product.stock < 0) return { error: 'Nieprawidłowy stan magazynowy.' };

  const image = formData.get('image');
  if (image && typeof image === 'object' && image.size > 0) {
    if (!image.type.startsWith('image/')) return { error: 'Plik musi być obrazem.' };
    const ext = (image.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${Date.now()}-${product.slug}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('produkty')
      .upload(path, image, { contentType: image.type });
    if (uploadError) return { error: `Błąd wysyłania zdjęcia: ${uploadError.message}` };
    product.image_url = supabase.storage.from('produkty').getPublicUrl(path).data.publicUrl;
  }
  if (formData.get('remove_image') === 'on') product.image_url = null;

  const { error } = id
    ? await supabase.from('products').update(product).eq('id', id)
    : await supabase.from('products').insert(product);

  if (error) {
    if (error.code === '23505') return { error: 'Produkt o takim adresie (slug) już istnieje.' };
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/admin/produkty');
}

export async function deleteProduct(formData) {
  const supabase = await adminClient();
  await supabase.from('products').delete().eq('id', formData.get('id'));
  revalidatePath('/', 'layout');
  redirect('/admin/produkty');
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
