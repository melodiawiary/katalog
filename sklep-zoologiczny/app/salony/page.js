import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { parsePlaces, rpcArgs, priceText } from '@/lib/places-browse';
import { PLACE_KIND, SPECIES } from '@/lib/places';
import PlaceTile from '@/components/places/PlaceTile';
import PlacesBrowser from '@/components/places/PlacesBrowser';
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
        <h1>Katalog salonów</h1>
        <p className="muted">Znasz dobry salon groomerski? Podpowiedz nam go.</p>
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
      <div className="salon-top">
        <section className="salon-banner">
          <div className="salon-banner-text">
            <h1>Salony groomerskie</h1>
            <p>Polecani groomerzy dla<br className="mb" /> psów i kotów.<br />Wybierz salon z mapy lub z listy.</p>
          </div>
          <img className="salon-banner-art" src="/ilustracje/pies-kot-kapiel.png" alt="" width="640" height="505" />
        </section>
        <PlacesFilters f={f} cities={cities.data || []} services={services.data || []} featureDefs={features.data || []} />
      </div>
      {!isPublic && isAdmin && (
        <p className="box">Podgląd administratora: katalog jest jeszcze wyłączony dla klientów, a Ty widzisz też szkice i ukryte miejsca.</p>
      )}

      <p className="muted small places-count">
        {data.total === 0 ? 'Brak salonów dla tych filtrów.' : `Znaleziono: ${data.total}`}
        {f.where && f.lat != null && <> • blisko: {f.where}</>}
      </p>

      <PlacesBrowser items={items} me={me} total={data.total}>
        <ul className="places-list">
          {items.map((p) => (
            <li key={p.id} className="place-card" data-slug={p.slug}>
              <PlaceTile kind={p.kind} />
              <div className="place-card-body">
                <div className="place-card-top">
                  <Link href={`/salony/${p.slug}`} className="place-card-name">{p.name}</Link>
                  {p.status && p.status !== 'opublikowany' && <span className="badge-test">{p.status}</span>}
                  {p.open_now && <span className="status status-zrealizowane">Otwarte teraz</span>}
                </div>
                <div className="place-card-addr small">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#e07a2f" aria-hidden="true"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg>
                  <span>{[p.city, p.address].filter(Boolean).join(', ')}{p.distance_km != null && <> ({String(p.distance_km).replace('.', ',')} km)</>}</span>
                </div>
                <div className="rating-line"><PlaceRating avg={p.rating_avg} count={p.rating_count} /> <PlaceBadges badges={p.badges || []} verified={p.verified} /></div>
                <div className="place-tags">
                  {(p.species || []).map((x) => <span key={x} className="place-tag">{SPECIES[x]}</span>)}
                  {p.kind !== 'salon' && <span className="place-tag">{PLACE_KIND[p.kind]}</span>}
                  {p.price_from != null && <span className="place-tag price">{f.service ? svcLabel[f.service] : 'Usługi'} od {priceText({ price_from: p.price_from })}</span>}
                  {p.kind === 'mobilny' && p.service_radius_km && <span className="place-tag">dojazd do {p.service_radius_km} km</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PlacesBrowser>

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
