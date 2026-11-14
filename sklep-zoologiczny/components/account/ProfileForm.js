'use client';

import { useActionState, useState } from 'react';
import { saveProfile } from '@/app/konto/actions';

export default function ProfileForm({ profile }) {
  const [state, action, pending] = useActionState(saveProfile, null);
  const [ship, setShip] = useState(profile?.shipping_method || 'paczkomat');
  return (
    <form action={action} className="pet-form">
      <div className="grid-2">
        <label>Imię i nazwisko<input name="full_name" maxLength={120} autoComplete="name" defaultValue={profile?.full_name || ''} /></label>
        <label>Telefon<input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={profile?.phone || ''} placeholder="600 100 200" /></label>
      </div>
      <fieldset>
        <legend>Domyślna dostawa</legend>
        <label className="radio"><input type="radio" name="shipping_method" value="paczkomat" checked={ship === 'paczkomat'} onChange={() => setShip('paczkomat')} /><span>Paczkomat InPost</span></label>
        <label className="radio"><input type="radio" name="shipping_method" value="kurier" checked={ship === 'kurier'} onChange={() => setShip('kurier')} /><span>Kurier</span></label>
      </fieldset>
      <label>Ulica i numer (dla kuriera)<input name="address" maxLength={200} autoComplete="street-address" defaultValue={profile?.address || ''} /></label>
      <div className="row">
        <label>Kod pocztowy<input name="postal_code" maxLength={10} pattern="\d{2}-\d{3}" placeholder="00-000" autoComplete="postal-code" defaultValue={profile?.postal_code || ''} /></label>
        <label>Miejscowość<input name="city" maxLength={80} autoComplete="address-level2" defaultValue={profile?.city || ''} /></label>
      </div>
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok-box">{state.ok}</p>}
      <button className="btn btn-small" disabled={pending}>{pending ? 'Zapisywanie…' : 'Zapisz'}</button>
    </form>
  );
}
