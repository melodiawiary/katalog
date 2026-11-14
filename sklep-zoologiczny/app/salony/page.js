import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { parsePlaces, rpcArgs, priceText } from '@/lib/places-browse';
import { PLACE_KIND } from '@/lib/places';
import PlacesMap from '@/components/places/PlacesMap';
import PlacesFilters from '@/components/places/PlacesFilters';
import { PlaceRating, PlaceBadges } from '@/components/places/Rating';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Salony groomerskie dla psów i kotów',
    description: 'Polecani groomerzy na mapie: Trójmiasto i okolice. Ceny, godziny otwarcia, salony blisko Ciebie.',
  };
}

export default async function SalonyPage({ searchParams }) {
  const sp = await searchParams;
  const f = parsePlaces(sp);
  const supabase = await createClient();

  const [{ data: isPublic }, { data: isAdmin }] = await Promise.all([supabase.rpc('places_public'), supabase.rpc('is_admin')]);

  if (!isPublic && !isAdmin) {
    return (
      <div className="center">
        <h1>Katalog salonów wkrótce</h1>
        <p className="muted">Zbieramy sprawdzonych groomerów z Trójmiasta. Znasz dobry salon? Podpowiedz nam go.</p>
        <Link href="/salony/polec" className="btn">Poleć salon</Link>
      </div>
    );
  }

  const [res, cities, services, features] = await Promise.all([
    supabase.rpc('search_places', rpcArgs(f)),
    supabase.rpc('places_cities'),
    supabase.from('service_defs').select('code, label').order('sort'),
    supabase.from('feature_defs').select('code, label').order('sort'),
  ]);
  const data = res.data || { total: 0, items: [] };
  const items = data.items || [];
  const me = f.lat != null ? { lat: f.lat, lng: f.lng } : null;
  const svcLabel = Object.fromEntries((services.data || []).map((s) => [s.code, s.label]));

  return (
    <>
      <h1>Salony groomerskie</h1>
      {!isPublic && isAdmin && (
        <p className="box">Podgląd administratora: katalog jest jeszcze wyłączony dla klientów, a Ty widzisz też szkice i ukryte miejsca.</p>
      )}
      <p className="muted">Polecani groomerzy dla psów i kotów. Wybierz salon z mapy albo z listy.</p>

      <PlacesFilters f={f} cities={cities.data || []} services={services.data || []} featureDefs={features.data || []} />

      <p className="muted small" style={{ margin: '10px 0' }}>
        {data.total === 0 ? 'Brak salonów dla tych filtrów.' : `Znaleziono: ${data.total}`}
        {f.where && f.lat != null && <> · blisko: {f.where}</>}
      </p>

      <div className="places-layout">
        <div className="places-map-col">
          <PlacesMap items={items} me={me} height={380} />
        </div>
        <ul className="places-list">
          {items.map((p) => (
            <li key={p.id} className="place-card">
              <div className="place-card-top">
                <Link href={`/salony/${p.slug}`} className="place-card-name">{p.name}</Link>
                {p.status && p.status !== 'opublikowany' && <span className="badge-test">{p.status}</span>}
                {p.open_now && <span className="status status-zrealizowane">Otwarte teraz</span>}
              </div>
              <div className="rating-line"><PlaceRating avg={p.rating_avg} count={p.rating_count} /> <PlaceBadges badges={p.badges || []} verified={p.verified} /></div>
              <div className="small muted">
                {PLACE_KIND[p.kind]} · {[p.district, p.city].filter(Boolean).join(', ')}
                {p.address && <> · {p.address}</>}
              </div>
              <div className="place-card-meta small">
                {p.distance_km != null && <strong>{String(p.distance_km).replace('.', ',')} km</strong>}
                {p.price_from != null && <span>{f.service ? svcLabel[f.service] : 'Usługi'} od {priceText({ price_from: p.price_from })}</span>}
                {p.kind === 'mobilny' && p.service_radius_km && <span>dojazd do {p.service_radius_km} km</span>}
              </div>
              {p.short && <p className="small">{p.short}{p.short.length >= 160 ? '…' : ''}</p>}
            </li>
          ))}
        </ul>
      </div>

      <p className="center-text small muted">
        Mapa i część danych o salonach: © autorzy <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (licencja ODbL).
      </p>
      {(cities.data || []).length > 0 && (
        <p className="center-text small">Ranking miast: {(cities.data || []).map((c, i) => (
          <span key={c.slug}>{i > 0 && ' · '}<Link href={`/salony/miasto/${c.slug}`}>{c.city}</Link></span>
        ))}</p>
      )}
      <p className="center-text small muted">
        Brakuje Twojego salonu albo znasz dobrego groomera? <Link href="/salony/polec">Poleć salon</Link>
      </p>
    </>
  );
}
