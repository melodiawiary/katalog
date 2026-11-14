import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Przypomnienia o karmie', robots: { index: false } };

// Wypisanie jednym kliknięciem z maila z przypomnieniem (token z profilu, bez logowania)
export default async function UnsubscribePage({ searchParams }) {
  const sp = await searchParams;
  const token = String(sp.t || '');
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('reminders_unsubscribe', { p_token: token });
    ok = Boolean(data);
  }
  return (
    <div className="center">
      <h1>{ok ? 'Wyłączone' : 'Nie udało się wyłączyć'}</h1>
      <p>{ok
        ? 'Nie wyślemy już przypomnień o karmie. Możesz je włączyć z powrotem w koncie.'
        : 'Link jest nieprawidłowy albo wygasł. Wyłączysz przypomnienia po zalogowaniu, w zakładce „Przypomnienia o karmie”.'}</p>
      <Link href="/konto/przypomnienia" className="btn">Moje przypomnienia</Link>
    </div>
  );
}
