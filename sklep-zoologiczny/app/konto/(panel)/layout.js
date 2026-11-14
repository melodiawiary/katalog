import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { signOutCustomer } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moje konto', robots: { index: false } };

const LINKS = [
  { href: '/konto', label: 'Konto' },
  { href: '/konto/zamowienia', label: 'Zamówienia' },
  { href: '/konto/zwierzeta', label: 'Moje zwierzęta' },
  { href: '/konto/ulubione', label: 'Ulubione salony' },
  { href: '/konto/przypomnienia', label: 'Przypomnienia o karmie' },
  { href: '/konto/dane', label: 'Moje dane' },
];

export default async function AccountLayout({ children }) {
  const { supabase, user } = await requireUser('/konto');
  // zamówienia złożone wcześniej na ten e-mail (bez konta) dopinają się do konta
  await supabase.rpc('claim_orders');
  return (
    <div className="account">
      <nav className="account-nav" aria-label="Konto">
        {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        <span className="muted account-mail">{user.email}</span>
        <form action={signOutCustomer}><button className="link-btn">Wyloguj</button></form>
      </nav>
      {children}
    </div>
  );
}
