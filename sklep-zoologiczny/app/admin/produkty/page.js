import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';
import { categoryTree, categoryWithDescendants } from '@/lib/categories';
import { needsSql, SQL_HINT, cleanSearch, promoActive } from '@/lib/admin';
import { toggleProduct } from './actions';

export const metadata = { title: 'Produkty' };

const PER_PAGE = 30;
const FILTERS = {
  '': 'Wszystkie',
  aktywne: 'Widoczne',
  ukryte: 'Ukryte / szkice',
  brak: 'Brak na stanie',
  malo: 'Kończą się (1-3)',
  promocja: 'Promocje',
  'bez-zdjecia': 'Bez zdjęcia',
};
const SORTS = {
  nowe: 'Najnowsze',
  nazwa: 'Nazwa A-Z',
  'cena-rosnaco': 'Cena rosnąco',
  'cena-malejaco': 'Cena malejąco',
  stan: 'Stan rosnąco',
};

function buildHref(params, changes) {
  const next = { ...params, ...changes };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  const s = qs.toString();
  return `/admin/produkty${s ? `?${s}` : ''}`;
}

export default async function AdminProductsPage({ searchParams }) {
  const sp = await searchParams;
  const params = {
    q: cleanSearch(sp.q),
    filtr: FILTERS[sp.filtr] ? sp.filtr : '',
    kat: sp.kat || '',
    marka: sp.marka || '',
    sort: SORTS[sp.sort] ? sp.sort : '',
  };
  const page = Math.max(1, Number(sp.strona) || 1);
  const supabase = await createClient();

  const [{ data: categories }, brandsRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('brands').select('id, name').order('name'),
  ]);
  const brands = brandsRes.data || [];
  const newDb = !needsSql(brandsRes.error);

  // Produkty pasujące po EAN / SKU / kodzie hurtowni / marce / promocji (szukane w innych tabelach)
  let extraIds = null;
  let brandIds = [];
  if (params.q && newDb) {
    const like = `%${params.q}%`;
    const [byVariant, bySupplier] = await Promise.all([
      supabase.from('product_variants').select('product_id').or(`ean.ilike.${like},sku.ilike.${like},name.ilike.${like}`).limit(200),
      supabase.from('variant_suppliers').select('product_variants(product_id)').ilike('supplier_sku', like).limit(200),
    ]);
    extraIds = [
      ...(byVariant.data || []).map((r) => r.product_id),
      ...(bySupplier.data || []).map((r) => r.product_variants?.product_id),
    ].filter(Boolean);
    brandIds = brands.filter((b) => b.name.toLowerCase().includes(params.q.toLowerCase())).map((b) => b.id);
  }
  let promoIds = null;
  if (params.filtr === 'promocja' && newDb) {
    const { data } = await supabase.from('product_variants')
      .select('product_id, price, promo_price, promo_from, promo_to').not('promo_price', 'is', null);
    promoIds = [...new Set((data || []).filter((v) => promoActive(v)).map((v) => v.product_id))];
  }

  const select = newDb
    ? '*, categories(name, emoji), brands(name), product_variants(id, name, price, promo_price, promo_from, promo_to, stock, active)'
    : '*, categories(name, emoji)';
  let query = supabase.from('products').select(select, { count: 'exact' });

  if (params.q) {
    const ors = [`name.ilike.%${params.q}%`, `slug.ilike.%${params.q}%`];
    const ids = [...new Set(extraIds || [])].slice(0, 300);
    if (ids.length) ors.push(`id.in.(${ids.join(',')})`);
    if (brandIds.length) ors.push(`brand_id.in.(${brandIds.join(',')})`);
    query = query.or(ors.join(','));
  }
  if (params.filtr === 'aktywne') query = query.eq('active', true);
  if (params.filtr === 'ukryte') query = query.eq('active', false);
  if (params.filtr === 'brak') query = query.eq('stock', 0);
  if (params.filtr === 'malo') query = query.gte('stock', 1).lte('stock', 3);
  if (params.filtr === 'bez-zdjecia') query = query.is('image_url', null);
  if (promoIds) query = query.in('id', promoIds.length ? promoIds : [0]);
  if (params.kat === 'brak') query = query.is('category_id', null);
  else if (params.kat) query = query.in('category_id', categoryWithDescendants(categories || [], Number(params.kat)));
  if (params.marka && newDb) query = params.marka === 'brak' ? query.is('brand_id', null) : query.eq('brand_id', Number(params.marka));

  const order = {
    nazwa: ['name', true], 'cena-rosnaco': ['price', true], 'cena-malejaco': ['price', false], stan: ['stock', true],
  }[params.sort] || ['created_at', false];
  query = query.order(order[0], { ascending: order[1] }).order('id', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const { data: products, count, error } = await query;
  const pages = Math.max(1, Math.ceil((count || 0) / PER_PAGE));
  const filtered = params.q || params.filtr || params.kat || params.marka;

  return (
    <>
      <div className="title-row">
        <h1>Produkty <span className="muted">({count ?? 0})</span></h1>
        <Link href="/admin/produkty/nowy" className="btn">+ Dodaj</Link>
      </div>
      {!newDb && <p className="alert">{SQL_HINT}</p>}
      {error && <p className="alert">Błąd: {error.message}</p>}

      <form className="filters" action="/admin/produkty">
        <input name="q" type="search" defaultValue={params.q} placeholder="Szukaj: nazwa, marka, EAN, kod…" />
        <select name="filtr" defaultValue={params.filtr}>
          {Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="kat" defaultValue={params.kat}>
          <option value="">Wszystkie kategorie</option>
          <option value="brak">- bez kategorii -</option>
          {categoryTree(categories || []).map((c) => (
            <option key={c.id} value={c.id}>{'   '.repeat(c.depth)}{c.name}</option>
          ))}
        </select>
        {newDb && (
          <select name="marka" defaultValue={params.marka}>
            <option value="">Wszystkie marki</option>
            <option value="brak">- bez marki -</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select name="sort" defaultValue={params.sort}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k === 'nowe' ? '' : k}>{v}</option>)}
        </select>
        <div className="filters-btns">
          <button className="btn btn-small">Pokaż</button>
          {filtered && <Link href="/admin/produkty" className="link-btn">Wyczyść</Link>}
        </div>
      </form>

      {products?.length === 0 && <p className="muted">{filtered ? 'Nic nie pasuje do wyszukiwania.' : 'Brak produktów.'}</p>}

      <ul className="cart-list">
        {products?.map((p) => {
          const variants = (p.product_variants || []).filter((v) => v.active);
          const promo = variants.some((v) => promoActive(v));
          const prices = variants.map((v) => Number(promoActive(v) ? v.promo_price : v.price));
          const min = prices.length ? Math.min(...prices) : Number(p.price);
          const max = prices.length ? Math.max(...prices) : Number(p.price);
          return (
            <li key={p.id} className={`cart-row admin-row${p.active ? '' : ' row-off'}`}>
              <ProductImage product={p} emoji={p.categories?.emoji} />
              <div className="cart-info">
                <Link href={`/admin/produkty/${p.id}`}><strong>{p.name}</strong></Link>
                <span className="muted">
                  {p.brands?.name ? `${p.brands.name} · ` : ''}{p.categories?.name || 'bez kategorii'}
                  {variants.length > 1 ? ` · ${variants.length} warianty` : ''}
                </span>
                <span className="tags">
                  {!p.active && <span className="status status-anulowane">ukryty</span>}
                  {p.stock === 0 ? <span className="status status-nowe">brak na stanie</span>
                    : <span className="muted">stan: {p.stock}</span>}
                  {promo && <span className="status status-zrealizowane">promocja</span>}
                </span>
              </div>
              <div className="row-end">
                <strong>{min === max ? price(min) : `${price(min)} - ${price(max)}`}</strong>
                <form action={toggleProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={String(!p.active)} />
                  <button className="link-btn">{p.active ? 'Ukryj' : 'Pokaż'}</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <nav className="pager">
          {page > 1 ? <Link href={buildHref(params, { strona: page - 1 > 1 ? String(page - 1) : '' })}>← Poprzednia</Link> : <span />}
          <span className="muted">Strona {page} z {pages}</span>
          {page < pages ? <Link href={buildHref(params, { strona: String(page + 1) })}>Następna →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
