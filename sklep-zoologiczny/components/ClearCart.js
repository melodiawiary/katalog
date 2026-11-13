'use client';

import { useEffect } from 'react';
import { useCart } from './CartProvider';

export default function ClearCart() {
  const { clear, loaded } = useCart();
  useEffect(() => {
    if (loaded) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  return null;
}
