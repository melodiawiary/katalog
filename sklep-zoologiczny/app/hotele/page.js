import PlacesIndexPage from '@/components/places/PlacesIndexPage';
import { PLACE_CATEGORIES } from '@/lib/place-categories';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: PLACE_CATEGORIES.hotel.metaTitle, description: PLACE_CATEGORIES.hotel.metaDesc };
}

export default function Page({ searchParams }) {
  return <PlacesIndexPage category="hotel" searchParams={searchParams} />;
}
