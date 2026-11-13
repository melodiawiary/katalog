'use client';

import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { useCartRefresh, UNAVAILABLE, itemHref } from '@/components/useCartRefresh';
import ProductImage from '@/components/ProductImage';
import { price, FREE_SHIPPING_FROM } from '@/lib/shop';

export default function CartPage() {
  const { items, loaded, subtotal, setQuantity, remove } = useCart();
  useCartRefresh();

  if (!loaded) return null;

  if (items.length === 0) {
    return (
      <div className="center">
        <h1>Koszyk jest pusty</h1>
        <Link href="/" className="btn">Przejdź do zakupów</Link>
      </div>
    );
  }

  const missing = FREE_SHIPPING_FROM - subtotal;
  const blocked = items.some((i) => i.unavailable);

  return (
    <>
      <h1>Koszyk</h1>
      <ul className="cart-list">
        {items.map((i) => (
          <li key={i.key} className={`cart-row${i.unavailable ? ' cart-off' : ''}`}>
            <ProductImage product={i} />
            <div className="cart-info">
              <Link href={itemHref(i)}>{i.name}</Link>
              {i.variant_name && <span className="cart-variant">{i.variant_name}</span>}
              {i.unavailable ? (
                <span className="alert-text small">{UNAVAILABLE[i.unavailable] || UNAVAILABLE.usuniety}</span>
              ) : (
                <span className="muted">{price(i.price)} / szt.</span>
              )}
            </div>
            {!i.unavailable && (
              <>
                <div className="qty">
                  <button onClick={() => setQuantity(i.key, i.quantity - 1)} aria-label="Mniej">−</button>
                  <span>{i.quantity}</span>
                  <button onClick={() => setQuantity(i.key, i.quantity + 1)} aria-label="Więcej"
                    disabled={i.quantity >= Math.min(i.stock ?? 99, 99)}>+</button>
                </div>
                <strong>{price(i.price * i.quantity)}</strong>
              </>
            )}
            <button className="link-btn" onClick={() => remove(i.key)}>Usuń</button>
          </li>
        ))}
      </ul>

      <div className="summary">
        {missing > 0 ? (
          <p className="muted">Do darmowej dostawy brakuje {price(missing)}.</p>
        ) : (
          <p className="ok">Masz darmową dostawę!</p>
        )}
        <p className="total">Razem: {price(subtotal)}</p>
        {blocked && <p className="alert">Usuń z koszyka produkty, których nie możemy teraz wysłać.</p>}
        {blocked ? (
          <button className="btn btn-big" disabled>Przejdź do zamówienia</button>
        ) : (
          <Link href="/zamowienie" className="btn btn-big">Przejdź do zamówienia</Link>
        )}
      </div>
    </>
  );
}
