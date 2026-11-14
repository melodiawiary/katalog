'use client';

import { useActionState } from 'react';
import { saveReminder } from '@/app/konto/actions';

export default function ReminderForm({ options, pets, preset }) {
  const [state, action, pending] = useActionState(saveReminder, null);
  const selected = options.some((o) => o.id === preset) ? preset : options[0]?.id;
  return (
    <form action={action} className="pet-form">
      <label>Produkt (z Twoich zamówień)
        <select name="variant_id" defaultValue={selected}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      {pets.length > 0 && (
        <label>Dla kogo
          <select name="pet_id" defaultValue="">
            <option value="">Nie wskazuję</option>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label>Na ile dni starcza opakowanie
        <input name="interval_days" type="number" min="7" max="365" placeholder="puste = podpowiemy orientacyjnie albo 30 dni" />
      </label>
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok-box">{state.ok}</p>}
      <button className="btn btn-small" disabled={pending}>{pending ? 'Zapisywanie…' : 'Dodaj przypomnienie'}</button>
    </form>
  );
}
