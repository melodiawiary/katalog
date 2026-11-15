import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SIZE_CLASS, WEEKDAYS } from '@/lib/places';
import { placeCategory, kindLabel, placeHref } from '@/lib/place-categories';
import { hoursByDay, priceText } from '@/lib/places-browse';
import PlacesMap from '@/components/places/PlacesMap';
import PlaceRequestForm from '@/components/places/PlaceRequestForm';
import PlaceReviewForm from '@/components/places/PlaceReviewForm';
import ReportReview from '@/components/places/ReportReview';
import { PlaceRating, PlaceBadges } from '@/components/places/Rating';
import Stars from '@/components/product/Stars';

async function load(slug) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('place_page', { p_slug: slug });
  return { supabase, data };
}

export async function placeMetadata(params) {
  const { slug } = await params;
  const { data } = await load(slug);
  if (!data) return { title: 'Nie znaleziono strony', robots: { index: false } };
  const p = data.place;
  const cfg = placeCategory(p.category);
  return {
    title: `${p.name}, ${p.city}: ${cfg.tagWord}`,
    description: (p.description || `${kindLabel(p.kind, p.category)} ${p.name}, ${p.city}. Opinie, godziny otwarcia, kontakt.`).slice(0, 160),
    robots: { index: p.status === 'opublikowany' },
  };
}

