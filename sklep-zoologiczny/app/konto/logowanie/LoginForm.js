'use client';

import { useActionState, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendLoginLink, verifyLoginCode } from '../actions';

export default function LoginForm({ next, google, email: presetEmail, failed }) {
  const [sent, send, sending] = useActionState(sendLoginLink, null);
  const [verified, verify, verifying] = useActionState(verifyLoginCode, null);
  const [gError, setGError] = useState('');
  const waiting = sent?.sent || verified?.sent;
  const email = sent?.email || verified?.email || '';

  async function withGoogle() {
    setGError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setGError('Logowanie przez Google jest chwilowo niedostępne.');
  }

  if (waiting) {
    return (
      <div className="login">
        <h1>Sprawdź pocztę</h1>
        <p className="box ok-box">Wysłaliśmy wiadomość na adres <strong>{email}</strong>. Kliknij w niej przycisk <strong>Zaloguj mnie</strong>.</p>
        <form action={verify} className="login">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <label>Link otworzył się w innej przeglądarce? Wpisz kod z e-maila
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" />
          </label>
          {verified?.error && <p className="alert">{verified.error}</p>}
          <button className="btn" disabled={verifying}>{verifying ? 'Sprawdzanie…' : 'Zaloguj kodem'}</button>
        </form>
        <p className="small muted">Nie ma wiadomości? Zajrzyj do spamu. Link i kod działają krótko; w razie potrzeby <a href={`/konto/logowanie?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`}>poproś o nowy</a>.</p>
      </div>
    );
  }

  return (
    <div className="login">
      <h1>Zaloguj się lub załóż konto</h1>
      <p className="muted">Bez hasła: wyślemy Ci link i kod na e-mail. Konto powstaje samo przy pierwszym logowaniu.
        Zakupy bez konta nadal są możliwe.</p>
      {failed && <p className="alert">Logowanie się nie udało. Spróbuj ponownie.</p>}
      <form action={send} className="login">
        <input type="hidden" name="next" value={next} />
        <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <label>E-mail
          <input name="email" type="email" required autoComplete="email" defaultValue={presetEmail} maxLength={160} />
        </label>
        {sent?.error && <p className="alert">{sent.error}</p>}
        <button className="btn btn-big" disabled={sending}>{sending ? 'Wysyłanie…' : 'Wyślij link logowania'}</button>
      </form>
      {google && (
        <>
          <p className="center-text muted">albo</p>
          <button type="button" className="btn btn-light btn-big" onClick={withGoogle}>Zaloguj się przez Google</button>
          {gError && <p className="alert">{gError}</p>}
        </>
      )}
      <p className="small muted">Logując się, akceptujesz <a href="/regulamin" target="_blank">regulamin</a> i <a href="/polityka-prywatnosci" target="_blank">politykę prywatności</a>.</p>
    </div>
  );
}
