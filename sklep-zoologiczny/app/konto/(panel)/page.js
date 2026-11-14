import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { price, STATUS } from '@/lib/shop';
import { ageText, SPECIES_ICON } from '@/lib/pets';
import ReorderButton from '@/components/account/ReorderButton';

export default async function AccountHome() {
  const { supabase, user } = await requireUser('/konto');
  const [{ data: profile }, { data: orders }, { data: pets }, { data: reminders }] = await Promise.all([
    supabase.from('customer_profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
    supabase.from('orders').select('id, number, created_at, status, total').order('created_at', { ascending: false }).limit(1),
    supabase.from('pets').select('id, name, species, birth_date').order('created_at'),
    supabase.from('reminders').select('id, active').eq('active', true),
  ]);
  const last = orders?.[0];
  const first = String(profile?.full_name || '').split(' ')[0];

  return (
    <div>
      <h1>{first ? `Cześć, ${first}!` : 'Twoje konto'}</h1>
      <div className="account-grid">
        <section className="box">
          <h2>Ostatnie zamówienie</h2>
          {last ? (
            <>
              <p>
                Nr <strong>{last.number}</strong> z {new Date(last.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })}
                {' · '}<span className={`status status-${last.status}`}>{STATUS[last.status] || last.status}</span>
                {' · '}{price(last.total)}
              </p>
              <p className="row-actions">
                <Link href={`/zamowienie/${last.id}`} className="btn btn-small btn-light">Szczegóły</Link>
                <ReorderButton orderId={last.id} />
              </p>
            </>
          ) : (
            <p className="muted">Nie masz jeszcze zamówień na tym koncie. Zamówienia złożone wcześniej na ten sam e-mail pojawią się tu same.</p>
          )}
          <p className="small"><Link href="/konto/zamowienia">Wszystkie zamówienia</Link></p>
        </section>

        <section className="box">
          <h2>Moje zwierzęta</h2>
          {pets?.length ? (
            <ul className="plain">
              {pets.map((p) => (
                <li key={p.id}>{SPECIES_ICON[p.species]} <strong>{p.name}</strong>{p.birth_date && <span className="muted"> · {ageText(p.birth_date)}</span>}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Dodaj zwierzaka, a podpowiemy karmę dopasowaną do jego wieku i wielkości.</p>
          )}
          <p className="small"><Link href="/konto/zwierzeta">{pets?.length ? 'Zarządzaj' : 'Dodaj zwierzaka'}</Link></p>
        </section>

        <section className="box">
          <h2>Przypomnienia o karmie</h2>
          <p>{reminders?.length ? `Aktywne przypomnienia: ${reminders.length}.` : 'Nie masz jeszcze przypomnień. Napiszemy, zanim skończy się karma.'}</p>
          <p className="small"><Link href="/konto/przypomnienia">{reminders?.length ? 'Zarządzaj' : 'Ustaw przypomnienie'}</Link></p>
        </section>
      </div>
    </div>
  );
}