// Profil miejsca: wspólny dla groomerów, weterynarzy i hoteli (routeCategory = kategoria adresu, przy niezgodności przekierowanie)
export default async function PlaceProfilePage({ params, searchParams, routeCategory }) {
  const { slug } = await params;
  const sp = (await searchParams) || {};
  const { supabase, data } = await load(slug);
  if (!data) notFound();
  if (data.place.category !== routeCategory) redirect(placeHref(data.place.category, data.place.slug));
  const category = data.place.category;
  const cfg = placeCategory(category);
  const stayFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.od || '')) ? String(sp.od) : '';
  const stayTo = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.do || '')) ? String(sp.do) : '';
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
    '@type': cfg.jsonLd,
    name: p.name,
    address: { '@type': 'PostalAddress', streetAddress: p.address, postalCode: p.postal_code, addressLocality: p.city, addressCountry: 'PL' },
    geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    ...(p.phone && { telephone: p.phone }),
    ...(p.website && { url: p.website }),
    ...(p.rating_count > 0 && p.rating_avg != null && {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(p.rating_avg), reviewCount: p.rating_count, bestRating: 5, worstRating: 1 },
    }),
  };
  const { data: serviceDefs } = await supabase.from('service_defs').select('code, label').contains('categories', [category]).order('sort');
  const date = (d) => new Date(d).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', year: 'numeric' });
  const salonUrl = (path) => supabase.storage.from('salony').getPublicUrl(path).data.publicUrl;
  const reviewUrl = (path) => supabase.storage.from('opinie-salonow').getPublicUrl(path).data.publicUrl;
  const bd = data.breakdown || {};
  const parts = [['Jakość', bd.quality], ['Podejście do zwierzęcia', bd.care], ['Czystość', bd.clean], ['Cena do jakości', bd.price]].filter(([, v]) => v != null);

  return (
    <div className={`place-theme ${cfg.theme}`}>
      <p className="muted"><Link href={cfg.base}>← {cfg.back}</Link></p>
      {(p.status !== 'opublikowany' || !isPublic) && (
        <p className="box">Podgląd administratora: ta strona {p.status !== 'opublikowany' ? `ma status „${p.status}”` : 'nie jest jeszcze widoczna dla klientów (katalog wyłączony)'}.</p>
      )}
      <h1>{p.name}</h1>
      <div className="tags" style={{ marginBottom: 8 }}>
        <span className="status">{kindLabel(p.kind, category)}</span>
        {cfg.species && p.species.map((s) => <span key={s} className="status">{s === 'kot' ? 'Koty' : 'Psy'}</span>)}
        {data.open_now && <span className="status status-zrealizowane">Otwarte teraz</span>}
        {data.owner_claimed && <span className="status status-zrealizowane" title="Profil prowadzi właściciel lub osoba zarządzająca">Profil właściciela</span>}
      </div>
      <div className="rating-line" style={{ marginBottom: 8 }}>
        <PlaceRating avg={p.rating_avg} count={p.rating_count} size="1.2em" />
        <PlaceBadges badges={p.badges || []} verified={p.verified} rank={p.city_rank} ranked={data.city_ranked} />
        {data.city_slug && <Link className="small" href={`${cfg.base}/miasto/${data.city_slug}`}>Ranking: {p.city}</Link>}
      </div>

      <div className="place-profile">
        <div>
          {data.photos?.length > 0 && (
            <div className="thumb-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
              {data.photos.map((ph) => (
                <a key={ph.id} href={salonUrl(ph.path)} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={salonUrl(ph.path)} alt={ph.caption || `Zdjęcie: ${p.name}`} loading="lazy" style={{ height: 150, width: 'auto', borderRadius: 8, display: 'block' }} />
                </a>
              ))}
            </div>
          )}
          {p.description && <p className="description">{p.description}</p>}

          {data.features.length > 0 && (
            <ul className="tags" style={{ listStyle: 'none', padding: 0 }}>
              {data.features.map((f) => <li key={f.code} className="chip">✓ {f.label}</li>)}
            </ul>
          )}

          {groups.length === 0 && (
            <>
              <h2>Cennik</h2>
              <p className="muted">Nie podano jeszcze cennika. Zapytaj o cenę telefonicznie.</p>
            </>
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
              <p className="small muted">Ceny orientacyjne, ostateczną wycenę ustala {cfg.nounGen === 'salonu' ? 'salon po obejrzeniu zwierzęcia' : 'placówka'}.</p>
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
            {p.booking_url && <a href={p.booking_url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-small">{category === 'hotel' ? 'Zarezerwuj pobyt' : category === 'petsitter' ? 'Zarezerwuj opiekę' : category === 'trener' ? 'Zapisz się na szkolenie' : category === 'behawiorysta' ? 'Umów konsultację' : category === 'spacerowicz' ? 'Umów spacer' : category === 'transport' ? 'Zamów przewóz' : category === 'fotograf' ? 'Umów sesję' : 'Umów wizytę'}</a>}
          </div>

          {cfg.dates && (
            <div className="box pcat-stay">
              <strong>{cfg.datesLabel || 'Termin'}</strong>
              {stayFrom ? (
                <p className="small">
                  {date(stayFrom)}{stayTo ? <> - {date(stayTo)}{category === 'hotel' ? <> ({Math.max(1, Math.round((new Date(stayTo) - new Date(stayFrom)) / 86400000))} {Math.round((new Date(stayTo) - new Date(stayFrom)) / 86400000) === 1 ? 'doba' : 'dób'})</> : null}</> : null}
                </p>
              ) : <p className="small muted">Wybierz daty na liście, a przeniesiemy je tutaj.</p>}
              {stayFrom && p.email && (
                <a className="btn btn-small" href={`mailto:${p.email}?subject=${encodeURIComponent('Zapytanie o termin')}&body=${encodeURIComponent(`Dzień dobry, proszę o informację o dostępności w terminie ${stayFrom}${stayTo ? ` - ${stayTo}` : ''}.`)}`}>Zapytaj o termin</a>
              )}
              {stayFrom && !p.email && p.phone && <a className="btn btn-small" href={`tel:${phone}`}>Zadzwoń i zapytaj o termin</a>}
            </div>
          )}

          <div className="box">
            <strong>Godziny otwarcia</strong>
            {data.hours.length === 0 ? <p className="small muted">Brak danych. Zadzwoń lub sprawdź stronę internetową.</p> : (
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

      <section id="opinie" className="reviews">
        <h2>Opinie{cfg.reviewsOf || ' o salonie'}</h2>
        {p.rating_count > 0 ? (
          <>
            <p className="reviews-sum"><PlaceRating avg={p.rating_avg} count={p.rating_count} size="1.3em" /></p>
            {parts.length > 0 && (
              <div className="rating-breakdown small">
                {parts.map(([l, v]) => <div key={l}>{l}: <strong>{Number(v).toFixed(1).replace('.', ',')}</strong></div>)}
              </div>
            )}
          </>
        ) : <p className="muted">Brak opinii. Bądź pierwszy i oceń to miejsce.</p>}
        <p className="small muted">Opinie dodają zalogowani użytkownicy; nie sprawdzamy, czy byli w salonie. <Link href="/salony/zasady-opinii">Jak sprawdzamy opinie</Link></p>
        <ul className="plain review-list">
          {(data.reviews || []).map((r) => (
            <li key={r.id} className="review">
              <div className="review-head"><Stars value={r.rating} /><strong>{Number(r.rating).toFixed(1).replace('.', ',')}</strong></div>
              {r.body && <p>{r.body}</p>}
              {r.service && <p className="review-paid">Usługa: {r.service}{r.size_class && <>, {SIZE_CLASS[r.size_class]}</>}</p>}
              {r.photos?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                  {r.photos.map((path) => (
                    <a key={path} href={reviewUrl(path)} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reviewUrl(path)} alt="Zdjęcie z opinii" loading="lazy" style={{ height: 90, width: 'auto', borderRadius: 6, display: 'block' }} />
                    </a>
                  ))}
                </div>
              )}
              <p className="small muted">{r.author} · {date(r.created_at)}</p>
              {r.reply && (
                <div className="box" style={{ marginTop: 8 }}>
                  <strong className="small">Odpowiedź salonu</strong>
                  <p style={{ margin: '4px 0' }}>{r.reply.body}</p>
                  <p className="small muted">{date(r.reply.updated_at || r.reply.created_at)}</p>
                </div>
              )}
              <ReportReview reviewId={r.id} />
            </li>
          ))}
        </ul>
        <PlaceReviewForm placeId={p.id} services={serviceDefs || []} />
      </section>

      {data.nearby.length > 0 && (
        <>
          <h2>{cfg.allLabel.replace('Wszystkie', 'Inne')} w pobliżu</h2>
          <ul className="places-list">
            {data.nearby.map((n) => (
              <li key={n.slug} className="place-card">
                <Link href={`${cfg.base}/${n.slug}${stayFrom ? `?od=${stayFrom}${stayTo ? `&do=${stayTo}` : ''}` : ''}`} className="place-card-name">{n.name}</Link>
                <div className="small muted">{kindLabel(n.kind, category)} · {[n.district, n.city].filter(Boolean).join(', ')} · {String(n.distance_km).replace('.', ',')} km stąd</div>
                <PlaceRating avg={n.rating_avg} count={n.rating_count} />
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
        <p className="panel"><Link className="link-btn" href={`/salony/${p.slug}/przejmij`}>{cfg.mine} - chcę prowadzić ten profil</Link></p>
        <details className="panel">
          <summary className="link-btn">Jesteś właścicielem i chcesz usunąć ten wpis?</summary>
          <PlaceRequestForm kind="usuniecie" placeId={p.id} />
        </details>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </div>
  );
}
