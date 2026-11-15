import Link from 'next/link';
import { serviceClient } from '@/lib/supabase/service';
import { objectTakeover } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'To nie ja', robots: { index: false, follow: false } };

export default async function TakeoverObjectPage({ searchParams }) {
  const sp = await searchParams;
  const token = String(sp?.t || '').slice(0, 64);
  const db = serviceClient();
  let info = null;
  if (db && token) {
    const { data } = await db.rpc('takeover_event_info', { p_token: token });
    info = data;
  }

  return (
    <div className="container claim-page">
      <h1>Przejęcie profilu salonu</h1>
      {!db ? (
        <p className="alert">Ta strona jest chwilowo niedostępna. Odpisz na e-mail, który dostałeś.</p>
      ) : !info ? (
        <p className="alert">Nie znaleziono tego zgłoszenia. Sprawdź, czy link z e-maila jest kompletny.</p>
      ) : info.expired ? (
        <p className="alert">Ten link wygasł (jest ważny 30 dni). Napisz do nas przez „Zgłoś poprawkę” na stronie salonu.</p>
      ) : info.objected ? (
        <div className="ok-box">
          <p><strong>Dziękujemy, zgłoszenie przyjęte.</strong></p>
          <p>Konto osoby, która przejęła profil <strong>{info.place_name}</strong>, jest wstrzymane. Sprawdzimy sprawę i damy znać.</p>
        </div>
      ) : (
        <form action={objectTakeover} className="box stack-form">
          <input type="hidden" name="t" value={token} />
          <p>Profil salonu <strong>{info.place_name}</strong> przejął(a): <strong>{info.claimant_name || 'nieznana osoba'}</strong>.</p>
          <p>Jeśli to nie Ty ani nikt z Twojego zespołu, zgłoś to. Wstrzymamy to konto od razu, a my sprawdzimy sprawę.</p>
          <label>Uwagi (nieobowiązkowo)
            <textarea name="note" rows={3} maxLength={500} placeholder="Np. nie znam tej osoby" />
          </label>
          <button className="btn">To nie ja, wstrzymaj to konto</button>
          <p className="small muted">Jeśli to Ty lub Twój pracownik, po prostu zamknij tę stronę.</p>
        </form>
      )}
      <p><Link href="/salony">Wróć do katalogu salonów</Link></p>
    </div>
  );
}
