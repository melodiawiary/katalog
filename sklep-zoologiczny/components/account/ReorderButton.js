'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useCart } from '@/components/CartProvider';
import { reorderItems } from '@/app/konto/actions';

// "Zamów ponownie": dodaje pozycje starego zamówienia do koszyka (aktualne ceny i stany) i otwiera koszyk
export default function ReorderButton({ orderId, label = 'Zamów ponownie' }) {
  const { add } = useCart();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');

  function run() {
    setNote('');
    start(async () => {
      const r = await reorderItems(orderId);
      if (!r.items.length) {
        setNote('Tych produktów nie ma teraz na stanie. Zajrzyj później albo zapisz się na powiadomienie na stronie produktu.');
        return;
      }
      for (const item of r.items) add(item, item.quantity);
      if (r.skipped.length) {
        try { sessionStorage.setItem('reorder-skipped', JSON.stringify(r.skipped)); } catch {}
      }
      router.push('/koszyk');
    });
  }

  return (
    <span className="reorder">
      <button type="button" className="btn btn-small" onClick={run} disabled={pending}>{pending ? 'Dodawanie…' : label}</button>
      {note && <span className="alert small reorder-note">{note}</span>}
    </span>
  );
}
