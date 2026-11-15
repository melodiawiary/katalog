'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './CartProvider';

// Dolny pasek nawigacji na telefonie: pięć dużych przycisków zawsze pod kciukiem.
export default function MobileTabs({ showSalons }) {
  const pathname = usePathname() || '/';
  const { count } = useCart();

  const tabs = [
    { href: '/', icon: '🏠', label: 'Start', match: (p) => p === '/' },
    { href: '/sklep', icon: '🛍️', label: 'Sklep', match: (p) => p.startsWith('/sklep') || p.startsWith('/kategoria') || p.startsWith('/produkt') || p.startsWith('/szukaj') },
    ...(showSalons ? [{ href: '/salony', icon: '✂️', label: 'Groomerzy', match: (p) => p.startsWith('/salony') }] : []),
    { href: '/akademia', icon: '🎓', label: 'Akademia', match: (p) => p.startsWith('/akademia') },
    { href: '/konto', icon: '👤', label: 'Konto', match: (p) => p.startsWith('/konto') },
    { href: '/koszyk', icon: '🛒', label: 'Koszyk', badge: count, match: (p) => p.startsWith('/koszyk') || p.startsWith('/zamowienie') },
  ];

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="tabbar" aria-label="Menu główne">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={t.match(pathname) ? 'tab active' : 'tab'} aria-current={t.match(pathname) ? 'page' : undefined}>
          <span className="tab-icon">{t.icon}{t.badge > 0 && <span className="tab-badge">{t.badge}</span>}</span>
          <span className="tab-label">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
