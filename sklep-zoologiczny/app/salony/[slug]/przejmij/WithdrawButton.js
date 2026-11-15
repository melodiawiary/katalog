'use client';

import { useActionState } from 'react';
import { withdrawClaim } from './actions';

export default function WithdrawButton({ slug, claimId }) {
  const [state, action, pending] = useActionState(withdrawClaim, null);
  if (state?.withdrawn) return <p className="small muted">Zgłoszenie wycofane. Odśwież stronę, żeby zgłosić ponownie.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="claim_id" value={claimId} />
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="link-btn" disabled={pending}>Wycofaj zgłoszenie</button>
    </form>
  );
}
