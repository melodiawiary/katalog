'use client';

import { useActionState } from 'react';
import { joinAcademy } from '@/app/salony/actions';

// Zapis na listę chętnych na Akademię (kursy pielęgnacji psów i kotów)
export default function AcademyForm() {
  const [state, action, pending] = useActionState(joinAcademy, null);
  if (state?.ok) return <p className="ok-box">{state.message}</p>;
  return (
    <form action={action}>
      <label>Twój e-mail<input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
      <label>Co Cię interesuje?
        <select name="interest" defaultValue="pies">
          <option value="pies">Pielęgnacja psów (dla siebie)</option>
          <option value="kot">Pielęgnacja kotów (dla siebie)</option>
          <option value="zawodowo">Chcę pracować jako groomer</option>
          <option value="inne">Coś innego</option>
        </select>
      </label>
      <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="check"><input type="checkbox" name="consent" required /> <span className="small">Zgadzam się, żeby napisano do mnie e-mailem w sprawie Akademii (start kursów, zapisy). Zgodę mogę cofnąć w każdej chwili.</span></label>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Zapisywanie…' : 'Zapisz mnie na listę'}</button>
    </form>
  );
}
