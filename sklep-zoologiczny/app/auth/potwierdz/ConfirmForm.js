'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { confirmLoginLink } from '@/app/konto/actions';

export default function ConfirmForm({ tokenHash, next }) {
  const [state, action, pending] = useActionState(confirmLoginLink, null);
  return (
    <form action={action} className="login">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="next" value={next} />
      <p>Kliknij, żeby dokończyć logowanie do konta.</p>
      {state?.error && (
        <p className="alert">{state.error} <Link href={`/konto/logowanie?next=${encodeURIComponent(next)}`}>Wróć do logowania</Link></p>
      )}
      <button className="btn btn-big" disabled={pending}>{pending ? 'Logowanie…' : 'Zaloguj mnie'}</button>
    </form>
  );
}
