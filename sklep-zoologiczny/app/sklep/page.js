import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { visibleCategories } from '@/lib/categories';
import { browseHref, flatParams } from '@/lib/browse';
import Listing from '@/components/browse/Listing';
import CategoryChips from '@/components/browse/CategoryChips';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sklep: karma i akcesoria dla psów i kotów' };

export default async function ShopPage({ searchParams }) {
  const sp = await searchParams;
  const params = flatParams(sp);

  // stare adresy: /?kategoria=psy -> /kategoria/psy, /?q=karma -> /szukaj?q=karma
  if (params.kategoria && !params.q) {
    const { kategoria, ...rest } = params;
    redirect(browseHref(`/kategoria/${encodeURIComponent(kategoria)}`, rest, {}));
  }
  if (params.q) redirect(browseHref('/szukaj', params, {}));

  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('*').order('sort');
  const categories = visibleCategories(data || []);

  return (
    <>
      <CategoryChips categories={categories} />
      <Listing path="/sklep" searchParams={sp} categories={categories} />
    </>
  );
}
