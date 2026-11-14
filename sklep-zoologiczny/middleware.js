import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    url.pathname = '/logowanie';
    return NextResponse.redirect(url);
  }

  // panel klienta: bez logowania odsyłamy do logowania i wracamy dokładnie tam, gdzie klient chciał wejść
  const path = request.nextUrl.pathname;
  if (!user && path.startsWith('/konto') && !path.startsWith('/konto/logowanie') && !path.startsWith('/konto/wypisz')) {
    const url = request.nextUrl.clone();
    url.pathname = '/konto/logowanie';
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // sesję klienta odświeżamy tam, gdzie serwer sprawdza, kto jest zalogowany
  matcher: ['/admin/:path*', '/logowanie', '/konto/:path*', '/zamowienie/:path*'],
};
