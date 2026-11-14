'use client';

import { useActionState } from 'react';
import { reportPlaceReview } from '@/app/salony/actions';

// "Zgłoś nadużycie" pod opinią (bez konta: e-mail + powód)
export default function ReportReview({ reviewId }) {
  const [state, action, pending] = useActionState(reportPlaceReview, null);
  if (state?.ok) return <span className="small muted">Dziękujemy, sprawdzimy tę opinię.</span>;
  return (
    <details className="small">
      <summary className="link-btn">Zgłoś nadużycie</summary>
      <form action={action} className="stack-form">
        <input type="hidden" name="review_id" value={reviewId} />
        <label>Co jest nie tak z tą opinią?<textarea name="reason" rows={2} maxLength={500} required /></label>
        <label>Twój e-mail<input name="email" type="email" required maxLength={200} /></label>
        <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {state?.error && <p className="alert">{state.error}</p>}
        <button className="btn btn-small btn-light" disabled={pending}>Wyślij zgłoszenie</button>
      </form>
    </details>
  );
}
