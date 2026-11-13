'use client';

import { useActionState, useEffect, useRef, startTransition } from 'react';

// Formularz z akcją serwera, który pokazuje błąd / "Zapisano" bez przeładowania strony.
// Akcja zwraca { error } albo { ok, message }. Przy błędzie wpisane dane zostają w polach.
// resetOnOk czyści pola po udanym zapisie (formularze "dodaj nowy").
export default function ActionForm({ action, children, submitLabel = 'Zapisz', className = 'stack-form', resetOnOk = false, confirm, danger = false }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);

  useEffect(() => {
    if (resetOnOk && state?.ok) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok">{state.message || 'Zapisano.'}</p>}
      <button className={danger ? 'link-btn danger' : 'btn btn-small'} disabled={pending}>{pending ? 'Zapisywanie…' : submitLabel}</button>
    </form>
  );
}
