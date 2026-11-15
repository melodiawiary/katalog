import PlacesIndexPage from '@/components/places/PlacesIndexPage';
import { PLACE_CATEGORIES } from '@/lib/place-categories';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: PLACE_CATEGORIES.weterynarz.metaTitle, description: PLACE_CATEGORIES.weterynarz.metaDesc };
}

export default function Page({ searchParams }) {
  return <PlacesIndexPage category="weterynarz" searchParams={searchParams} />;
}
