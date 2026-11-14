import Link from 'next/link';
import PlaceRequestForm from '@/components/places/PlaceRequestForm';

export const metadata = { title: 'Poleć salon groomerski' };

export default function RecommendPage() {
  return (
    <div className="checkout">
      <p className="muted"><Link href="/salony">← Salony</Link></p>
      <h1>Poleć salon</h1>
      <p className="muted">Znasz groomera, któremu ufasz? Napisz o nim, a sprawdzimy i dodamy do katalogu. Właściciele salonów też mogą zgłosić siebie.</p>
      <PlaceRequestForm kind="polecenie" />
    </div>
  );
}
