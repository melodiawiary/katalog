'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/admin-server';
import { slugify } from '@/lib/shop';
import {
  needsSql, SQL_HINT, parseDecimal, parseIntOrNull, warsawDayStart, warsawDayEnd,
} from '@/lib/admin';

const BUCKET_MARK = '/storage/v1/object/public/produkty/';
const VAT_RATES = [0, 5, 8, 23];
const UNITS = ['kg', 'l', 'szt'];

const text = (v, max = 20000) => String(v ?? '').trim().slice(0, max);

// Sprawdza i porządkuje dane z formularza. Zwraca { error } albo { data }.
function validate(input) {
  const name = text(input.name, 200);
  if (!name) return { error: 'Podaj nazwę produktu.' };

  const vat = Number(input.vat_rate);
  if (!VAT_RATES.includes(vat)) return { error: 'Wybierz stawkę VAT.' };

  const rawVariants = Array.isArray(input.variants) ? input.variants : [];
  if (rawVariants.length === 0) return { error: 'Produkt musi mieć co najmniej jeden wariant.' };
  if (rawVariants.length > 50) return { error: 'Za dużo wariantów (maksymalnie 50).' };

  const variants = [];
  const eans = new Set();
  for (const [i, v] of rawVariants.entries()) {
    const label = rawVariants.length > 1 ? `Wariant ${i + 1}${v.name ? ` (${text(v.name, 60)})` : ''}: ` : '';
    const price = parseDecimal(v.price);
    if (price === null || Number.isNaN(price)) return { error: `${label}podaj poprawną cenę.` };
    const stock = parseIntOrNull(v.stock) ?? 0;
    if (Number.isNaN(stock)) return { error: `${label}stan musi być liczbą całkowitą (0 lub więcej).` };
    const ean = text(v.ean, 20).replace(/\s/g, '');
    if (ean && !/^\d{8,14}$/.test(ean)) return { error: `${label}EAN to 8-14 cyfr.` };
    if (ean && eans.has(ean)) return { error: `${label}ten sam EAN jest w dwóch wariantach.` };
    if (ean) eans.add(ean);
    const net = parseDecimal(v.net_quantity);
    if (Number.isNaN(net) || net === 0) return { error: `${label}nieprawidłowa ilość netto.` };
    const unit = UNITS.includes(v.unit) ? v.unit : 'szt';

    const promoPrice = parseDecimal(v.promo_price);
    if (Number.isNaN(promoPrice)) return { error: `${label}nieprawidłowa cena promocyjna.` };
    if (promoPrice !== null && promoPrice >= price) return { error: `${label}cena promocyjna musi być niższa od zwykłej.` };
    const promoFrom = promoPrice !== null ? warsawDayStart(v.promo_from) : null;
    const promoTo = promoPrice !== null ? warsawDayEnd(v.promo_to) : null;
    if (promoFrom && promoTo && promoTo <= promoFrom) return { error: `${label}koniec promocji musi być po jej początku.` };

    const supplierId = v.supplier_id ? Number(v.supplier_id) : null;
    const purchase = parseDecimal(v.purchase_price);
    if (Number.isNaN(purchase)) return { error: `${label}nieprawidłowa cena zakupu.` };

    variants.push({
      id: v.id ? Number(v.id) : null,
      row: {
        name: text(v.name, 60),
        sku: text(v.sku, 60),
        ean: ean || null,
        price,
        stock,
        net_quantity: net,
        unit,
        promo_price: promoPrice,
        promo_from: promoFrom,
        promo_to: promoTo,
        active: v.active !== false,
        sort: i,
      },
      // daty niezmienione w formularzu zostają co do sekundy (bez szumu w historii cen)
      keepPromoFrom: promoPrice !== null && (v.promo_from || '') === (v.promo_from_orig || ''),
      keepPromoTo: promoPrice !== null && (v.promo_to || '') === (v.promo_to_orig || ''),
      supplier: supplierId ? { supplier_id: supplierId, supplier_sku: text(v.supplier_sku, 60), purchase_price: purchase } : null,
    });
  }
  if (!variants.some((v) => v.row.active)) return { error: 'Co najmniej jeden wariant musi być aktywny.' };

  const images = (Array.isArray(input.images) ? input.images : [])
    .filter((im) => im && typeof im.url === 'string' && /^https?:\/\//.test(im.url))
    .slice(0, 30)
    .map((im, i) => ({ id: im.id ? Number(im.id) : null, url: im.url.slice(0, 1000), alt: text(im.alt, 200), sort: i }));

  return {
    data: {
      id: input.id ? Number(input.id) : null,
      product: {
        name,
        slug: slugify(text(input.slug) || name) || `produkt-${Date.now()}`,
        category_id: input.category_id ? Number(input.category_id) : null,
        brand_id: input.brand_id ? Number(input.brand_id) : null,
        description: text(input.description),
        composition: text(input.composition),
        analysis: text(input.analysis),
        additives: text(input.additives),
        dosage: text(input.dosage),
        vat_rate: vat,
        active: input.active !== false,
        image_url: images[0]?.url || null,
      },
      newBrand: text(input.new_brand, 100),
      variants,
      images,
      valueIds: [...new Set((Array.isArray(input.value_ids) ? input.value_ids : []).map(Number).filter(Boolean))],
    },
  };
}

function friendly(error) {
  if (needsSql(error)) return SQL_HINT;
  if (error.code === '23505') {
    if (/ean/i.test(error.message)) return 'Ten EAN ma już inny produkt w sklepie.';
    if (/sku/i.test(error.message)) return 'Ten kod hurtowni jest już przypisany do innego produktu.';
    if (/slug/i.test(error.message)) return 'Produkt o takim adresie (slug) już istnieje. Zmień nazwę lub adres.';
    return 'Taka wartość już istnieje w bazie.';
  }
  return error.message;
}

export async function saveProduct(prevState, formData) {
  const supabase = await adminClient();
  let input;
  try {
    input = JSON.parse(String(formData.get('payload') || '{}'));
  } catch {
    return { error: 'Nie udało się odczytać formularza. Odśwież stronę.' };
  }
  const { error: invalid, data } = validate(input);
  if (invalid) return { error: invalid };

  // Nowa marka wpisana z ręki
  if (data.newBrand) {
    const { data: found } = await supabase.from('brands').select('id').ilike('name', data.newBrand).maybeSingle();
    if (found) {
      data.product.brand_id = found.id;
    } else {
      const { data: created, error } = await supabase.from('brands')
        .insert({ name: data.newBrand, slug: slugify(data.newBrand) || `marka-${Date.now()}` })
        .select('id').single();
      if (error) return { error: friendly(error) };
      data.product.brand_id = created.id;
    }
  }

  // 1. Produkt
  let productId = data.id;
  if (productId) {
    const { error } = await supabase.from('products').update(data.product).eq('id', productId);
    if (error) return { error: friendly(error) };
  } else {
    const first = data.variants[0].row;
    const { data: created, error } = await supabase.from('products')
      .insert({ ...data.product, price: first.price, stock: first.stock })
      .select('id').single();
    if (error) return { error: friendly(error) };
    productId = created.id;
    // baza sama dodaje jeden wariant do nowego produktu - wykorzystujemy go jako pierwszy
    const { data: auto } = await supabase.from('product_variants').select('id').eq('product_id', productId).limit(1);
    if (auto?.[0]) data.variants[0].id = auto[0].id;
  }

  // 2. Warianty: najpierw usunięte (zwalnia EAN), potem zmiany i nowe
  const { data: existing, error: exErr } = await supabase.from('product_variants')
    .select('id, promo_price, promo_from, promo_to, variant_suppliers(supplier_id, is_main)').eq('product_id', productId);
  if (exErr) return { error: friendly(exErr), productId };
  const keepIds = new Set(data.variants.map((v) => v.id).filter(Boolean));
  const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
  if (toDelete.length) {
    const { error } = await supabase.from('product_variants').delete().in('id', toDelete);
    if (error) return { error: friendly(error) };
  }

  const existingById = new Map(existing.map((e) => [e.id, e]));
  for (const v of data.variants) {
    const old = v.id ? existingById.get(v.id) : null;
    if (old?.promo_price != null) {
      if (v.keepPromoFrom) v.row.promo_from = old.promo_from;
      if (v.keepPromoTo) v.row.promo_to = old.promo_to;
    }
    if (old) {
      const { error } = await supabase.from('product_variants').update(v.row).eq('id', v.id);
      if (error) return { error: friendly(error) };
    } else {
      const { data: created, error } = await supabase.from('product_variants')
        .insert({ ...v.row, product_id: productId }).select('id').single();
      if (error) return { error: friendly(error) };
      v.id = created.id;
    }

    // 3. Hurtownia główna wariantu
    const oldMain = old?.variant_suppliers?.find((s) => s.is_main);
    if (v.supplier) {
      if (oldMain && oldMain.supplier_id !== v.supplier.supplier_id) {
        await supabase.from('variant_suppliers').update({ is_main: false })
          .eq('variant_id', v.id).eq('supplier_id', oldMain.supplier_id);
      }
      const { error } = await supabase.from('variant_suppliers').upsert({
        variant_id: v.id, ...v.supplier, is_main: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'variant_id,supplier_id' });
      if (error) return { error: friendly(error) };
    } else if (oldMain) {
      await supabase.from('variant_suppliers').delete().eq('variant_id', v.id).eq('supplier_id', oldMain.supplier_id);
    }
  }

  // 4. Cechy
  {
    const { error } = await supabase.from('product_attribute_values').delete().eq('product_id', productId);
    if (error) return { error: friendly(error) };
    if (data.valueIds.length) {
      const { error: insErr } = await supabase.from('product_attribute_values')
        .insert(data.valueIds.map((value_id) => ({ product_id: productId, value_id })));
      if (insErr) return { error: friendly(insErr) };
    }
  }

  // 5. Galeria
  {
    const { data: oldImages, error } = await supabase.from('product_images').select('id, url').eq('product_id', productId);
    if (error) return { error: friendly(error) };
    const keep = new Set(data.images.map((im) => im.id).filter(Boolean));
    const removed = oldImages.filter((im) => !keep.has(im.id));
    if (removed.length) {
      await supabase.from('product_images').delete().in('id', removed.map((im) => im.id));
      await removeFiles(supabase, removed.map((im) => im.url), data.images.map((im) => im.url));
    }
    for (const im of data.images) {
      if (im.id && oldImages.some((o) => o.id === im.id)) {
        await supabase.from('product_images').update({ sort: im.sort, alt: im.alt }).eq('id', im.id);
      } else {
        await supabase.from('product_images').insert({ product_id: productId, url: im.url, alt: im.alt, sort: im.sort });
      }
    }
  }

  revalidatePath('/', 'layout');
  redirect(`/admin/produkty/${productId}?zapisano=1`);
}

// Usuwa pliki z magazynu Supabase (tylko nasze, i tylko gdy nie są użyte gdzie indziej)
async function removeFiles(supabase, urls, stillUsed = []) {
  const paths = [];
  for (const url of urls) {
    if (stillUsed.includes(url)) continue;
    const i = url.indexOf(BUCKET_MARK);
    if (i === -1) continue;
    const path = decodeURIComponent(url.slice(i + BUCKET_MARK.length));
    const { count } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('url', url);
    if (!count) paths.push(path);
  }
  if (paths.length) await supabase.storage.from('produkty').remove(paths);
}

export async function deleteProduct(formData) {
  const supabase = await adminClient();
  const id = Number(formData.get('id'));
  const { data: images } = await supabase.from('product_images').select('url').eq('product_id', id);
  const { data: product } = await supabase.from('products').select('image_url').eq('id', id).maybeSingle();
  await supabase.from('products').delete().eq('id', id);
  const urls = [...new Set([...(images || []).map((i) => i.url), product?.image_url].filter(Boolean))];
  await removeFiles(supabase, urls);
  revalidatePath('/', 'layout');
  redirect('/admin/produkty');
}

// Szybkie ukrycie / pokazanie produktu z listy
export async function toggleProduct(formData) {
  const supabase = await adminClient();
  await supabase.from('products').update({ active: formData.get('active') === 'true' }).eq('id', Number(formData.get('id')));
  revalidatePath('/', 'layout');
}

// Kopia produktu (np. ten sam smak innej marki) - jako ukryty szkic
export async function duplicateProduct(formData) {
  const supabase = await adminClient();
  const id = Number(formData.get('id'));
  const { data: p, error } = await supabase.from('products')
    .select('*, product_variants(*), product_images(url, alt, sort), product_attribute_values(value_id)')
    .eq('id', id).single();
  if (error) throw new Error(friendly(error));

  const { id: _id, created_at, updated_at, product_variants, product_images, product_attribute_values, ...rest } = p;
  const variants = [...product_variants].sort((a, b) => a.sort - b.sort);
  const { data: copy, error: insErr } = await supabase.from('products')
    .insert({ ...rest, name: `${p.name} (kopia)`, slug: `${p.slug}-kopia-${Date.now().toString(36)}`, active: false })
    .select('id').single();
  if (insErr) throw new Error(friendly(insErr));

  const { data: auto } = await supabase.from('product_variants').select('id').eq('product_id', copy.id);
  for (const [i, v] of variants.entries()) {
    const row = {
      name: v.name, sku: '', ean: null, price: v.price, stock: 0, net_quantity: v.net_quantity,
      unit: v.unit, active: v.active, sort: v.sort,
    };
    if (i === 0 && auto?.[0]) await supabase.from('product_variants').update(row).eq('id', auto[0].id);
    else await supabase.from('product_variants').insert({ ...row, product_id: copy.id });
  }
  if (product_images.length) {
    await supabase.from('product_images').insert(product_images.map((im) => ({ ...im, product_id: copy.id })));
  }
  if (product_attribute_values.length) {
    await supabase.from('product_attribute_values')
      .insert(product_attribute_values.map((a) => ({ product_id: copy.id, value_id: a.value_id })));
  }
  revalidatePath('/admin/produkty');
  redirect(`/admin/produkty/${copy.id}?kopia=1`);
}
