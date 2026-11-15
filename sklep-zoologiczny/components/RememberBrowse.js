'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const KEY = 'sklep-ostatni-widok';
const isBrowse = (p) => p === '/sklep' || p.startsWith('/kategoria/');

// Zapamiętuje ostatnią kategorię, filtry i sortowanie (w adresie strony) i przywraca je,
// gdy klient wraca do sklepu z innej strony. Kliknięcie "Sklep" lub "Wszystko" będąc w sklepie czyści wybór.
export default function RememberBrowse() {
  const path = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const prev = useRef(null);

  useEffect(() => {
    const was = prev.current;
    prev.current = path;
    try {
      const params = new URLSearchParams(search.toString());
      params.delete('strona');
      const qs = params.toString();
      const current = qs ? `${path}?${qs}` : path;

      if (path === '/sklep' && !qs && !(was && isBrowse(was))) {
        const saved = window.localStorage.getItem(KEY);
        if (saved && saved !== '/sklep' && isBrowse(saved.split('?')[0])) {
          router.replace(saved);
          return;
        }
      }
      if (isBrowse(path)) window.localStorage.setItem(KEY, current);
    } catch {}
  }, [path, search, router]);

  return null;
}
