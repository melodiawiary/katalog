import Link from 'next/link';
import AddToCart from '@/components/AddToCart';
import ProductImage from '@/components/ProductImage';
import { price } from '@/lib/shop';
import { plural } from '@/lib/browse';

const UNIT = { kg: 'kg', l: 'l' };

// Karta produktu na liście (dane z funkcji search_products)
export default function ProductCard({ p }) {
  const href = `/produkt/${p.slug}`;
  const many = p.variants > 1;
  const reduced = p.regular_price != null && Number(p.regular_price) > Number(p.price);
  const soldOut = p.stock < 1;

  return (
    <article className={`card${soldOut ? ' card-off' : ''}`}>
      <Link href={href} className="card-img">
        <ProductImage product={p} emoji={p.emoji} />
        {p.promo && <span className="tag tag-promo">Promocja</span>}
        {soldOut && <span className="tag tag-out">Chwilowo brak</span>}
      </Link>
      <div className="card-body">
        {p.brand && <span className="card-brand">{p.brand}</span>}
        <Link href={href} className="card-title">{p.name}</Link>
        <div className="card-price">
          {reduced && <s className="muted">{price(p.regular_price)}</s>}
          <strong className="price">{many && !reduced ? 'od ' : ''}{price(p.price)}</strong>
          {p.unit_price != null && UNIT[p.unit] && (
            <span className="unit-price">{price(p.unit_price)} / {UNIT[p.unit]}</span>
          )}
          {reduced && p.lowest_30d != null && (
            <span className="omnibus">Najniższa cena z 30 dni przed obniżką: {price(p.lowest_30d)}</span>
          )}
        </div>
        <div className="card-footer">
          {many ? (
            <Link href={href} className="btn btn-small btn-light">Wybierz: {p.variants} {plural(p.variants, 'wariant', 'warianty', 'wariantów')}</Link>
          ) : (
            <AddToCart
              product={{ id: p.id, name: p.name, slug: p.slug, price: p.price, image_url: p.image_url, stock: p.stock }}
              compact
            />
          )}
        </div>
      </div>
    </article>
  );
}
