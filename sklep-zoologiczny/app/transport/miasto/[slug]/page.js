import CityPage, { cityMetadata } from '@/components/places/PlacesCityPage';

// Uwaga: layout czyta ciasteczka, więc strona i tak renderuje się na żądanie; dane liczy baza.
export const revalidate = 300;

export async function generateMetadata({ params }) {
  return cityMetadata(params, 'transport');
}

export default function Page({ params }) {
  return <CityPage params={params} category="transport" />;
}
