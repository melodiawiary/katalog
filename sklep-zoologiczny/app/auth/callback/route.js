// Powrót z logowania przez Google (albo z awaryjnego maila Supabase): wymiana kodu na sesję.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { afterLogin, safeNext } from '@/lib/account';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      await afterLogin(supabase, data.user);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL(`/konto/logowanie?blad=1&next=${encodeURIComponent(next)}`, url.origin));
}
