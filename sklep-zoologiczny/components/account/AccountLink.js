'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Link w nagłówku: "Zaloguj" albo "Konto". Stan sesji czytany w przeglądarce (nagłówek zostaje statyczny).
export default function AccountLink() {
  const [logged, setLogged] = useState(null);
  useEffect(() => {
    let supabase;
    try { supabase = createClient(); } catch { return undefined; }
    supabase.auth.getSession().then(({ data }) => setLogged(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setLogged(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <Link href={logged ? '/konto' : '/konto/logowanie'} className="account-link" aria-label={logged ? 'Moje konto' : 'Zaloguj się'}>
      👤 <span className="account-link-text">{logged === null ? '' : logged ? 'Konto' : 'Zaloguj'}</span>
    </Link>
  );
}
