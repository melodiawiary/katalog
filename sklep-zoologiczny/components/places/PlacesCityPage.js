import Link from 'next/link';
import { notFound } from 'next/navigation';
import { anonClient } from '@/lib/supabase/anon';
import { placeCategory, kindLabel, countWord } from '@/lib/place-categories';
import { PlaceRating, PlaceBadges } from '@/components/places/Rating';

async function load(slug, category) {
  const { data } = await anonClient().rpc('city_page', { p_slug: slug, p_category: category });
  return data;
}

export async function cityMetadata(params, category) {
  const { slug } = await params;
  const cfg = placeCategory(category);
  const d = await load(slug, category);
  if (!d) return { title: 'Nie znaleziono miasta', robots: { index: false } };
  return {
    title: `${cfg.cityH1(d.city)}: ranking i opinie`,
    description: `${cfg.cityH1(d.city)}: ranking, opinie właścicieli zwierząt, godziny otwarcia. W katalogu: ${d.total}.`,
  };
}

function Card({ p, rank, cfg }) {
  return (
    <li className="place-card">
      {rank ? <span className="rank-no">{rank}</span> : null}
      <div className="place-card-top">
        <Link href={`${cfg.base}/${p.slug}`} className="place-card-name">{p.name}</Link>
      </div>
      <div className="rating-line"><PlaceRating avg={p.rating_avg} count={p.rating_count} /> <PlaceBadges badges={p.badges || []} verified={p.verified} /></div>
      <div className="small muted">{kindLabel(p.kind, cfg.key)}{p.district && <> · {p.district}</>}{p.address && <> · {p.address}</>}</div>
    </li>
  );
}

export default async function CityPage({ params, category }) {
  const { slug } = await params;
  const cfg = placeCategory(category);
  const d = await load(slug, category);
  if (!d) notFound();
  return (
    <div className={`place-theme ${cfg.theme}`}>
      <p className="muted"><Link href={cfg.base}>← {cfg.allLabel}</Link></p>
      <h1>{cfg.cityH1(d.city)}</h1>
      <p className="muted">W katalogu: {d.total} {countWord(cfg, d.total)}, opinii klientów: {d.reviews}. Ranking powstaje z opinii klientów i jest liczony według <Link href="/salony/zasady-opinii">jawnych zasad</Link>.</p>

      {d.top.length > 0 ? (
        <>
          <h2>{cfg.cityRank}</h2>
          <ol className="rank-list">{d.top.map((p) => <Card key={p.slug} p={p} rank={p.city_rank} cfg={cfg} />)}</ol>
        </>
      ) : (
        <p className="box">Nie ma tu jeszcze opinii, więc ranking jeszcze nie powstał. <Link href={cfg.base}>Zobacz listę</Link> i oceń swoje miejsce.</p>
      )}

      {d.others.length > 0 && (
        <>
          <h2>{d.top.length > 0 ? 'Pozostałe' : cfg.allLabel.replace('Wszystkie ', '').replace(/^./, (c) => c.toUpperCase())}</h2>
          <ul className="places-list">{d.others.map((p) => <Card key={p.slug} p={p} cfg={cfg} />)}</ul>
        </>
      )}
      <p className="center-text"><Link href={`${cfg.base}?miasto=${encodeURIComponent(d.city)}`} className="btn btn-light">Mapa i filtry: {d.city}</Link></p>
    </div>
  );
}
