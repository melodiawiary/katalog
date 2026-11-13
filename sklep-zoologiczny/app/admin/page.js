import { createClient } from '@/lib/supabase/server';
import ActionForm from '@/components/admin/ActionForm';
import { updateOrder, resendConfirmation, deleteTestOrder } from './actions';
import { price, STATUS, shippingLabel, PAYMENT, PAYMENT_STATUS } from '@/lib/shop';
import { needsSql } from '@/lib/admin';
import { trackingUrl } from '@/lib/mail-templates';

const MAIL_KIND = {
  potwierdzenie: 'Potwierdzenie zamówienia',
  kopia_sklep: 'Kopia dla sklepu',
  status_oplacone: 'Płatność przyjęta',
  status_wyslane: 'Wysłane',
  status_zrealizowane: 'Zrealizowane',
  status_anulowane: 'Anulowane',
};

const fmt = (d) => new Date(d).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' });

export default async function OrdersPage({ searchParams }) {
  const { status, widok } = await searchParams;
  const supabase = await createClient();

  const build = (select) => {
    let q = supabase.from('orders').select(select).order('created_at', { ascending: false }).limit(200);
    if (STATUS[status]) q = q.eq('status', status);
    if (widok === 'nieoplacone') q = q.eq('payment_status', 'nieoplacone').neq('status', 'anulowane');
    if (widok === 'testowe') q = q.eq('is_test', true);
    return q;
  };
  let { data: orders, error } = await build('*, order_items(*), email_log(id, kind, to_email, ok, error, created_at), payments(id, status, error, created_at, paid_at)');
  const oldDb = needsSql(error);
  if (oldDb) ({ data: orders, error } = await build('*, order_items(*)'));

  const chip = (href, active, label) => <a href={href} className={active ? 'chip active' : 'chip'}>{label}</a>;

  return (
    <>
      <h1>Zamówienia</h1>
      {oldDb && <p className="alert">Wklej w Supabase plik supabase/06_zamowienie.sql, żeby działały paczkomaty, płatności online i e-maile.</p>}
      {error && !oldDb && <p className="alert">{error.message}</p>}
      <nav className="chips">
        {chip('/admin', !STATUS[status] && !widok, 'Wszystkie')}
        {Object.entries(STATUS).map(([key, label]) => chip(`/admin?status=${key}`, status === key, label))}
        {!oldDb && chip('/admin?widok=nieoplacone', widok === 'nieoplacone', 'Nieopłacone')}
        {!oldDb && chip('/admin?widok=testowe', widok === 'testowe', 'Testowe')}
      </nav>

      {orders?.length === 0 && <p className="muted">Brak zamówień.</p>}

      {orders?.map((o) => {
        const track = trackingUrl(o);
        const mails = [...(o.email_log || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const pays = [...(o.payments || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
        return (
          <details key={o.id} className="order">
            <summary>
              <strong>#{o.number}</strong>
              {o.is_test && <span className="badge-test">TEST</span>}
              <span>{fmt(o.created_at)}</span>
              <span>{o.customer_name}</span>
              <strong>{price(o.total)}</strong>
              <span className={`status status-${o.status}`}>{STATUS[o.status]}</span>
              {o.payment_status && <span className={`status pay-${o.payment_status}`}>{PAYMENT_STATUS[o.payment_status]}</span>}
            </summary>
            <div className="order-details">
              <p>
                {o.customer_name}<br />
                {o.shipping_method === 'paczkomat' && o.locker_id
                  ? <>Paczkomat <strong>{o.locker_id}</strong>{o.locker_desc ? `, ${o.locker_desc}` : ''}<br /></>
                  : <>{o.address}, {o.postal_code} {o.city}<br /></>}
                <a href={`mailto:${o.email}`}>{o.email}</a> · <a href={`tel:${o.phone}`}>{o.phone}</a>
              </p>
              <p>
                Dostawa: {shippingLabel(o.shipping_method)} ({price(o.shipping_cost)}) · Płatność: {PAYMENT[o.payment_method]?.short || o.payment_method}
                {o.paid_at && <> · opłacone {fmt(o.paid_at)}</>}
              </p>
              {o.notes && <p><em>Uwagi: {o.notes}</em></p>}
              <ul>
                {o.order_items.map((i) => (
                  <li key={i.id}>
                    {i.product_name}{i.variant_name ? ` - ${i.variant_name}` : ''} × {i.quantity} - {price(i.price * i.quantity)}
                    {i.ean && <span className="muted small"> · EAN {i.ean}</span>}
                  </li>
                ))}
              </ul>

              <ActionForm action={updateOrder} submitLabel="Zapisz" className="stack-form">
                <input type="hidden" name="id" value={o.id} />
                <label>
                  Status
                  <select name="status" defaultValue={o.status}>
                    {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                {!oldDb && (
                  <label>
                    Numer przesyłki (wpisz przy „Wysłane”)
                    <input name="tracking_number" defaultValue={o.tracking_number || ''} inputMode="numeric" placeholder="np. 520000011234567890123456" />
                  </label>
                )}
                {track && <p className="small"><a href={track} target="_blank" rel="noopener noreferrer">Śledź przesyłkę</a></p>}
                <label className="radio"><input type="checkbox" name="notify" defaultChecked /> Wyślij klientowi e-mail o zmianie</label>
              </ActionForm>

              {!oldDb && (
                <>
                  {pays.length > 0 && (
                    <>
                      <p className="small"><strong>Płatności online:</strong></p>
                      <ul className="mail-log">
                        {pays.map((p) => (
                          <li key={p.id}>
                            {fmt(p.created_at)} · {p.status === 'oplacona' ? '✓ opłacona' : p.status === 'blad' ? '✗ błąd' : 'rozpoczęta, bez wpłaty'}
                            {p.error && <span className="alert-text"> · {p.error}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="small"><strong>E-maile:</strong> {mails.length === 0 && <span className="muted">jeszcze żaden</span>}</p>
                  {mails.length > 0 && (
                    <ul className="mail-log">
                      {mails.map((m) => (
                        <li key={m.id}>
                          {m.ok ? '✓' : '✗'} {fmt(m.created_at)} · {MAIL_KIND[m.kind] || m.kind} · {m.to_email}
                          {m.error && <span className="alert-text"> · {m.error}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="order-actions">
                    <ActionForm action={resendConfirmation} submitLabel="Wyślij ponownie potwierdzenie" className="inline-form">
                      <input type="hidden" name="id" value={o.id} />
                    </ActionForm>
                    {o.is_test && (
                      <ActionForm action={deleteTestOrder} submitLabel="Usuń zamówienie testowe" danger confirm="Usunąć to zamówienie testowe? Towar wróci na stan." className="inline-form">
                        <input type="hidden" name="id" value={o.id} />
                      </ActionForm>
                    )}
                  </div>
                </>
              )}
            </div>
          </details>
        );
      })}
    </>
  );
}
