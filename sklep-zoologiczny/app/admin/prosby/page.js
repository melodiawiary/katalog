import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';
import { REQUEST_STATUS } from '@/lib/requests';
import ActionForm from '@/components/admin/ActionForm';
import { updateRequest, deleteRequest } from './actions';

export const metadata = { title: 'Zgłoszenia „sprowadzimy”' };

const STATUS_CLASS = { nowa: 'status-nowe', 'w-toku': 'status-oplacone', sprowadzone: 'status-zrealizowane', odrzucone: 'status-anulowane' };

export default async function RequestsPage({ searchParams }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from('product_requests').select('*').order('created_at', { ascending: false }).limit(300);
  if (REQUEST_STATUS[status]) query = query.eq('status', status);
  const { data: rows, error } = await query;

  if (needsSql(error)) {
    return (<><h1>Zgłoszenia</h1><p className="alert">Wklej w Supabase plik supabase/04_szukanie.sql (SQL Editor -&gt; New query -&gt; Run).</p></>);
  }

  return (
    <>
      <h1>Zgłoszenia „sprowadzimy”</h1>
      <p className="muted">Klienci, którzy nie znaleźli produktu, piszą tu, czego szukają. Odpisz e-mailem i zmień status.</p>
      <nav className="chips">
        <Link href="/admin/prosby" className={!REQUEST_STATUS[status] ? 'chip active' : 'chip'}>Wszystkie</Link>
        {Object.entries(REQUEST_STATUS).map(([key, label]) => (
          <Link key={key} href={`/admin/prosby?status=${key}`} className={status === key ? 'chip active' : 'chip'}>{label}</Link>
        ))}
      </nav>

      {rows?.length === 0 && <p className="muted">Brak zgłoszeń.</p>}

      {rows?.map((r) => {
        const subject = encodeURIComponent(`Twoje zgłoszenie nr ${r.id}: ${r.query || 'produkt'}`);
        return (
          <details key={r.id} className="order">
            <summary>
              <strong>#{r.id}</strong>
              <span>{new Date(r.created_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}</span>
              <strong>{r.query || '(bez tytułu)'}</strong>
              <span className={`status ${STATUS_CLASS[r.status]}`}>{REQUEST_STATUS[r.status]}</span>
            </summary>
            <div className="order-details">
              {r.message && <p className="description">{r.message}</p>}
              <p>
                {r.name && <>{r.name}<br /></>}
                <a href={`mailto:${r.email}?subject=${subject}`}>{r.email}</a>
                {r.phone && <> · <a href={`tel:${r.phone.replace(/\s/g, '')}`}>{r.phone}</a></>}
              </p>
              <p className="small">
                <Link href={`/admin/produkty?q=${encodeURIComponent(r.query)}`}>Szukaj w moich produktach</Link>
              </p>
              <ActionForm action={updateRequest}>
                <input type="hidden" name="id" value={r.id} />
                <label>Status
                  <select name="status" defaultValue={r.status}>
                    {Object.entries(REQUEST_STATUS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </label>
                <label>Notatka (widzisz ją tylko Ty)<textarea name="admin_note" rows={2} defaultValue={r.admin_note} /></label>
              </ActionForm>
              <ActionForm action={deleteRequest} submitLabel="Usuń zgłoszenie" confirm="Usunąć to zgłoszenie?" danger className="delete-form">
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            </div>
          </details>
        );
      })}
    </>
  );
}
