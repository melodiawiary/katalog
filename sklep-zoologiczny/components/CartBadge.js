'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartBadge() {
  const { count } = useCart();
  return (
    <Link href="/koszyk" className="cart-link" aria-label="Koszyk">
      🛒 <span className="badge">{count}</span>
    </Link>
  );
}
