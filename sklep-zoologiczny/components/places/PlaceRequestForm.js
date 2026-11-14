'use client';

import { useActionState } from 'react';
import { submitPlaceRequest } from '@/app/salony/actions';

const COPY = {
  polecenie: { details: 'Dlaczego go polecasz? Adres, strona, telefon (cokolwiek pomoże nam go znaleźć)', button: 'Poleć salon', req: false },
  korekta: { details: 'Co trzeba poprawić? (adres, godziny, cennik, telefon...) *', button: 'Wyślij poprawkę', req: true },
  usuniecie: { details: 'Dlaczego prosisz o usunięcie? Napisz, czy jesteś właścicielem salonu', button: 'Poproś o usunięcie', req: false },
};

export default function PlaceRequestForm({ kind, placeId = null }) {
  const [state, action, pending] = useActionState(submitPlaceRequest, null);
  const c = COPY[kind];
  if (state?.ok) return <p className="box ok-box">{state.message}</p>;

  return (
    <form action={action} className="request-form">
      <input type="hidden" name="kind" value={kind} />
      {placeId && <input type="hidden" name="place_id" value={placeId} />}
      {kind === 'polecenie' && (
        <div className="grid-2">
          <label>Nazwa salonu / groomera *<input name="place_name" required maxLength={120} /></label>
          <label>Miasto *<input name="city" required maxLength={80} /></label>
        </div>
      )}
      <label>{c.details}<textarea name="details" rows={4} maxLength={2000} required={c.req} /></label>
      <div className="grid-2">
        <label>Twoje imię<input name="contact_name" maxLength={100} autoComplete="given-name" /></label>
        <label>Telefon<input name="phone" type="tel" maxLength={30} autoComplete="tel" /></label>
      </div>
      <label>Twój e-mail *<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="small muted">E-mail wykorzystamy tylko do odpowiedzi na to zgłoszenie.</p>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Wysyłanie…' : c.button}</button>
    </form>
  );
}
