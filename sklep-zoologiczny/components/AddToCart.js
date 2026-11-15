'use client';

import { useState } from 'react';
import { useCart, cartItem } from './CartProvider';

// Szybki przycisk na liście produktów (produkt z jednym wariantem)
export default function AddToCart({ product, compact = false, icon = false }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (product.stock < 1) {
    return <button className="btn btn-disabled btn-small" disabled>Brak</button>;
  }

  function handleClick() {
    add(cartItem(product, null, 1), 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  if (icon) {
    return (
      <button className="btn btn-cart-icon" onClick={handleClick} aria-label={added ? 'Dodano do koszyka' : `Do koszyka: ${product.name}`}>
        {added ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h3l2.600 11.200a2 2 0 0 0 2 1.500h7.600a2 2 0 0 0 2-1.500L21 7H6" /><circle cx="10" cy="20" r="1.500" /><circle cx="17" cy="20" r="1.500" /></svg>
        )}
      </button>
    );
  }

  return (
    <button className={`btn ${compact ? 'btn-small' : ''}`} onClick={handleClick}>
      {added ? '✓ Dodano' : 'Do koszyka'}
    </button>
  );
}
