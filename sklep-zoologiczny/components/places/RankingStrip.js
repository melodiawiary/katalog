import Link from 'next/link';

const TROPHY = ['zloty', 'srebrny', 'brazowy'];

// Pasek "Ranking": trzy najlepiej oceniane miejsca (puchary 1-3 z ikon Mariusza)
export default function RankingStrip({ cfg, top, rankHref, query = '' }) {
  const list = top || [];
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
        {[0, 1, 2].map((i) => { const p = list[i]; return p ? (
          <li key={p.slug}>
            <Link href={`${cfg.base}/${p.slug}${query}`} className="pcat-rank-card">
              <img src={`/ikony/ranking/${TROPHY[i]}.png`} alt={`Miejsce ${i + 1}`} width="46" height="44" />
              <strong>{p.name}</strong>
              <span className="small muted">{p.city}</span>
              <span className="pcat-rank-rate"><span className="pcat-rank-star" aria-hidden="true">★</span><b>{Number(p.rating_avg).toFixed(1).replace('.', ',')}</b><span className="muted">({p.rating_count})</span></span>
            </Link>
          </li>
        ) : (
          <li key={`pusty-${i}`}>
            <div className="pcat-rank-card is-empty">
              <img src={`/ikony/ranking/${TROPHY[i]}.png`} alt={`Miejsce ${i + 1}`} width="46" height="44" />
              <strong>Miejsce {i + 1}</strong>
              <span className="small muted">-</span>
            </div>
          </li>
        ); })}
      </ol>
    </section>
  );
}
