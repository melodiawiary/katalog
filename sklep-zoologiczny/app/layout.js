import Link from 'next/link';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import CartBadge from '@/components/CartBadge';
import { SHOP_NAME } from '@/lib/shop';

export const metadata = {
  title: SHOP_NAME,
  description: 'Karma i akcesoria dla psów, kotów, gryzoni, ptaków i ryb.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>
        <CartProvider>
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="logo">🐾 {SHOP_NAME}</Link>
              <CartBadge />
            </div>
          </header>
          <main className="container main">{children}</main>
          <footer className="site-footer">
            <div className="container">
              © {new Date().getFullYear()} {SHOP_NAME}
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
                <> · <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL}</a></>
              )}
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
