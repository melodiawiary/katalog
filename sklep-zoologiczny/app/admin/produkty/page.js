import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name, emoji)')
    .order('created_at', { ascending: false });

  return (
    <>
      <div className="title-row">
        <h1>Produkty</h1>
        <Link href="/admin/produkty/nowy" className="btn">+ Dodaj produkt</Link>
      </div>
      <ul className="cart-list">
        {products?.map((p) => (
          <li key={p.id} className="cart-row">
            <ProductImage product={p} emoji={p.categories?.emoji} />
            <div className="cart-info">
              <Link href={`/admin/produkty/${p.id}`}>{p.name}</Link>
              <span className="muted">
                {p.categories?.name || 'bez kategorii'} · stan: {p.stock} {!p.active && '· ukryty'}
              </span>
            </div>
            <strong>{price(p.price)}</strong>
            <Link href={`/admin/produkty/${p.id}`} className="link-btn">Edytuj</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
