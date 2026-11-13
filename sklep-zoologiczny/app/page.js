import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AddToCart from '@/components/AddToCart';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';
import { topCategories, categoryWithDescendants, categoryPath } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const { kategoria, q } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase.from('categories').select('*').order('sort');

  let query = supabase
    .from('products')
    .select('*, categories(name, slug, emoji)')
    .eq('active', true)
    .order('created_at', { ascending: false });

  // ukryte w panelu kategorie (i ich podkategorie) nie pokazują się w menu sklepu
  const hidden = new Set((categories || []).filter((c) => c.active === false).flatMap((c) => categoryWithDescendants(categories, c.id)));
  const all = (categories || []).filter((c) => !hidden.has(c.id));
  const current = all.find((c) => c.slug === kategoria);
  if (current) query = query.in('category_id', categoryWithDescendants(all, current.id));

  // Podkategorie: dzieci wybranej kategorii, a gdy ich nie ma - jej rodzeństwo
  const path = current ? categoryPath(all, current.id) : [];
  const pathIds = new Set(path.map((c) => c.id));
  const childrenOf = (id) => all.filter((c) => c.parent_id === id);
  const subParent = current && childrenOf(current.id).length > 0 ? current : path[path.length - 2];
  const subcategories = subParent ? childrenOf(subParent.id) : [];
  if (q) query = query.ilike('name', `%${q.replace(/[%_,()]/g, ' ')}%`);

  const { data: products, error } = await query;

  return (
    <>
      <form className="search" action="/">
        {current && <input type="hidden" name="kategoria" value={current.slug} />}
        <input type="search" name="q" placeholder="Szukaj produktu…" defaultValue={q || ''} />
        <button className="btn">Szukaj</button>
      </form>

      <nav className="chips">
        <Link href="/" className={!current ? 'chip active' : 'chip'}>Wszystko</Link>
        {topCategories(all).map((c) => (
          <Link key={c.id} href={`/?kategoria=${c.slug}`} className={pathIds.has(c.id) ? 'chip active' : 'chip'}>
            {c.emoji} {c.name}
          </Link>
        ))}
      </nav>

      {subcategories.length > 0 && (
        <nav className="chips">
          <Link href={`/?kategoria=${subParent.slug}`} className={current?.id === subParent.id ? 'chip active' : 'chip'}>
            Wszystko: {subParent.name}
          </Link>
          {subcategories.map((c) => (
            <Link key={c.id} href={`/?kategoria=${c.slug}`} className={pathIds.has(c.id) ? 'chip active' : 'chip'}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {error && <p className="alert">Nie udało się wczytać produktów. Sprawdź konfigurację Supabase.</p>}
      {products && products.length === 0 && <p className="muted">Brak produktów spełniających kryteria.</p>}

      <section className="grid">
        {products?.map((p) => (
          <article key={p.id} className="card">
            <Link href={`/produkt/${p.slug}`}>
              <ProductImage product={p} emoji={p.categories?.emoji} />
            </Link>
            <div className="card-body">
              <Link href={`/produkt/${p.slug}`} className="card-title">{p.name}</Link>
              <div className="card-footer">
                <strong className="price">{price(p.price)}</strong>
                <AddToCart product={p} compact />
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
