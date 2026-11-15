import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ConfirmButton from '@/components/admin/ConfirmButton';
import EvidenceLink from './EvidenceLink';
import { decideClaim, revokeOwner } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Przejęcia salonów' };

const date = (d) => (d ? new Date(d).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', year: 'numeric' }) : '');
const METHOD = { email: 'kod z e-maila', reczna: 'ręcznie' };

export default async function ClaimsAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_claims_overview');
  if (error || !data) return <p className="alert">Przejęcia czekają na aktualizację bazy (plik supabase/13_konta_salonow.sql).</p>;

  return (
    <div>
      <h1>Przejęcia salonów</h1>
      <p className="small muted">Zgłoszenia z poprawnym kodem na adres salonu zatwierdzają się same. Tu trafiają tylko weryfikacje ręczne i spory z obecnym opiekunem.</p>

      <h2>Do decyzji ({data.pending.length})</h2>
      {data.pending.length === 0 && <p className="box">Brak zgłoszeń do sprawdzenia.</p>}
      <ul className="plain">
        {data.pending.map((c) => (
          <li key={c.id} className="box">
            <p><strong><Link href={`/salony/${c.place_slug}`}>{c.place_name}</Link></strong>, {c.city}{c.conflict && <span className="status status-nowe"> spór</span>}</p>
            <p className="small">
              {c.contact_name} ({c.role === 'zarzadzajacy' ? 'zarządza' : 'właściciel'}), konto: {c.email}{c.contact_phone && <>, tel. {c.contact_phone}</>}<br />
              Droga: {METHOD[c.method] || c.method || 'brak'} · zgłoszono {date(c.created_at)}
            </p>
            {c.evidence_note && <p className="small">Opis od zgłaszającego: {c.evidence_note}</p>}
            {c.evidence_path && <p className="small"><EvidenceLink path={c.evidence_path} /></p>}
            {c.owners.length > 0 && (
              <p className="warn small">Dotychczasowi opiekunowie: {c.owners.map((o) => `${o.name || '-'} (${o.email})`).join(', ')}.</p>
            )}
            <form action={decideClaim} className="inline-form">
              <input type="hidden" name="id" value={c.id} />
              <input name="note" placeholder="Notatka (widzi ją zgłaszający przy odrzuceniu)" maxLength={500} />
              <button name="op" value="approve" className="btn btn-small">{c.owners.length ? 'Zatwierdź (dodaj jako kolejnego)' : 'Zatwierdź'}</button>
              {c.owners.length > 0 && <button name="op" value="replace" className="btn btn-small btn-light">Zatwierdź i zastąp dotychczasowych</button>}
              <button name="op" value="reject" className="btn btn-small btn-light">Odrzuć</button>
            </form>
          </li>
        ))}
      </ul>

      <h2>Opiekunowie salonów ({data.owners.length})</h2>
      {data.owners.length === 0 && <p className="muted">Żaden salon nie ma jeszcze opiekuna.</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Salon</th><th>Opiekun</th><th>Konto</th><th>Od</th><th /></tr></thead>
          <tbody>
            {data.owners.map((o) => (
              <tr key={`${o.place_id}-${o.user_id}`}>
                <td><Link href={`/salony/${o.place_slug}`}>{o.place_name}</Link>, {o.city}</td>
                <td>{o.name || '-'} ({o.role === 'zarzadzajacy' ? 'zarządza' : 'właściciel'})</td>
                <td>{o.email}</td>
                <td>{date(o.since)}</td>
                <td>
                  <form action={revokeOwner}>
                    <input type="hidden" name="place_id" value={o.place_id} />
                    <input type="hidden" name="user_id" value={o.user_id} />
                    <ConfirmButton message={`Odebrać dostęp ${o.email} do salonu ${o.place_name}?`}>Odbierz dostęp</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Chętni na Wizytówkę Plus ({data.plus.length})</h2>
      {data.plus.length === 0 ? <p className="muted">Nikt się jeszcze nie zapisał.</p> : (
        <ul className="plain">
          {data.plus.map((p, i) => (
            <li key={i} className="small">{p.place_name}, {p.city} · {p.email}{p.note && <> · „{p.note}”</>} · {date(p.created_at)}</li>
          ))}
        </ul>
      )}

      <h2>Ostatnie decyzje</h2>
      {data.recent.length === 0 ? <p className="muted">Brak.</p> : (
        <ul className="plain">
          {data.recent.map((r) => (
            <li key={r.id} className="small">
              {r.status === 'zatwierdzone' ? 'Zatwierdzono' : 'Odrzucono'}{r.auto && ' automatycznie'}: {r.place_name}, {r.city} · {r.contact_name} ({r.email}){r.admin_note && <> · {r.admin_note}</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
