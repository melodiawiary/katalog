import PlacesIndexPage from '@/components/places/PlacesIndexPage';
import { PLACE_CATEGORIES } from '@/lib/place-categories';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: PLACE_CATEGORIES.trener.metaTitle, description: PLACE_CATEGORIES.trener.metaDesc };
}

export default function Page({ searchParams }) {
  return <PlacesIndexPage category="trener" searchParams={searchParams} />;
}
