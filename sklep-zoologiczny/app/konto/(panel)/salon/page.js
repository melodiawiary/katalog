import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { PLACE_STATUS } from '@/lib/places';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mój salon', robots: { index: false } };

export default async function MySalonsPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase } = await requireUser('/konto/salon');
  const { data } = await supabase.rpc('owner_my_places');
  const list = data || [];
  return (
    <div>
      <h1>Mój salon</h1>
      {sp.zwolniono && <p className="ok-box">Salon został zwolniony z Twojego konta.</p>}
      {list.length === 0 ? (
        <div className="box">
          <p>Nie masz jeszcze salonu na koncie. Znajdź swój salon w <Link href="/salony">katalogu</Link> i kliknij „To mój salon” na jego stronie.</p>
        </div>
      ) : (
        <ul className="places-list">
          {list.map((p) => (
            <li key={p.id} className="place-card">
              <Link href={`/konto/salon/${p.slug}`} className="place-card-name">{p.name}</Link>
              <div className="small muted">
                {p.city} · {PLACE_STATUS[p.status] || p.status} · {p.role === 'zarzadzajacy' ? 'zarządzasz' : 'właściciel'}
                {p.rating_count > 0 && <> · ocena {Number(p.rating_avg).toFixed(1).replace('.', ',')} ({p.rating_count})</>}
                {p.city_rank && <> · miejsce {p.city_rank} w mieście</>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
