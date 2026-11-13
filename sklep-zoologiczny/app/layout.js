import Link from 'next/link';
import { Suspense } from 'react';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import CartBadge from '@/components/CartBadge';
import SearchBox from '@/components/SearchBox';
import { getSettings } from '@/lib/settings';

export async function generateMetadata() {
  const s = await getSettings();
  return {
    title: s.shop_name,
    description: 'Karma i akcesoria dla psów, kotów, gryzoni, ptaków i ryb.',
  };
}

export default async function RootLayout({ children }) {
  const s = await getSettings();

  return (
    <html lang="pl">
      <body>
        <CartProvider>
          {!s.sales_enabled && (
            <div className="soon-bar">Sklep wkrótce! Możesz już oglądać produkty, zamówienia ruszą niebawem.</div>
          )}
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="logo">🐾 {s.shop_name}</Link>
              <Suspense fallback={<div className="searchbox" />}>
                <SearchBox />
              </Suspense>
              <CartBadge />
            </div>
          </header>
          <main className="container main">{children}</main>
          <footer className="site-footer">
            <div className="container footer-inner">
              <div>
                <strong>{s.shop_name}</strong>
                {s.company_name && (
                  <p>
                    {s.company_name}
                    {s.address && <><br />{s.address}, {s.postal_code} {s.city}</>}
                    {(s.nip || s.regon) && (
                      <><br />{s.nip && <>NIP {s.nip}</>}{s.nip && s.regon && ' · '}{s.regon && <>REGON {s.regon}</>}</>
                    )}
                  </p>
                )}
              </div>
              {(s.email || s.phone) && (
                <div>
                  <strong>Kontakt</strong>
                  <p>
                    {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
                    {s.email && s.phone && <br />}
                    {s.phone && <a href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a>}
                  </p>
                </div>
              )}
              <div className="footer-copy">© {new Date().getFullYear()} {s.shop_name}</div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
