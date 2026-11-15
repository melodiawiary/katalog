'use client';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribe, getSnapshot, getServerSnapshot } from '@/lib/wishlist';
import { price } from '@/lib/shop';
import ProductImage from './ProductImage';
import WishHeart from './WishHeart';

// Lista ulubionych (identyfikatory są w przeglądarce, dane produktów z bazy)
export default function WishList() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [items, setItems] = useState(null);
  const key = ids.join(',');

  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    createClient().from('products').select('id,name,slug,price,image_url,stock').in('id', ids).eq('active', true)
      .then(({ data }) => setItems(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items === null) return <p className="muted">Wczytuję…</p>;
  if (!ids.length || !items.length) {
    return <p>Nie masz jeszcze ulubionych. Kliknij serduszko przy produkcie, a pojawi się tutaj. <Link href="/sklep">Przejdź do sklepu</Link>.</p>;
  }
  const shown = ids.map((id) => items.find((p) => p.id === id)).filter(Boolean);
  return (
    <div className="grid product-grid">
      {shown.map((p) => (
        <article key={p.id} className="card">
          <Link href={`/produkt/${p.slug}`} className="card-img">
            <ProductImage product={p} />
            <WishHeart id={p.id} name={p.name} />
          </Link>
          <div className="card-body">
            <Link href={`/produkt/${p.slug}`} className="card-title">{p.name}</Link>
            <strong className="price">{price(p.price)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}
