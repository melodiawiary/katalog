'use client';

import { useActionState, useRef, useEffect } from 'react';
import { savePet } from '@/app/konto/actions';

export default function PetForm({ pet }) {
  const [state, action, pending] = useActionState(savePet, null);
  const ref = useRef(null);
  useEffect(() => { if (state?.ok && !pet) ref.current?.reset(); }, [state, pet]);
  return (
    <form action={action} ref={ref} className="pet-form">
      {pet && <input type="hidden" name="id" value={pet.id} />}
      <div className="grid-2">
        <label>Imię *<input name="name" required maxLength={60} defaultValue={pet?.name || ''} /></label>
        <label>Gatunek
          <select name="species" defaultValue={pet?.species || 'pies'}>
            <option value="pies">Pies</option>
            <option value="kot">Kot</option>
            <option value="inne">Inne zwierzę</option>
          </select>
        </label>
      </div>
      <div className="grid-2">
        <label>Rasa<input name="breed" maxLength={80} defaultValue={pet?.breed || ''} placeholder="np. owczarek niemiecki, mieszaniec" /></label>
        <label>Data urodzenia (może być przybliżona)<input name="birth_date" type="date" defaultValue={pet?.birth_date || ''} /></label>
      </div>
      <div className="grid-2">
        <label>Waga (kg)<input name="weight_kg" inputMode="decimal" defaultValue={pet?.weight_kg ?? ''} placeholder="np. 12,5" /></label>
        <label>Uwagi (np. alergie pokarmowe)<input name="notes" maxLength={500} defaultValue={pet?.notes || ''} /></label>
      </div>
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok-box">{state.ok}</p>}
      <button className="btn btn-small" disabled={pending}>{pending ? 'Zapisywanie…' : pet ? 'Zapisz zmiany' : 'Dodaj'}</button>
    </form>
  );
}
