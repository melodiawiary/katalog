'use server';

import { createClient } from '@/lib/supabase/server';

const ids = (list) => [...new Set(list.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 60);

// Aktualne ceny i stany pozycji koszyka.
// Wejście: [{ key, product_id, variant_id }]. Wynik: { [key]: { price, stock, ... } | { unavailable: '...' } }
export async function refreshCart(items) {
  if (!Array.isArray(items) || items.length === 0) return {};
  const list = items.slice(0, 60);
  const variantIds = ids(list.filter((i) => i.variant_id).map((i) => i.variant_id));
  const productIds = ids(list.filter((i) => !i.variant_id).map((i) => i.product_id));

  const supabase = await createClient();
  const select = 'id, product_id, name, stock, effective_price, products(name, slug, image_url)';
  const [byVariant, byProduct] = await Promise.all([
    variantIds.length
      ? supabase.from('product_variants').select(select).in('id', variantIds)
      : { data: [] },
    productIds.length
      ? supabase.from('product_variants').select(select).in('product_id', productIds)
      : { data: [] },
  ]);
  if (byVariant.error || byProduct.error) return null; // baza niedostępna - zostawiamy koszyk bez zmian

  // RLS zwraca tylko aktywne warianty aktywnych produktów
  const variants = new Map((byVariant.data || []).map((v) => [v.id, v]));
  const perProduct = new Map();
  for (const v of byProduct.data || []) {
    perProduct.set(v.product_id, [...(perProduct.get(v.product_id) || []), v]);
  }
  const countFor = new Map();
  if (variantIds.length) {
    const products = ids((byVariant.data || []).map((v) => v.product_id));
    const { data } = await supabase.from('product_variants').select('product_id').in('product_id', products);
    for (const r of data || []) countFor.set(r.product_id, (countFor.get(r.product_id) || 0) + 1);
  }

  const out = {};
  for (const i of list) {
    let v;
    if (i.variant_id) {
      v = variants.get(Number(i.variant_id));
    } else {
      const all = perProduct.get(Number(i.product_id)) || [];
      if (all.length > 1) {
        out[i.key] = { unavailable: 'wariant' };
        continue;
      }
      v = all[0];
    }
    if (!v) {
      out[i.key] = { unavailable: 'usuniety' };
      continue;
    }
    const multi = i.variant_id ? (countFor.get(v.product_id) || 1) > 1 : false;
    out[i.key] = {
      variant_id: v.id,
      price: Number(v.effective_price),
      stock: v.stock,
      name: v.products?.name,
      slug: v.products?.slug,
      image_url: v.products?.image_url,
      variant_name: multi ? v.name : '',
    };
  }
  return out;
}
