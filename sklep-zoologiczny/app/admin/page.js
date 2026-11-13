import { createClient } from '@/lib/supabase/server';
import { updateOrderStatus } from './actions';
import { price, STATUS, shippingLabel, PAYMENT } from '@/lib/shop';

export default async function OrdersPage({ searchParams }) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
  if (STATUS[status]) query = query.eq('status', status);
  const { data: orders } = await query;

  return (
    <>
      <h1>Zamówienia</h1>
      <nav className="chips">
        <a href="/admin" className={!STATUS[status] ? 'chip active' : 'chip'}>Wszystkie</a>
        {Object.entries(STATUS).map(([key, label]) => (
          <a key={key} href={`/admin?status=${key}`} className={status === key ? 'chip active' : 'chip'}>{label}</a>
        ))}
      </nav>

      {orders?.length === 0 && <p className="muted">Brak zamówień.</p>}

      {orders?.map((o) => (
        <details key={o.id} className="order">
          <summary>
            <strong>#{o.number}</strong>
            <span>{new Date(o.created_at).toLocaleString('pl-PL')}</span>
            <span>{o.customer_name}</span>
            <strong>{price(o.total)}</strong>
            <span className={`status status-${o.status}`}>{STATUS[o.status]}</span>
          </summary>
          <div className="order-details">
            <p>
              {o.customer_name}<br />
              {o.address}, {o.postal_code} {o.city}<br />
              <a href={`mailto:${o.email}`}>{o.email}</a> · <a href={`tel:${o.phone}`}>{o.phone}</a>
            </p>
            <p>Dostawa: {shippingLabel(o.shipping_method)} ({price(o.shipping_cost)}) · Płatność: {PAYMENT[o.payment_method]?.label}</p>
            {o.notes && <p><em>Uwagi: {o.notes}</em></p>}
            <ul>
              {o.order_items.map((i) => (
                <li key={i.id}>{i.product_name} × {i.quantity} - {price(i.price * i.quantity)}</li>
              ))}
            </ul>
            <form action={updateOrderStatus} className="inline-form">
              <input type="hidden" name="id" value={o.id} />
              <select name="status" defaultValue={o.status}>
                {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button className="btn btn-small">Zmień status</button>
            </form>
          </div>
        </details>
      ))}
    </>
  );
}
