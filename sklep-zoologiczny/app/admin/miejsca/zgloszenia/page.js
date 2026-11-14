import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';
import {
  REQUEST_KIND, PLACE_REQUEST_STATUS, PLACE_REQUEST_STATUS_CLASS,
} from '@/lib/places';
import ActionForm from '@/components/admin/ActionForm';
import { updatePlaceRequest, deletePlaceRequest } from '../actions';

export const metadata = { title: 'Zgłoszenia salonów' };

export default async function PlaceRequestsPage({ searchParams }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from('place_requests').select('*, places(name, slug)').order('created_at', { ascending: false }).limit(300);
  if (PLACE_REQUEST_STATUS[status]) query = query.eq('status', status);
  const { data: rows, error } = await query;

  if (needsSql(error)) {
    return (<><h1>Zgłoszenia salonów</h1><p className="alert">Baza nie ma tabel katalogu. Uruchom supabase/09_miejsca.sql.</p></>);
  }

  return (
    <>
      <p className="muted"><Link href="/admin/miejsca">← Salony</Link></p>
      <h1>Zgłoszenia salonów</h1>
      <p className="muted">Polecenia nowych salonów, poprawki danych i prośby o usunięcie. Odpisz e-mailem i zmień status.</p>
      <nav className="chips">
        <Link href="/admin/miejsca/zgloszenia" className={!PLACE_REQUEST_STATUS[status] ? 'chip active' : 'chip'}>Wszystkie</Link>
        {Object.entries(PLACE_REQUEST_STATUS).map(([key, label]) => (
          <Link key={key} href={`/admin/miejsca/zgloszenia?status=${key}`} className={status === key ? 'chip active' : 'chip'}>{label}</Link>
        ))}
      </nav>

      {rows?.length === 0 && <p className="muted">Brak zgłoszeń.</p>}

      {rows?.map((r) => {
        const title = r.kind === 'polecenie' ? r.place_name : (r.places?.name || r.place_name || '(miejsce usunięte)');
        const subject = encodeURIComponent(`Twoje zgłoszenie nr ${r.id}: ${title}`);
        return (
          <details key={r.id} className="order">
            <summary>
              <strong>#{r.id}</strong>
              <span>{new Date(r.created_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}</span>
              <strong>{REQUEST_KIND[r.kind]}: {title}</strong>
              <span className={`status ${PLACE_REQUEST_STATUS_CLASS[r.status]}`}>{PLACE_REQUEST_STATUS[r.status]}</span>
            </summary>
            <div className="order-details">
              {r.city && <p className="small">Miasto: {r.city}</p>}
              {r.details && <p className="description">{r.details}</p>}
              <p>
                {r.contact_name && <>{r.contact_name}<br /></>}
                <a href={`mailto:${r.contact_email}?subject=${subject}`}>{r.contact_email}</a>
                {r.contact_phone && <> · <a href={`tel:${r.contact_phone.replace(/\s/g, '')}`}>{r.contact_phone}</a></>}
              </p>
              <p className="small">
                {r.kind === 'polecenie' && <Link href={`/admin/miejsca/nowe?zgloszenie=${r.id}`}>Utwórz szkic miejsca z tego zgłoszenia</Link>}
                {r.kind !== 'polecenie' && r.place_id && <Link href={`/admin/miejsca/${r.place_id}`}>Otwórz miejsce w panelu</Link>}
              </p>
              <ActionForm action={updatePlaceRequest}>
                <input type="hidden" name="id" value={r.id} />
                <label>Status
                  <select name="status" defaultValue={r.status}>
                    {Object.entries(PLACE_REQUEST_STATUS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </label>
                <label>Notatka (widzisz ją tylko Ty)<textarea name="admin_note" rows={2} defaultValue={r.admin_note} /></label>
              </ActionForm>
              <ActionForm action={deletePlaceRequest} submitLabel="Usuń zgłoszenie" confirm="Usunąć to zgłoszenie?" danger className="delete-form">
                <input type="hidden" name="id" value={r.id} />
              </ActionForm>
            </div>
          </details>
        );
      })}
    </>
  );
}
