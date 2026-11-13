'use client';

import { useActionState } from 'react';
import { requestProduct } from '@/app/szukaj/actions';

// "Nie mamy? Napisz, sprowadzimy"
export default function RequestForm({ query = '' }) {
  const [state, action, pending] = useActionState(requestProduct, null);

  if (state?.ok) return <p className="box ok-box">{state.message}</p>;

  return (
    <form action={action} className="request-form">
      <label>Czego szukasz? *
        <input name="query" defaultValue={query} maxLength={200} placeholder="np. Brit Care Senior jagnięcina 12 kg" />
      </label>
      <label>Szczegóły (marka, rozmiar, smak, ile sztuk)
        <textarea name="message" rows={3} maxLength={2000} />
      </label>
      <div className="grid-2">
        <label>Imię<input name="name" maxLength={100} autoComplete="given-name" /></label>
        <label>Telefon<input name="phone" type="tel" maxLength={30} autoComplete="tel" /></label>
      </div>
      <label>E-mail *<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="small muted">Adres e-mail wykorzystamy tylko do odpowiedzi na to zgłoszenie.</p>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}</button>
    </form>
  );
}
