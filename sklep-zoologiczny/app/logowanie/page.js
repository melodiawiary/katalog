'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get('email'),
      password: form.get('password'),
    });
    if (error) {
      setError('Nieprawidłowy e-mail lub hasło.');
      setPending(false);
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="login">
      <h1>Panel sklepu</h1>
      <label>E-mail<input name="email" type="email" required autoComplete="username" /></label>
      <label>Hasło<input name="password" type="password" required autoComplete="current-password" /></label>
      {error && <p className="alert">{error}</p>}
      <button className="btn btn-big" disabled={pending}>{pending ? 'Logowanie…' : 'Zaloguj'}</button>
    </form>
  );
}
