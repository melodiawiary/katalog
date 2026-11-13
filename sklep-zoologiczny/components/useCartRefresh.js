'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from './CartProvider';
import { refreshCart } from '@/app/koszyk/actions';

// Raz po wejściu na stronę koszyka / zamówienia: pobiera aktualne ceny i stany z bazy.
// Zwraca true, gdy dane są już sprawdzone.
export function useCartRefresh() {
  const { items, loaded, sync } = useCart();
  const started = useRef(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    if (items.length === 0) {
      setChecked(true);
      return;
    }
    refreshCart(items.map(({ key, product_id, variant_id }) => ({ key, product_id, variant_id })))
      .then(sync)
      .catch(() => {})
      .finally(() => setChecked(true));
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return checked;
}

export const UNAVAILABLE = {
  brak: 'Chwilowo brak na stanie',
  wariant: 'Wybierz wariant (np. wielkość opakowania) na stronie produktu',
  usuniety: 'Produkt nie jest już dostępny',
};

// Link do produktu z koszyka (z wybranym wariantem)
export function itemHref(i) {
  return `/produkt/${i.slug}${i.key?.startsWith('v:') && i.variant_id ? `?wariant=${i.variant_id}` : ''}`;
}
