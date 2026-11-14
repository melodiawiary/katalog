// Adres -> pozycja dla wyszukiwarki salonów ("Szukaj blisko adresu"). Publiczne, tylko Polska, wynik w pamięci podręcznej.
import { NextResponse } from 'next/server';

export async function GET(request) {
  const q = String(request.nextUrl.searchParams.get('q') || '').trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ error: 'Wpisz miasto, ulicę albo kod pocztowy.' }, { status: 400 });
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'pl');
    url.searchParams.set('accept-language', 'pl');
    url.searchParams.set('q', q);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'sklep-zoologiczny/1.0 (katalog salonow)' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const found = await res.json();
    if (!found?.[0]) return NextResponse.json({ error: 'Nie znaleźliśmy takiego miejsca. Spróbuj inaczej wpisać adres.' }, { status: 404 });
    return NextResponse.json(
      { lat: Number(found[0].lat), lng: Number(found[0].lon), label: String(found[0].display_name || q).split(',').slice(0, 2).join(',') },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch (e) {
    return NextResponse.json({ error: `Wyszukiwanie adresu chwilowo nie działa (${e.message}).` }, { status: 502 });
  }
}
