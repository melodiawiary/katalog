'use client';

import { useState } from 'react';
import { useCart } from './CartProvider';

export default function AddToCart({ product, compact = false }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (product.stock < 1) {
    return <button className="btn btn-disabled" disabled>Brak w magazynie</button>;
  }

  function handleClick() {
    add(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button className={`btn ${compact ? 'btn-small' : ''}`} onClick={handleClick}>
      {added ? '✓ Dodano' : 'Do koszyka'}
    </button>
  );
}
