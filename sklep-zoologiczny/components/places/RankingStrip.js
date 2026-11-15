import Link from 'next/link';
import { PlaceRating } from '@/components/places/Rating';

const TROPHY = ['zloty', 'srebrny', 'brazowy'];

// Pasek "Ranking": trzy najlepiej oceniane miejsca (puchary 1-3 z ikon Mariusza)
export default function RankingStrip({ cfg, top, rankHref, query = '' }) {
  if (!top || top.length === 0) return null;
  return (
    <section id="ranking-miejsc" className="pcat-rank">
      <div className="pcat-rank-head">
        <img src="/ikony/ranking/zloty.png" alt="" width="40" height="38" />
        <div>
          <h2>{cfg.rankTitle}</h2>
          <p>{cfg.rankSub}</p>
        </div>
        <Link href={rankHref} className="pcat-rank-all">Zobacz ranking ›</Link>
      </div>
      <ol className="pcat-rank-list">
        {top.map((p, i) => (
          <li key={p.slug}>
            <Link href={`${cfg.base}/${p.slug}${query}`} className="pcat-rank-card">
              <img src={`/ikony/ranking/${TROPHY[i]}.png`} alt={`Miejsce ${i + 1}`} width="46" height="44" />
              <strong>{p.name}</strong>
              <span className="small muted">{p.city}</span>
              <PlaceRating avg={p.rating_avg} count={p.rating_count} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
