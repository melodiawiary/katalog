// Dane do formularza produktu w panelu (tylko serwer)
import { needsSql, SQL_HINT, isoToWarsawDate } from '@/lib/admin';
import { getSettings } from '@/lib/settings';

const n = (v) => (v == null ? '' : String(v).replace('.', ','));

export async function loadProductFormData(supabase, id = null) {
  const [cats, brands, attrs, sups, settings] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('brands').select('id, name, active').order('name'),
    supabase.from('attributes').select('id, code, name, sort, attribute_values(id, value, sort)').order('sort'),
    supabase.from('suppliers').select('id, name, active').order('name'),
    getSettings(),
  ]);

  const missingSql = [brands.error, attrs.error, sups.error].some(needsSql) ? SQL_HINT : null;
  const result = {
    categories: cats.data || [],
    brands: brands.data || [],
    attributes: (attrs.data || []).map((a) => ({
      ...a,
      values: [...(a.attribute_values || [])].sort((x, y) => x.sort - y.sort),
    })),
    suppliers: (sups.data || []).filter((s) => s.active),
    vatStatus: settings.vat_status || 'zwolniony',
    missingSql,
    product: null,
  };
  if (!id) return result;

  let { data: product, error } = await supabase.from('products')
    .select('*, product_variants(*, variant_suppliers(*)), product_images(id, url, alt, sort), product_attribute_values(value_id)')
    .eq('id', id).maybeSingle();
  if (error && needsSql(error)) {
    ({ data: product } = await supabase.from('products').select('*').eq('id', id).maybeSingle());
  }
  if (!product) return result;

  const variants = [...(product.product_variants || [])].sort((a, b) => a.sort - b.sort || a.id - b.id).map((v) => {
    const main = (v.variant_suppliers || []).find((s) => s.is_main) || v.variant_suppliers?.[0];
    const from = isoToWarsawDate(v.promo_from);
    const to = isoToWarsawDate(v.promo_to, true);
    return {
      id: v.id, name: v.name, sku: v.sku, ean: v.ean || '', price: n(v.price), stock: String(v.stock),
      net_quantity: n(v.net_quantity), unit: v.unit, active: v.active,
      promo_price: n(v.promo_price), promo_from: from, promo_to: to, promo_from_orig: from, promo_to_orig: to,
      supplier_id: main ? String(main.supplier_id) : '', supplier_sku: main?.supplier_sku || '',
      purchase_price: n(main?.purchase_price),
    };
  });
  if (!variants.length) {
    // przed wklejeniem 02_produkty.sql: cena i stan z produktu
    variants.push({ id: null, name: '', price: n(product.price), stock: String(product.stock), unit: 'szt' });
  }

  let images = [...(product.product_images || [])].sort((a, b) => a.sort - b.sort);
  if (product.image_url && !images.some((im) => im.url === product.image_url)) {
    images = [{ id: null, url: product.image_url, alt: '' }, ...images];
  } else if (product.image_url) {
    // zdjęcie główne na początek
    images = [...images.filter((im) => im.url === product.image_url), ...images.filter((im) => im.url !== product.image_url)];
  }

  result.product = {
    ...product,
    variants,
    images: images.map(({ id: imgId, url, alt }) => ({ id: imgId, url, alt: alt || '' })),
    value_ids: (product.product_attribute_values || []).map((a) => a.value_id),
  };
  return result;
}
