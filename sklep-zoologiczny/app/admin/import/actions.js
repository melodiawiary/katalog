'use server';

// Import z hurtowni: zapis ustawień, partie wierszy (podgląd i zapis), zdjęcia z linków
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { runStockAlerts } from '@/lib/order-mail';
import sharp from 'sharp';
import { adminClient } from '@/lib/admin-server';
import { needsSql } from '@/lib/admin';

const IMPORT_SQL_HINT = 'Baza nie ma jeszcze funkcji importu. Wklej w Supabase plik supabase/03_import.sql (SQL Editor -> New query -> Run) i spróbuj ponownie.';

function friendly(error) {
  if (needsSql(error)) return IMPORT_SQL_HINT;
  return error.message;
}

// Dopisuje ustawienia importu do hurtowni (dopasowanie kolumn, kategorii, reguła ceny, ostatni import)
export async function saveImportSettings(supplierId, patch) {
  const supabase = await adminClient();
  const { data: s, error } = await supabase.from('suppliers').select('import_settings').eq('id', Number(supplierId)).single();
  if (error) return { error: friendly(error) };
  const current = s.import_settings || {};
  const next = { ...current, ...patch };
  if (patch.categories) next.categories = { ...(current.categories || {}), ...patch.categories };
  const { error: upErr } = await supabase.from('suppliers').update({ import_settings: next }).eq('id', Number(supplierId));
  if (upErr) return { error: friendly(upErr) };
  return { ok: true };
}

// Jedna partia wierszy. apply = false: tylko podgląd (nic nie zapisuje)
export async function importBatch(supplierId, rows, options, apply) {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc('import_batch', {
    p_supplier: Number(supplierId),
    p_rows: rows,
    p_options: { update_price: !!options.update_price, update_stock: !!options.update_stock },
    p_apply: !!apply,
  });
  if (error) return { error: friendly(error) };
  return { results: data };
}

// Pozycje hurtowni, których nie było w pliku: stan 0 (apply = false tylko liczy)
export async function importZeroMissing(supplierId, seenVariantIds, updateStock, apply) {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc('import_zero_missing', {
    p_supplier: Number(supplierId),
    p_seen: seenVariantIds.map(Number),
    p_update_stock: !!updateStock,
    p_apply: !!apply,
  });
  if (error) return { error: friendly(error) };
  return { count: data };
}

export async function importFinished() {
  const supabase = await adminClient();
  revalidatePath('/', 'layout');
  // po imporcie stany mogły wrócić: "Produkt znów dostępny" wychodzi sam
  const site = await siteUrl(await getSettings());
  after(() => runStockAlerts(site, supabase).catch(() => {}));
}

// ---------- ZDJĘCIA Z LINKÓW ----------

const MAX_BYTES = 15 * 1024 * 1024;

// Tylko zwykłe adresy w internecie (nie sieć lokalna serwera)
function allowedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (!['http:', 'https:'].includes(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '[::1]') return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  return true;
}

async function downloadImage(url) {
  if (!allowedUrl(url)) throw new Error('niedozwolony adres');
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'user-agent': 'Mozilla/5.0 (sklep-zoologiczny import)' },
  });
  if (!res.ok) throw new Error(`serwer odpowiedział ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (type && !type.startsWith('image/') && !type.includes('octet-stream')) throw new Error('to nie jest zdjęcie');
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new Error('plik za duży');
  const input = Buffer.from(await res.arrayBuffer());
  if (input.length > MAX_BYTES) throw new Error('plik za duży');
  // max 1600 px, JPEG na białym tle (tak jak zdjęcia wgrywane w panelu)
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

// items: [{ product_id, urls: [...] }] - zdjęcia trafiają tylko do produktów, które nie mają jeszcze żadnego
export async function importImages(items) {
  const supabase = await adminClient();
  const report = [];
  for (const item of items.slice(0, 10)) {
    const productId = Number(item.product_id);
    const { count } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId);
    if (count) { report.push({ product_id: productId, added: 0, skipped: true }); continue; }

    const { data: product } = await supabase.from('products').select('name, image_url').eq('id', productId).maybeSingle();
    if (!product) continue;
    let added = 0;
    const errors = [];
    const urls = [...new Set(item.urls || [])].slice(0, 8);
    for (const [n, url] of urls.entries()) {
      try {
        const jpg = await downloadImage(url);
        const path = `import/${productId}/${Date.now().toString(36)}-${n}.jpg`;
        const { error: upErr } = await supabase.storage.from('produkty').upload(path, jpg, { contentType: 'image/jpeg' });
        if (upErr) throw new Error(upErr.message);
        const publicUrl = supabase.storage.from('produkty').getPublicUrl(path).data.publicUrl;
        await supabase.from('product_images').insert({ product_id: productId, url: publicUrl, alt: product.name, sort: added });
        if (added === 0 && !product.image_url) {
          await supabase.from('products').update({ image_url: publicUrl }).eq('id', productId);
        }
        added += 1;
      } catch (e) {
        errors.push(`${url}: ${e.message || e}`);
      }
    }
    report.push({ product_id: productId, added, errors });
  }
  return { report };
}
