import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import ActionForm from '@/components/admin/ActionForm';
import { markNotified, deleteAlert, sendAlertsNow } from './actions';

export const metadata = { title: 'Powiadomienia o dostępności' };

// Klienci zapisani na "Powiadom o dostępności", pogrupowani po wariantach.
// Automat (Resend) wysyła sam; ręcznie: przycisk otwiera pocztę z adresami w UDW.
export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('stock_alerts')
    .select('id, email, created_at, variant_id, product_variants(id, name, stock, product_id, products(id, name, slug))')
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(2000);

  if (needsSql(error)) {
    return (<><h1>Powiadomienia</h1><p className="alert">Wklej w Supabase plik supabase/05_karta.sql (SQL Editor -&gt; New query -&gt; Run).</p></>);
  }
  if (error) return <p className="alert">{error.message}</p>;

  const s = await getSettings();
  const base = await siteUrl(s);
  const groups = new Map();
  for (const r of rows || []) {
    const g = groups.get(r.variant_id) || { variant: r.product_variants, alerts: [] };
    g.alerts.push(r);
    groups.set(r.variant_id, g);
  }
  const list = [...groups.values()].sort((a, b) =>
    (b.variant?.stock > 0) - (a.variant?.stock > 0) || b.alerts.length - a.alerts.length);

  return (
    <>
      <h1>Powiadomienia o dostępności</h1>
      <p className="muted">
        Klienci, którzy chcą wiedzieć, kiedy produkt wróci. Sklep pisze do nich sam: po zapisaniu produktu, po imporcie
        z hurtowni i codziennie rano (gdy w Integracjach jest klucz Resend). Możesz też wysłać od razu albo napisać ręcznie.
      </p>
      <ActionForm action={sendAlertsNow} submitLabel="Wyślij teraz do czekających (produkty na stanie)" />
      {list.length === 0 && <p className="muted">Nikt nie czeka na powiadomienie.</p>}

      {list.map(({ variant: v, alerts }) => {
        const p = v?.products;
        const title = `${p?.name || 'Produkt'}${v?.name ? ` (${v.name})` : ''}`;
        const url = p ? `${base}/produkt/${p.slug}?wariant=${v.id}` : base;
        const mail = `mailto:${s.email || ''}?bcc=${encodeURIComponent(alerts.map((a) => a.email).join(','))}`
          + `&subject=${encodeURIComponent(`${title} znów dostępny`)}`
          + `&body=${encodeURIComponent(`Dzień dobry,\n\nprodukt, na który czekasz, jest już dostępny:\n${title}\n${url}\n\nPozdrawiamy\n${s.shop_name}`)}`;
        return (
          <details key={v?.id ?? title} className="order" open={v?.stock > 0}>
            <summary>
              <strong>{title}</strong>
              <span>{alerts.length} {alerts.length === 1 ? 'osoba' : 'osób'}</span>
              {v?.stock > 0
                ? <span className="status status-zrealizowane">Na stanie: {v.stock} - do wysłania</span>
                : <span className="status status-anulowane">Brak na stanie</span>}
            </summary>
            <div className="order-details">
              <p className="small">
                {p && <Link href={`/admin/produkty/${p.id}`}>Edytuj produkt</Link>}
                {p && <> · <Link href={`/produkt/${p.slug}?wariant=${v.id}`} target="_blank">Zobacz w sklepie</Link></>}
              </p>
              {v?.stock > 0 && (
                <p><a className="btn btn-small btn-light" href={mail}>Napisz ręcznie ze swojej poczty ({alerts.length})</a></p>
              )}
              <ul className="import-list">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <span>{a.email} <span className="muted small">· {new Date(a.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })}</span></span>
                    <ActionForm action={deleteAlert} submitLabel="Usuń" danger confirm="Usunąć ten zapis?" className="delete-form">
                      <input type="hidden" name="id" value={a.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
              <ActionForm action={markNotified} submitLabel="Wysłałem - oznacz jako powiadomione">
                <input type="hidden" name="variant_id" value={v?.id} />
              </ActionForm>
            </div>
          </details>
        );
      })}
    </>
  );
}
