import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { parsePlaces, rpcArgs, priceText } from '@/lib/places-browse';
import { SPECIES } from '@/lib/places';
import { placeCategory, kindLabel } from '@/lib/place-categories';
import PlaceTile from '@/components/places/PlaceTile';
import PlacesBrowser from '@/components/places/PlacesBrowser';
import PlacesFilters from '@/components/places/PlacesFilters';
import PlacesTabs from '@/components/places/PlacesTabs';
import RankingStrip from '@/components/places/RankingStrip';
import { PlaceRating, PlaceBadges } from '@/components/places/Rating';

// Lista miejsc jednej kategorii (groomerzy, weterynarze, hotele): ten sam system, inne napisy i kolory
export default async function PlacesIndexPage({ category, searchParams }) {
  const cfg = placeCategory(category);
  const sp = await searchParams;
  const f = parsePlaces(sp);
  const supabase = await createClient();

  const [{ data: isPublic }, { data: isAdmin }] = await Promise.all([supabase.rpc('places_public'), supabase.rpc('is_admin')]);

  if (!isPublic && !isAdmin) {
    return (
      <div className={`center place-theme ${cfg.theme}`}>
        <h1>{cfg.h1}</h1>
        <p className="muted">Znasz kogoś godnego polecenia? Podpowiedz nam.</p>
        <Link href={`${cfg.base}/polec`} className="btn">{cfg.recommend}</Link>
      </div>
    );
  }

  const topArgs = rpcArgs({ ...f, q: '', city: '', kind: '', species: '', service: '', size: '', maxPrice: null, openNow: false, features: [], sort: 'najlepsze', radius: f.lat != null ? (f.radius || 30) : null }, 3, category);
  const [res, cities, services, features, topRes] = await Promise.all([
    supabase.rpc('search_places', rpcArgs(f, 200, category)),
    supabase.rpc('places_cities', { p_category: category }),
    supabase.from('service_defs').select('code, label').contains('categories', [category]).order('sort'),
    supabase.from('feature_defs').select('code, label').contains('categories', [category]).order('sort'),
    cfg.ranking ? supabase.rpc('search_places', topArgs) : Promise.resolve({ data: null }),
  ]);
  const data = res.data || { total: 0, items: [] };
  const items = data.items || [];
  const me = f.lat != null ? { lat: f.lat, lng: f.lng } : null;
  const svcLabel = Object.fromEntries((services.data || []).map((s) => [s.code, s.label]));
  const top = ((topRes.data && topRes.data.items) || []).filter((p) => p.rating_count > 0 && p.rating_avg != null).slice(0, 3);
  const cityList = cities.data || [];
  const topCity = top[0] && cityList.find((c) => c.city === top[0].city);
  const rankHref = topCity ? `${cfg.base}/miasto/${topCity.slug}` : `${cfg.base}?sort=najlepsze`;
  const stay = f.from ? `?od=${f.from}${f.to ? `&do=${f.to}` : ''}` : '';
  const noun = { none: `Brak: ${cfg.nounMany}`, one: cfg.nounOne, few: cfg.nounFew, many: cfg.nounMany };

  return (
    <div className={`place-theme ${cfg.theme}`}>
      <div className="salon-top">
        <section className="salon-banner">
          <div className="salon-banner-text">
            {cfg.key !== 'groomer' && <span className="pcat-chip">{cfg.chip}</span>}
            <h1>{cfg.h1}</h1>
            <p>{cfg.lead}</p>
          </div>
          <img className="salon-banner-art" src={cfg.art} alt="" width={cfg.artSize[0]} height={cfg.artSize[1]} />
        </section>
        <PlacesFilters f={f} cities={cityList} services={services.data || []} featureDefs={features.data || []} category={category} />
        {cfg.ranking && <PlacesTabs showRanking={top.length > 0} />}
      </div>
      {!isPublic && isAdmin && (
        <p className="box">Podgląd administratora: katalog jest jeszcze wyłączony dla klientów, a Ty widzisz też szkice i ukryte miejsca.</p>
      )}

      {cfg.ranking && <RankingStrip cfg={cfg} top={top} rankHref={rankHref} query={stay} />}

      <p id="lista-miejsc" className="muted small places-count">
        {data.total === 0 ? cfg.none : `Znaleziono: ${data.total}`}
        {f.where && f.lat != null && <> • blisko: {f.where}</>}
        {f.from && <> • termin: {f.from}{f.to ? ` - ${f.to}` : ''}</>}
      </p>

      <PlacesBrowser items={items} me={me} total={data.total} base={cfg.base} tone={category === 'weterynarz' ? 'teal' : 'orange'} noun={noun} linkLabel={`Zobacz: ${cfg.nounAcc}`}>
        <ul className="places-list">
          {items.map((p) => (
            <li key={p.id} className="place-card" data-slug={p.slug}>
              <PlaceTile kind={p.kind} category={category} />
              <div className="place-card-body">
                <div className="place-card-top">
                  <Link href={`${cfg.base}/${p.slug}${stay}`} className="place-card-name">{p.name}</Link>
                  {p.status && p.status !== 'opublikowany' && <span className="badge-test">{p.status}</span>}
                  {p.open_now && <span className="status status-zrealizowane">Otwarte teraz</span>}
                </div>
                <div className="place-card-addr small">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--accent)" aria-hidden="true"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg>
                  <span>{[p.city, p.address].filter(Boolean).join(', ')}{p.distance_km != null && <> ({String(p.distance_km).replace('.', ',')} km)</>}</span>
                </div>
                <div className="rating-line"><PlaceRating avg={p.rating_avg} count={p.rating_count} /> <PlaceBadges badges={p.badges || []} verified={p.verified} /></div>
                <div className="place-tags">
                  {cfg.species && (p.species || []).map((x) => <span key={x} className="place-tag">{SPECIES[x]}</span>)}
                  {p.kind !== cfg.kinds[0] && <span className="place-tag">{kindLabel(p.kind, category)}</span>}
                  {p.price_from != null && <span className="place-tag price">{f.service ? svcLabel[f.service] : category === 'hotel' ? 'Pobyt' : 'Usługi'} od {priceText({ price_from: p.price_from })}</span>}
                  {p.kind === 'mobilny' && p.service_radius_km && <span className="place-tag">dojazd do {p.service_radius_km} km</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PlacesBrowser>

      <p className="center-text small muted">
        Mapa i część danych: © autorzy <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (licencja ODbL).
      </p>
      {cityList.length > 0 && (
        <p className="center-text small">Ranking miast: {cityList.map((c, i) => (
          <span key={c.slug}>{i > 0 && ' · '}<Link href={`${cfg.base}/miasto/${c.slug}`}>{c.city}</Link></span>
        ))}</p>
      )}
      <p className="center-text small muted">
        Brakuje Twojego miejsca albo znasz dobrego specjalistę? <Link href={`${cfg.base}/polec`}>{cfg.recommend}</Link>
      </p>
    </div>
  );
}
