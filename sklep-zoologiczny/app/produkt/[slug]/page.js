import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AddToCart from '@/components/AddToCart';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';
import { categoryPath } from '@/lib/categories';

export const dynamic = 'force-dynamic';

async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*');
  return data || [];
}

async function getProduct(slug) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('*, categories(name, slug, emoji)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  return { title: product?.name || 'Produkt' };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const path = product.category_id ? categoryPath(await getCategories(), product.category_id) : [];

  return (
    <div className="product-page">
      <ProductImage product={product} emoji={product.categories?.emoji} />
      <div>
        {path.length > 0 && (
          <nav className="muted">
            {path.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ' › '}
                <Link href={`/?kategoria=${c.slug}`}>{i === 0 && `${c.emoji} `}{c.name}</Link>
              </span>
            ))}
          </nav>
        )}
        <h1>{product.name}</h1>
        <p className="price big">{price(product.price)}</p>
        <p className="muted">
          {product.stock > 0 ? `Dostępne: ${product.stock} szt.` : 'Chwilowo niedostępny'}
        </p>
        <AddToCart product={product} />
        {product.description && <p className="description">{product.description}</p>}
      </div>
    </div>
  );
}
