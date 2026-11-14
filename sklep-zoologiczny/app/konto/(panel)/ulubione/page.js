import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { PlaceRating } from '@/components/places/Rating';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ulubione salony' };

export default async function FavoritesPage() {
  const { supabase } = await requireUser('/konto/ulubione');
  const { data } = await supabase.from('place_favorites')
    .select('created_at, places(slug, name, city, district, address, rating_avg, rating_count)')
    .order('created_at', { ascending: false });
  const rows = (data || []).filter((r) => r.places);
  return (
    <div>
      <h1>Ulubione salony</h1>
      {rows.length === 0 ? (
        <p className="box">Nie masz jeszcze ulubionych salonów. Wejdź na profil salonu w <Link href="/salony">katalogu</Link> i kliknij „Zapisz jako ulubiony”.</p>
      ) : (
        <ul className="places-list">
          {rows.map(({ places: p }) => (
            <li key={p.slug} className="place-card">
              <Link href={`/salony/${p.slug}`} className="place-card-name">{p.name}</Link>
              <PlaceRating avg={p.rating_avg} count={p.rating_count} />
              <div className="small muted">{[p.district, p.city].filter(Boolean).join(', ')}{p.address && <> · {p.address}</>}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
