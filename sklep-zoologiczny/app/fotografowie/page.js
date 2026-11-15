import PlacesIndexPage from '@/components/places/PlacesIndexPage';
import { PLACE_CATEGORIES } from '@/lib/place-categories';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: PLACE_CATEGORIES.fotograf.metaTitle, description: PLACE_CATEGORIES.fotograf.metaDesc };
}

export default function Page({ searchParams }) {
  return <PlacesIndexPage category="fotograf" searchParams={searchParams} />;
}
