'use server';

// Kategorie, marki i hurtownie w panelu admina
import { revalidatePath } from 'next/cache';
import { adminClient } from '@/lib/admin-server';
import { slugify } from '@/lib/shop';
import { needsSql, SQL_HINT } from '@/lib/admin';

const text = (fd, key, max = 200) => String(fd.get(key) ?? '').trim().slice(0, max);
const done = (message) => ({ ok: true, message, at: Date.now() });

function friendly(error, what) {
  if (needsSql(error)) return SQL_HINT;
  if (error.code === '23505') return `${what} o takiej nazwie lub adresie (slug) już istnieje.`;
  if (error.code === '23503') return `${what} jest jeszcze używana - najpierw przenieś lub usuń powiązane pozycje.`;
  return error.message;
}

// ---------- KATEGORIE ----------

export async function saveCategory(prev, fd) {
  const supabase = await adminClient();
  const id = fd.get('id') ? Number(fd.get('id')) : null;
  const name = text(fd, 'name', 100);
  if (!name) return { error: 'Podaj nazwę kategorii.' };
  const parentId = fd.get('parent_id') ? Number(fd.get('parent_id')) : null;
  if (id && parentId === id) return { error: 'Kategoria nie może być podkategorią samej siebie.' };

  let slug = slugify(text(fd, 'slug') || name);
  if (!text(fd, 'slug') && parentId) {
    // "Karma sucha" w "Psy -> Karma" dostaje adres psy-karma-sucha, żeby nie dublować adresów
    const { data: parent } = await supabase.from('categories').select('slug').eq('id', parentId).maybeSingle();
    if (parent && !slug.startsWith(`${parent.slug}-`)) slug = slugify(`${parent.slug} ${name}`);
  }

  const row = {
    name,
    slug,
    emoji: text(fd, 'emoji', 8) || '🐾',
    sort: Number(fd.get('sort')) || 0,
    parent_id: parentId,
    description: text(fd, 'description', 2000),
    active: fd.get('active') === 'on',
  };
  const { error } = id
    ? await supabase.from('categories').update(row).eq('id', id)
    : await supabase.from('categories').insert(row);
  if (error) {
    if (/samej siebie/.test(error.message)) return { error: 'Nie można przenieść kategorii do jej własnej podkategorii.' };
    return { error: friendly(error, 'Kategoria') };
  }
  revalidatePath('/', 'layout');
  return done(id ? 'Zapisano.' : `Dodano kategorię „${name}”.`);
}

export async function deleteCategory(prev, fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const [{ count: children }, { count: products }] = await Promise.all([
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', id),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id),
  ]);
  if (children) return { error: `Ta kategoria ma podkategorie (${children}). Najpierw je przenieś albo usuń.` };
  if (products) return { error: `W tej kategorii są produkty (${products}). Przenieś je do innej kategorii albo ukryj kategorię.` };
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return { error: friendly(error, 'Kategoria') };
  revalidatePath('/', 'layout');
  return done('Usunięto.');
}

// ---------- MARKI ----------

export async function saveBrand(prev, fd) {
  const supabase = await adminClient();
  const id = fd.get('id') ? Number(fd.get('id')) : null;
  const name = text(fd, 'name', 100);
  if (!name) return { error: 'Podaj nazwę marki.' };
  const row = {
    name,
    slug: slugify(text(fd, 'slug') || name),
    description: text(fd, 'description', 2000),
    logo_url: text(fd, 'logo_url', 1000) || null,
    active: fd.get('active') === 'on',
  };
  const { error } = id
    ? await supabase.from('brands').update(row).eq('id', id)
    : await supabase.from('brands').insert(row);
  if (error) return { error: friendly(error, 'Marka') };
  revalidatePath('/', 'layout');
  return done(id ? 'Zapisano.' : `Dodano markę „${name}”.`);
}

export async function deleteBrand(prev, fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('brand_id', id);
  if (count) return { error: `Ta marka ma produkty (${count}). Zmień im markę albo ukryj markę.` };
  const { error } = await supabase.from('brands').delete().eq('id', id);
  if (error) return { error: friendly(error, 'Marka') };
  revalidatePath('/', 'layout');
  return done('Usunięto.');
}

// ---------- HURTOWNIE ----------

export async function saveSupplier(prev, fd) {
  const supabase = await adminClient();
  const id = fd.get('id') ? Number(fd.get('id')) : null;
  const name = text(fd, 'name', 120);
  if (!name) return { error: 'Podaj nazwę hurtowni.' };
  const row = {
    name,
    nip: text(fd, 'nip', 20).replace(/[\s-]/g, ''),
    email: text(fd, 'email', 160),
    phone: text(fd, 'phone', 40),
    website: text(fd, 'website', 300),
    notes: text(fd, 'notes', 4000),
    active: fd.get('active') === 'on',
  };
  if (row.nip && !/^\d{10}$/.test(row.nip)) return { error: 'NIP to 10 cyfr.' };
  const { error } = id
    ? await supabase.from('suppliers').update(row).eq('id', id)
    : await supabase.from('suppliers').insert(row);
  if (error) return { error: friendly(error, 'Hurtownia') };
  revalidatePath('/admin', 'layout');
  return done(id ? 'Zapisano.' : `Dodano hurtownię „${name}”.`);
}

export async function deleteSupplier(prev, fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id'));
  const { count } = await supabase.from('variant_suppliers').select('variant_id', { count: 'exact', head: true }).eq('supplier_id', id);
  if (count) return { error: `Ta hurtownia ma przypisane produkty (${count}) z cenami zakupu. Odznacz „Aktywna” zamiast usuwać.` };
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) return { error: friendly(error, 'Hurtownia') };
  revalidatePath('/admin', 'layout');
  return done('Usunięto.');
}
