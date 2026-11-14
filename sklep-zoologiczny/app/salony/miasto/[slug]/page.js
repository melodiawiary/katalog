import Link from 'next/link';
import { notFound } from 'next/navigation';
import { anonClient } from '@/lib/supabase/anon';
import { PLACE_KIND } from '@/lib/places';
import { PlaceRating, PlaceBadges } from '@/components/places/Rating';

// Uwaga: layout czyta ciasteczka, więc Next i tak renderuje stronę na żądanie (pamięć podręczna 5 minut nie działa).
// Żeby zadziałała, trzeba by zdjąć odczyt sesji z głównego layoutu (osobna zmiana). Dane i tak liczy baza (miasto ma kilka zapytań).
export const revalidate = 300;

async function load(slug) {
  const { data } = await anonClient().rpc('city_page', { p_slug: slug });
  return data;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: 'Nie znaleziono miasta', robots: { index: false } };
  return {
    title: `Groomer ${d.city}: ranking salonów i opinie`,
    description: `Salony groomerskie w mieście ${d.city}: ranking, opinie klientów, ceny i godziny otwarcia. Salonów w katalogu: ${d.total}.`,
  };
}

function Card({ p, rank }) {
  return (
    <li className="place-card">
      {rank ? <span className="rank-no">{rank}</span> : null}
      <div className="place-card-top">
        <Link href={`/salony/${p.slug}`} className="place-card-name">{p.name}</Link>
      </div>
      <div className="rating-line"><PlaceRating avg={p.rating_avg} count={p.rating_count} /> <PlaceBadges badges={p.badges || []} verified={p.verified} /></div>
      <div className="small muted">{PLACE_KIND[p.kind]}{p.district && <> · {p.district}</>}{p.address && <> · {p.address}</>}</div>
    </li>
  );
}

export default async function CityPage({ params }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  return (
    <>
      <p className="muted"><Link href="/salony">← Wszystkie salony</Link></p>
      <h1>Groomer {d.city}</h1>
      <p className="muted">W katalogu: {d.total} {d.total === 1 ? 'salon' : 'salonów'}, opinii klientów: {d.reviews}. Ranking powstaje z opinii klientów i jest liczony według <Link href="/salony/zasady-opinii">jawnych zasad</Link>.</p>

      {d.top.length > 0 ? (
        <>
          <h2>Ranking: najlepsze salony w mieście</h2>
          <ol className="rank-list">{d.top.map((p) => <Card key={p.slug} p={p} rank={p.city_rank} />)}</ol>
        </>
      ) : (
        <p className="box">Salony w tym mieście nie mają jeszcze opinii, więc ranking jeszcze nie powstał. <Link href="/salony">Zobacz listę salonów</Link> i oceń swój.</p>
      )}

      {d.others.length > 0 && (
        <>
          <h2>{d.top.length > 0 ? 'Pozostałe salony' : 'Salony'}</h2>
          <ul className="places-list">{d.others.map((p) => <Card key={p.slug} p={p} />)}</ul>
        </>
      )}
      <p className="center-text"><Link href={`/salony?miasto=${encodeURIComponent(d.city)}`} className="btn btn-light">Mapa i filtry: {d.city}</Link></p>
    </>
  );
}
