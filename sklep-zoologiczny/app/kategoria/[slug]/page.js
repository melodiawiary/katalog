import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { visibleCategories, categoryPath } from '@/lib/categories';
import { flatParams, browseHref } from '@/lib/browse';
import Listing from '@/components/browse/Listing';
import CategoryChips from '@/components/browse/CategoryChips';

export const dynamic = 'force-dynamic';

const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').order('sort');
  return visibleCategories(data || []);
});

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const categories = await getCategories();
  const current = categories.find((c) => c.slug === slug);
  if (!current) return { title: 'Kategoria' };
  const path = categoryPath(categories, current.id);
  const filtered = Object.keys(flatParams(sp)).length > 0;
  return {
    title: path.map((c) => c.name).reverse().join(' - '),
    description: current.description || `${path.map((c) => c.name).join(' › ')}: produkty w sklepie.`,
    // wersje z filtrami nie trafiają do Google osobno
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const categories = await getCategories();
  const current = categories.find((c) => c.slug === slug);
  if (!current) notFound();

  const path = categoryPath(categories, current.id);
  const children = categories
    .filter((c) => c.parent_id === current.id)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'pl'));
  const parent = path.length > 1 ? path[path.length - 2] : null;
  // podkategorie; gdy ich nie ma - kategorie z tego samego poziomu
  const subs = children.length > 0 ? children : parent ? categories.filter((c) => c.parent_id === parent.id) : [];
  const query = flatParams(sp);
  delete query.strona;

  return (
    <>
      <CategoryChips categories={categories} currentId={current.id} />
      <nav className="breadcrumbs muted" aria-label="Okruszki">
        <Link href="/">Start</Link>
        {path.map((c) => (
          <span key={c.id}> › {c.id === current.id ? <span>{c.name}</span> : <Link href={`/kategoria/${c.slug}`}>{c.name}</Link>}</span>
        ))}
      </nav>
      <h1>{path[0]?.emoji} {path.length > 1 ? `${current.name} - ${path[0].name}` : current.name}</h1>
      {current.description && <p className="category-desc">{current.description}</p>}

      {subs.length > 0 && (
        <nav className="chips" aria-label="Podkategorie">
          {children.length === 0 && parent && (
            <Link href={browseHref(`/kategoria/${parent.slug}`, query, {})} className="chip">‹ {parent.name}</Link>
          )}
          {subs.map((c) => (
            <Link key={c.id} href={browseHref(`/kategoria/${c.slug}`, query, {})} className={c.id === current.id ? 'chip active' : 'chip'}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      <Listing path={`/kategoria/${current.slug}`} searchParams={sp} categorySlug={current.slug} categories={categories} />
    </>
  );
}
