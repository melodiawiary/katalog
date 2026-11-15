import PlaceProfilePage, { placeMetadata } from '@/components/places/PlaceProfilePage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  return placeMetadata(params);
}

export default function Page({ params, searchParams }) {
  return <PlaceProfilePage params={params} searchParams={searchParams} routeCategory="spacerowicz" />;
}
