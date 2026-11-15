import Link from 'next/link';
import PlaceRequestForm from '@/components/places/PlaceRequestForm';
import { PLACE_CATEGORIES } from '@/lib/place-categories';

const cfg = PLACE_CATEGORIES.weterynarz;

export const metadata = { title: cfg.recommend };

export default function RecommendPage() {
  return (
    <div className={`checkout place-theme ${cfg.theme}`}>
      <p className="muted"><Link href={cfg.base}>← {cfg.back}</Link></p>
      <h1>{cfg.recommend}</h1>
      <p className="muted">{cfg.recommendLead}</p>
      <PlaceRequestForm kind="polecenie" category="weterynarz" />
    </div>
  );
}
