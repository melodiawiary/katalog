import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel sklepu', robots: { index: false } };

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  const settings = await getSettings();

  return (
    <div className="admin">
      <nav className="admin-nav">
        <Link href="/admin">Zamówienia</Link>
        <Link href="/admin/produkty">Produkty</Link>
        <Link href="/admin/kategorie">Kategorie</Link>
        <Link href="/admin/marki">Marki</Link>
        <Link href="/admin/hurtownie">Hurtownie</Link>
        <Link href="/admin/import">Import</Link>
        <Link href="/admin/ustawienia">Ustawienia</Link>
        {!settings.sales_enabled && <Link href="/admin/ustawienia" className="status status-nowe">Sprzedaż wyłączona</Link>}
        <span className="muted">{user?.email}</span>
        <form action={signOut}><button className="link-btn">Wyloguj</button></form>
      </nav>
      {isAdmin ? children : (
        <p className="alert">
          To konto nie ma uprawnień administratora. Dodaj je w Supabase poleceniem z końca pliku supabase/schema.sql.
        </p>
      )}
    </div>
  );
}
