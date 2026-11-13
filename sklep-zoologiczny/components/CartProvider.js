'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'koszyk-v1';

// Pozycja koszyka:
// { key, product_id, variant_id, name, variant_name, slug, price, image_url, stock, quantity, unavailable }
// key: 'v:<id wariantu>' dla produktów z kilkoma wariantami, 'p:<id produktu>' dla produktów z jednym.
// Stare pozycje (sprzed kroku 5: { id, ... } = id produktu) zamieniane są na nowy układ.
function normalize(i) {
  if (!i || typeof i !== 'object') return null;
  if (i.key) return i;
  if (i.id == null) return null;
  return { ...i, key: `p:${i.id}`, product_id: i.id, variant_id: null, variant_name: '' };
}

// Pozycja do koszyka z produktu i wybranego wariantu (variantsCount = liczba aktywnych wariantów)
export function cartItem(product, variant, variantsCount = 1) {
  const multi = variantsCount > 1;
  return {
    key: multi && variant ? `v:${variant.id}` : `p:${product.id}`,
    product_id: product.id,
    variant_id: variant?.id ?? product.variant_id ?? null,
    name: product.name,
    variant_name: multi ? variant?.name || '' : '',
    slug: product.slug,
    price: Number(variant ? variant.effective_price ?? variant.price : product.price),
    image_url: product.image_url,
    stock: variant ? variant.stock : product.stock,
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) setItems(saved.map(normalize).filter(Boolean));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, loaded]);

  // item: wynik cartItem(...) albo stary obiekt produktu { id, name, price, stock, ... }
  function add(item, quantity = 1) {
    const entry = normalize(item);
    if (!entry) return;
    setItems((current) => {
      const found = current.find((i) => i.key === entry.key);
      const max = entry.stock ?? 99;
      if (found) {
        return current.map((i) =>
          i.key === entry.key
            ? { ...i, ...entry, quantity: Math.min(i.quantity + quantity, max, 99), unavailable: false }
            : i
        );
      }
      const { id, quantity: _q, ...rest } = entry;
      return [...current, { ...rest, quantity: Math.min(quantity, max, 99) }];
    });
  }

  function setQuantity(key, quantity) {
    setItems((current) =>
      current
        .map((i) => (i.key === key ? { ...i, quantity: Math.max(0, Math.min(quantity, i.stock ?? 99, 99)) } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function remove(key) {
    setItems((current) => current.filter((i) => i.key !== key));
  }

  function clear() {
    setItems([]);
  }

  // Aktualne ceny i stany z bazy (app/koszyk/actions.js -> refreshCart)
  function sync(updates) {
    if (!updates) return;
    setItems((current) =>
      current.map((i) => {
        const u = updates[i.key];
        if (!u) return i;
        if (u.unavailable) return { ...i, unavailable: u.unavailable };
        const quantity = Math.max(1, Math.min(i.quantity, u.stock, 99));
        return { ...i, ...u, quantity, unavailable: u.stock < 1 ? 'brak' : false };
      })
    );
  }

  const ok = items.filter((i) => !i.unavailable);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = ok.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, loaded, count, subtotal, add, setQuantity, remove, clear, sync }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
