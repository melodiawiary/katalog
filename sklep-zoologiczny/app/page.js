import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AddToCart from '@/components/AddToCart';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';

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

  const current = categories?.find((c) => c.slug === kategoria);
  if (current) query = query.eq('category_id', current.id);
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
        {categories?.map((c) => (
          <Link key={c.id} href={`/?kategoria=${c.slug}`} className={current?.id === c.id ? 'chip active' : 'chip'}>
            {c.emoji} {c.name}
          </Link>
        ))}
      </nav>

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
