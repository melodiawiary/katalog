'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext(null);
const KEY = 'koszyk-v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) setItems(saved);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, loaded]);

  function add(product, quantity = 1) {
    setItems((current) => {
      const found = current.find((i) => i.id === product.id);
      if (found) {
        return current.map((i) =>
          i.id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock ?? 99) } : i
        );
      }
      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: Number(product.price),
          image_url: product.image_url,
          stock: product.stock,
          quantity,
        },
      ];
    });
  }

  function setQuantity(id, quantity) {
    setItems((current) =>
      current
        .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, Math.min(quantity, i.stock ?? 99)) } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function remove(id) {
    setItems((current) => current.filter((i) => i.id !== id));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, loaded, count, subtotal, add, setQuantity, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
