import { redirect } from 'next/navigation';
import { currentUser, googleEnabled, safeNext } from '@/lib/account';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logowanie i konto', robots: { index: false } };

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const { user } = await currentUser();
  if (user) redirect(next);
  const google = await googleEnabled();
  return (
    <LoginForm
      next={next}
      google={google}
      email={String(sp.email || '').slice(0, 160)}
      failed={Boolean(sp.blad)}
    />
  );
}
