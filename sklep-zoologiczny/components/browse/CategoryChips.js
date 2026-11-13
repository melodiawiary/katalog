import Link from 'next/link';
import { topCategories, categoryPath } from '@/lib/categories';

// Kategorie główne jako przyciski (strona główna i strony kategorii)
export default function CategoryChips({ categories, currentId = null }) {
  const pathIds = new Set(currentId ? categoryPath(categories, currentId).map((c) => c.id) : []);
  return (
    <nav className="chips" aria-label="Kategorie">
      <Link href="/" className={!currentId ? 'chip active' : 'chip'}>Wszystko</Link>
      {topCategories(categories).map((c) => (
        <Link key={c.id} href={`/kategoria/${c.slug}`} className={pathIds.has(c.id) ? 'chip active' : 'chip'}>
          {c.emoji} {c.name}
        </Link>
      ))}
    </nav>
  );
}
