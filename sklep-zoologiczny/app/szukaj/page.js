import { createClient } from '@/lib/supabase/server';
import { visibleCategories } from '@/lib/categories';
import { parseBrowse } from '@/lib/browse';
import Listing from '@/components/browse/Listing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }) {
  const { q } = parseBrowse(await searchParams);
  return { title: q ? `Szukaj: ${q}` : 'Szukaj', robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }) {
  const sp = await searchParams;
  const { q } = parseBrowse(sp);
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').order('sort');
  const categories = visibleCategories(data || []);

  return (
    <>
      <h1>{q ? <>Wyniki dla „{q}”</> : 'Wszystkie produkty'}</h1>
      <Listing path="/szukaj" searchParams={sp} categories={categories} />
    </>
  );
}
