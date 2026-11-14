import Stars from '@/components/product/Stars';
import { PLACE_BADGES, opinionsWord } from '@/lib/places';

// Ocena salonu: gwiazdki, średnia i liczba opinii albo "Brak opinii"
export function PlaceRating({ avg, count, size = '1em' }) {
  const n = Number(count) || 0;
  if (!n || avg == null) return <span className="small muted">Brak opinii</span>;
  return (
    <span className="rating-line">
      <Stars value={avg} size={size} />
      <span className="rating-num">{Number(avg).toFixed(1).replace('.', ',')}</span>
      <span className="small muted">({n} {opinionsWord(n)})</span>
    </span>
  );
}

export function PlaceBadges({ badges = [], verified = false, rank = null, ranked = null }) {
  return (
    <>
      {badges.includes('top_miasta') && <span className="badge-pill top">🏆 {PLACE_BADGES.top_miasta}</span>}
      {badges.includes('polecany') && <span className="badge-pill">✓ {PLACE_BADGES.polecany}</span>}
      {verified && <span className="badge-pill verified">Sprawdzony</span>}
      {rank && ranked ? <span className="small muted">miejsce {rank} z {ranked} w mieście</span> : null}
    </>
  );
}
