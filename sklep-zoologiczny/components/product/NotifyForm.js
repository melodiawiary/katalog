'use client';

import { useActionState } from 'react';
import { requestStockAlert } from '@/app/produkt/actions';

// "Powiadom o dostępności" dla wybranego wariantu
export default function NotifyForm({ variantId, label }) {
  const [state, action, pending] = useActionState(requestStockAlert, null);

  if (state?.ok) {
    return (
      <p className="box ok-box">
        {state.already
          ? 'Ten adres już czeka na powiadomienie o tym produkcie.'
          : `Gotowe! Napiszemy na ${state.email || 'podany adres'}, gdy ${label || 'produkt'} wróci do sprzedaży.`}
      </p>
    );
  }

  return (
    <form action={action} className="notify-form">
      <p className="notify-title">Powiadom mnie, gdy będzie dostępny</p>
      <input type="hidden" name="variant_id" value={variantId} />
      <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="notify-row">
        <input name="email" type="email" required maxLength={200} placeholder="Twój e-mail" autoComplete="email"
          aria-label="Twój e-mail" />
        <button className="btn" disabled={pending}>{pending ? 'Zapisywanie…' : 'Powiadom mnie'}</button>
      </div>
      <p className="small muted">Wyślemy jedną wiadomość, gdy produkt wróci. Adresu nie użyjemy do niczego innego.</p>
      {state?.error && <p className="alert">{state.error}</p>}
    </form>
  );
}
