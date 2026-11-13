// Paczkomaty InPost do mapy w zamówieniu (publiczne API punktów InPost, bez klucza).
//   ?lat=54.35&lng=18.64&r=3000  - najbliższe wokół punktu (r w metrach, max 20 km)
//   ?q=80-001 | ?q=GDA01M | ?q=Gdańsk Długa  - kod pocztowy, kod paczkomatu albo adres
import { NextResponse } from 'next/server';

const POINTS = 'https://api-shipx-pl.easypack24.net/v1/points';
const UA = 'sklep-zoologiczny/1.0 (mapa paczkomatow)';

function mapPoint(p) {
  const lat = Number(p?.location?.latitude);
  const lng = Number(p?.location?.longitude);
  if (!p?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const a = p.address || {};
  const d = p.address_details || {};
  const line1 = a.line1 || [d.street, d.building_number].filter(Boolean).join(' ');
  const line2 = a.line2 || [d.post_code, d.city].filter(Boolean).join(' ');
  return {
    id: String(p.name).toUpperCase(),
    lat,
    lng,
    line1,
    line2,
    desc: p.location_description || '',
    hours: p.opening_hours || '',
    is247: Boolean(p.location_247),
    dist: typeof p.distance === 'number' ? p.distance : null,
    ok: !p.status || p.status === 'Operating',
  };
}

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', 'User-Agent': UA, ...(init.headers || {}) }, next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function nearby(params) {
  const url = new URL(POINTS);
  url.searchParams.set('type', 'parcel_locker');
  url.searchParams.set('per_page', '60');
  url.searchParams.set('sort_by', 'distance_to_relative_point');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const data = await getJson(url);
  return (data.items || []).map(mapPoint).filter((p) => p && p.ok);
}

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'public, max-age=600' } });

export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  try {
    const q = String(sp.get('q') || '').trim().slice(0, 100);

    if (q) {
      // kod pocztowy
      const pc = /^(\d{2})-?(\d{3})$/.exec(q);
      if (pc) {
        const points = await nearby({ relative_post_code: `${pc[1]}-${pc[2]}`, max_distance: '8000' });
        if (!points.length) return json({ points: [], error: 'Nie znaleźliśmy paczkomatów przy tym kodzie.' });
        return json({ points, center: { lat: points[0].lat, lng: points[0].lng } });
      }
      // kod paczkomatu, np. GDA01M, KRA012, WAW123ABC
      if (/^[A-Za-z]{3}\d{2,3}[A-Za-z]{0,4}$/.test(q)) {
        try {
          const p = mapPoint(await getJson(`${POINTS}/${encodeURIComponent(q.toUpperCase())}`));
          if (p) {
            const around = await nearby({ relative_point: `${p.lat},${p.lng}`, max_distance: '2000' }).catch(() => []);
            return json({ points: [p, ...around.filter((x) => x.id !== p.id)], center: { lat: p.lat, lng: p.lng }, exact: p.id });
          }
        } catch {
          // nie ma takiego kodu - szukamy jak adresu
        }
      }
      // adres / miejscowość (OpenStreetMap Nominatim)
      const geo = new URL('https://nominatim.openstreetmap.org/search');
      geo.searchParams.set('format', 'json');
      geo.searchParams.set('limit', '1');
      geo.searchParams.set('countrycodes', 'pl');
      geo.searchParams.set('accept-language', 'pl');
      geo.searchParams.set('q', q);
      const found = await getJson(geo);
      if (!found?.[0]) return json({ points: [], error: 'Nie znaleźliśmy takiego miejsca. Wpisz miasto, ulicę albo kod pocztowy.' });
      const center = { lat: Number(found[0].lat), lng: Number(found[0].lon) };
      const points = await nearby({ relative_point: `${center.lat},${center.lng}`, max_distance: '5000' });
      return json({ points, center });
    }

    const lat = Number(sp.get('lat'));
    const lng = Number(sp.get('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 48 || lat > 56 || lng < 13 || lng > 25) {
      return json({ points: [], error: 'Nieprawidłowe położenie.' }, 400);
    }
    const r = Math.min(Math.max(Number(sp.get('r')) || 3000, 300), 20000);
    const points = await nearby({ relative_point: `${lat.toFixed(5)},${lng.toFixed(5)}`, max_distance: String(Math.round(r)) });
    return json({ points });
  } catch (e) {
    return json({ points: [], error: `Mapa paczkomatów chwilowo nie odpowiada (${e.message}). Spróbuj za chwilę.` }, 502);
  }
}
