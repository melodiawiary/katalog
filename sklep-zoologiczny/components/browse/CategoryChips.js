import Link from 'next/link';
import { topCategories, categoryPath } from '@/lib/categories';

const ICONS = new Set(['psy', 'koty', 'gryzonie', 'ptaki', 'akwarystyka']);

// Kategorie główne jako przyciski (strona główna i strony kategorii)
export default function CategoryChips({ categories, currentId = null }) {
  const pathIds = new Set(currentId ? categoryPath(categories, currentId).map((c) => c.id) : []);
  return (
    <nav className="chips cat-tiles" aria-label="Kategorie">
      <Link href="/sklep" className={`cat-tile${!currentId ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
        <span>Wszystko</span>
      </Link>
      {topCategories(categories).map((c) => (
        <Link key={c.id} href={`/kategoria/${c.slug}`} className={`cat-tile${pathIds.has(c.id) ? ' active' : ''}`}>
          {ICONS.has(c.slug)
            ? <img src={`/ikony/zwierzeta/${c.slug}.png`} alt="" className="cat-tile-img" width="44" height="44" />
            : <span className="cat-tile-icon" aria-hidden="true">{c.emoji}</span>}
          <span>{c.name}</span>
        </Link>
      ))}
    </nav>
  );
}
