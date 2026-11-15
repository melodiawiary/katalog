'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './CartProvider';

// Dolny pasek nawigacji na telefonie: pięć dużych przycisków zawsze pod kciukiem.
export default function MobileTabs({ showSalons }) {
  const pathname = usePathname() || '/';
  const { count } = useCart();

  const tabs = [
    { href: '/', icon: 'start', label: 'Start', match: (p) => p === '/' },
    { href: '/sklep', icon: 'sklep', label: 'Sklep', match: (p) => p.startsWith('/sklep') || p.startsWith('/kategoria') || p.startsWith('/produkt') || p.startsWith('/szukaj') },
    { href: '/uslugi', icon: 'uslugi', label: 'Usługi', match: (p) => p.startsWith('/uslugi') || p.startsWith('/salony') || p.startsWith('/weterynarze') || p.startsWith('/hotele') || p.startsWith('/trenerzy') || p.startsWith('/petsitterzy') || p.startsWith('/behawiorysci') || p.startsWith('/spacerowicze') || p.startsWith('/akademia') },
    { href: '/konto', icon: 'konto', label: 'Konto', match: (p) => p.startsWith('/konto') },
    { href: '/koszyk', icon: 'koszyk', label: 'Koszyk', badge: count, match: (p) => p.startsWith('/koszyk') || p.startsWith('/zamowienie') },
  ];

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="tabbar" aria-label="Menu główne">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={t.match(pathname) ? 'tab active' : 'tab'} aria-current={t.match(pathname) ? 'page' : undefined}>
          <span className="tab-icon"><span className="tab-icon-img" style={{ '--ikona': `url(/ikony/${t.icon}.png)` }} />{t.badge > 0 && <span className="tab-badge">{t.badge}</span>}</span>
          <span className="tab-label">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
