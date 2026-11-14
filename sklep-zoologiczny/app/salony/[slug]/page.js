import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PLACE_KIND, SIZE_CLASS, WEEKDAYS } from '@/lib/places';
import { hoursByDay, priceText } from '@/lib/places-browse';
import PlacesMap from '@/components/places/PlacesMap';
import PlaceRequestForm from '@/components/places/PlaceRequestForm';

export const dynamic = 'force-dynamic';

async function load(slug) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('place_page', { p_slug: slug });
  return { supabase, data };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await load(slug);
  if (!data) return { title: 'Nie znaleziono salonu', robots: { index: false } };
  const p = data.place;
  return {
    title: `${p.name}, ${p.city}: groomer`,
    description: (p.description || `${PLACE_KIND[p.kind]} ${p.name}, ${p.city}. Ceny, godziny otwarcia, kontakt.`).slice(0, 160),
    robots: { index: p.status === 'opublikowany' },
  };
}

export default async function PlacePage({ params }) {
  const { slug } = await params;
  const { supabase, data } = await load(slug);
  if (!data) notFound();
  const { data: isPublic } = await supabase.rpc('places_public');
  const p = data.place;
  const days = hoursByDay(data.hours);
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).getDay() || 7;

  // cennik pogrupowany wg usługi (kolejność z bazy)
  const groups = [];
  for (const row of data.prices) {
    let g = groups.find((x) => x.service === row.service);
    if (!g) { g = { service: row.service, label: row.label, rows: [] }; groups.push(g); }
    g.rows.push(row);
  }

  const phone = p.phone ? p.phone.replace(/[^\d+]/g, '') : '';
  const links = [
    p.website && ['Strona www', p.website],
    p.instagram && ['Instagram', p.instagram],
    p.facebook && ['Facebook', p.facebook],
  ].filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PetGroomer',
    name: p.name,
    address: { '@type': 'PostalAddress', streetAddress: p.address, postalCode: p.postal_code, addressLocality: p.city, addressCountry: 'PL' },
    geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    ...(p.phone && { telephone: p.phone }),
    ...(p.website && { url: p.website }),
  };

  return (
    <>
      <p className="muted"><Link href="/salony">← Salony</Link></p>
      {(p.status !== 'opublikowany' || !isPublic) && (
        <p className="box">Podgląd administratora: ta strona {p.status !== 'opublikowany' ? `ma status „${p.status}”` : 'nie jest jeszcze widoczna dla klientów (katalog wyłączony)'}.</p>
      )}
      <h1>{p.name}</h1>
      <div className="tags" style={{ marginBottom: 8 }}>
        <span className="status">{PLACE_KIND[p.kind]}</span>
        {p.species.map((s) => <span key={s} className="status">{s === 'kot' ? 'Koty' : 'Psy'}</span>)}
        {data.open_now && <span className="status status-zrealizowane">Otwarte teraz</span>}
      </div>

      <div className="place-profile">
        <div>
          {p.description && <p className="description">{p.description}</p>}

          {data.features.length > 0 && (
            <ul className="tags" style={{ listStyle: 'none', padding: 0 }}>
              {data.features.map((f) => <li key={f.code} className="chip">✓ {f.label}</li>)}
            </ul>
          )}

          {groups.length > 0 && (
            <>
              <h2>Cennik</h2>
              {groups.map((g) => (
                <div key={g.service} className="price-group">
                  <strong>{g.label}</strong>
                  <table className="price-table">
                    <tbody>
                      {g.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.size_class ? SIZE_CLASS[r.size_class] : 'Każda wielkość'}{r.breed && <> · {r.breed}</>}{r.note && <span className="small muted"> ({r.note})</span>}</td>
                          <td className="price-cell">{priceText(r)}{r.duration_min && <span className="small muted"> · ok. {r.duration_min} min</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="small muted">Ceny orientacyjne, ostateczną wycenę ustala salon po obejrzeniu zwierzęcia.</p>
            </>
          )}
        </div>

        <aside className="place-side">
          <div className="box">
            <strong>Kontakt</strong>
            <p className="small">
              {p.kind === 'mobilny'
                ? <>Dojeżdża z: {p.city}{p.service_radius_km ? <>, zasięg do {p.service_radius_km} km</> : null}</>
                : <>{p.address}<br />{[p.postal_code, p.city].filter(Boolean).join(' ')}{p.district && <> ({p.district})</>}</>}
            </p>
            {p.phone && <p className="small"><a href={`tel:${phone}`}>📞 {p.phone}</a></p>}
            {p.email && <p className="small"><a href={`mailto:${p.email}`}>{p.email}</a></p>}
            {links.map(([label, url]) => <p key={label} className="small"><a href={url} target="_blank" rel="noopener noreferrer nofollow">{label} ↗</a></p>)}
            {p.booking_url && <a href={p.booking_url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-small">Umów wizytę</a>}
          </div>

          <div className="box">
            <strong>Godziny otwarcia</strong>
            {data.hours.length === 0 ? <p className="small muted">Brak danych. Zadzwoń lub sprawdź stronę salonu.</p> : (
              <table className="hours-table">
                <tbody>
                  {Object.entries(WEEKDAYS).map(([d, label]) => (
                    <tr key={d} className={Number(d) === today ? 'today' : ''}>
                      <td>{label}</td><td>{days[d] || 'zamknięte'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </aside>
      </div>

      {p.kind !== 'mobilny' || p.address ? <PlacesMap items={[{ slug: p.slug, name: p.name, lat: p.lat, lng: p.lng }]} height={280} single /> : null}
      {p.kind !== 'mobilny' && (
        <p className="small"><a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer">Wyznacz trasę ↗</a></p>
      )}

      {data.nearby.length > 0 && (
        <>
          <h2>Inne salony w pobliżu</h2>
          <ul className="places-list">
            {data.nearby.map((n) => (
              <li key={n.slug} className="place-card">
                <Link href={`/salony/${n.slug}`} className="place-card-name">{n.name}</Link>
                <div className="small muted">{PLACE_KIND[n.kind]} · {[n.district, n.city].filter(Boolean).join(', ')} · {String(n.distance_km).replace('.', ',')} km stąd</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="place-reports">
        <details className="panel">
          <summary className="link-btn">Dane się zmieniły? Zgłoś poprawkę</summary>
          <PlaceRequestForm kind="korekta" placeId={p.id} />
        </details>
        <details className="panel">
          <summary className="link-btn">Jesteś właścicielem i chcesz usunąć ten wpis?</summary>
          <PlaceRequestForm kind="usuniecie" placeId={p.id} />
        </details>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </>
  );
}
