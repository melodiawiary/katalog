import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPlace } from '../loader';
import PlaceForm from '../PlaceForm';
import PhotoManager from '@/components/places/PhotoManager';
import ConfirmButton from '@/components/admin/ConfirmButton';
import { deletePlace } from '../actions';
import { PLACE_STATUS, PLACE_STATUS_CLASS } from '@/lib/places';
import { placeHref, placeBase } from '@/lib/place-categories';

export const metadata = { title: 'Edycja miejsca' };

export default async function EditPlacePage({ params, searchParams }) {
  const { id } = await params;
  const { zapisano } = await searchParams;
  const data = await loadPlace(id);
  if (!data.place) notFound();
  const p = data.place;

  return (
    <>
      <p className="muted"><Link href="/admin/miejsca">← Salony</Link></p>
      <div className="title-row">
        <h1>{p.name}</h1>
        <Link href={placeHref(p.category, p.slug)} className="muted" target="_blank">Podgląd strony ↗</Link>
      </div>
      <p><span className={`status ${PLACE_STATUS_CLASS[p.status]}`}>{PLACE_STATUS[p.status]}</span> <span className="muted">adres strony: {placeBase(p.category)}/{p.slug}</span></p>
      {zapisano && <p className="ok">Zapisano.</p>}
      <PhotoManager placeId={p.id} slug={p.slug} photos={data.photos} />
      {/* key: po zapisie formularz wczytuje świeże dane z bazy */}
      <PlaceForm key={p.updated_at || p.id} place={p} hours={data.hours} prices={data.prices} priv={data.priv} services={data.services} featureDefs={data.featureDefs} />
      <div className="danger-zone">
        <form action={deletePlace}>
          <input type="hidden" name="id" value={p.id} />
          <ConfirmButton message={`Usunąć na stałe „${p.name}” razem z godzinami i cennikiem?`}>Usuń miejsce na stałe</ConfirmButton>
          <p className="muted">Zamiast usuwać, możesz ustawić status „Ukryty”.</p>
        </form>
      </div>
    </>
  );
}
