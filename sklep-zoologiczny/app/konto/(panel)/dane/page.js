import { requireUser } from '@/lib/account';
import ProfileForm from '@/components/account/ProfileForm';
import { setRemindersEnabled, deleteAccount } from '../../actions';
import ConfirmButton from '@/components/admin/ConfirmButton';

export const metadata = { title: 'Moje dane', robots: { index: false } };

export default async function DataPage() {
  const { supabase, user } = await requireUser('/konto/dane');
  const { data: profile } = await supabase.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const enabled = profile?.reminders_enabled !== false;
  return (
    <div>
      <h1>Moje dane</h1>
      <p className="muted">Konto: <strong>{user.email}</strong>. Dane podpowiemy przy kolejnym zamówieniu; w każdej chwili możesz je zmienić.</p>
      <section className="box">
        <h2>Dane do zamówień</h2>
        <ProfileForm profile={profile} />
        {profile?.locker_id && (
          <p className="small muted">Zapamiętany paczkomat: {profile.locker_id}{profile.locker_desc ? `, ${profile.locker_desc}` : ''}. Zmienisz go przy zamówieniu.</p>
        )}
      </section>

      <section className="box">
        <h2>Przypomnienia o karmie</h2>
        <form action={setRemindersEnabled}>
          <input type="hidden" name="enabled" value={enabled ? '0' : '1'} />
          <p>{enabled ? 'Wiadomości z przypomnieniami są włączone.' : 'Wszystkie przypomnienia są wyłączone.'}</p>
          <button className="btn btn-small btn-light">{enabled ? 'Wyłącz wszystkie przypomnienia' : 'Włącz przypomnienia'}</button>
        </form>
      </section>

      <section className="box">
        <h2>Usunięcie konta</h2>
        <p className="small">Usuniemy konto, dane z profilu, zwierzęta, przypomnienia i Twoje opinie. Zamówienia zostają w sklepie
          (wymagają tego przepisy podatkowe), ale przestają być powiązane z kontem. Tej operacji nie da się cofnąć.</p>
        <form action={deleteAccount} className="inline-form">
          <label className="small">Wpisz USUŃ, żeby potwierdzić <input name="confirm" required autoComplete="off" /></label>
          <ConfirmButton message="Na pewno usunąć konto?">Usuń konto</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
