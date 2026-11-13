'use client';

import { useState } from 'react';
import { useCart, cartItem } from './CartProvider';

// Szybki przycisk na liście produktów (produkt z jednym wariantem)
export default function AddToCart({ product, compact = false }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (product.stock < 1) {
    return <button className="btn btn-disabled" disabled>Brak w magazynie</button>;
  }

  function handleClick() {
    add(cartItem(product, null, 1), 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button className={`btn ${compact ? 'btn-small' : ''}`} onClick={handleClick}>
      {added ? '✓ Dodano' : 'Do koszyka'}
    </button>
  );
}
