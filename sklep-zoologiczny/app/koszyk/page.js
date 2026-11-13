'use client';

import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import ProductImage from '@/components/ProductImage';
import { price, FREE_SHIPPING_FROM } from '@/lib/shop';

export default function CartPage() {
  const { items, loaded, subtotal, setQuantity, remove } = useCart();

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

  return (
    <>
      <h1>Koszyk</h1>
      <ul className="cart-list">
        {items.map((i) => (
          <li key={i.id} className="cart-row">
            <ProductImage product={i} />
            <div className="cart-info">
              <Link href={`/produkt/${i.slug}`}>{i.name}</Link>
              <span className="muted">{price(i.price)} / szt.</span>
            </div>
            <div className="qty">
              <button onClick={() => setQuantity(i.id, i.quantity - 1)} aria-label="Mniej">−</button>
              <span>{i.quantity}</span>
              <button onClick={() => setQuantity(i.id, i.quantity + 1)} aria-label="Więcej">+</button>
            </div>
            <strong>{price(i.price * i.quantity)}</strong>
            <button className="link-btn" onClick={() => remove(i.id)}>Usuń</button>
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
        <Link href="/zamowienie" className="btn btn-big">Przejdź do zamówienia</Link>
      </div>
    </>
  );
}
