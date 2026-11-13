import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AddToCart from '@/components/AddToCart';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';

export const dynamic = 'force-dynamic';

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

  return (
    <div className="product-page">
      <ProductImage product={product} emoji={product.categories?.emoji} />
      <div>
        {product.categories && (
          <Link href={`/?kategoria=${product.categories.slug}`} className="muted">
            {product.categories.emoji} {product.categories.name}
          </Link>
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
