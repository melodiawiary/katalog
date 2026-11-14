import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { price, STATUS, shippingLabel } from '@/lib/shop';
import ReorderButton from '@/components/account/ReorderButton';

export const metadata = { title: 'Moje zamówienia', robots: { index: false } };

export default async function OrdersPage() {
  const { supabase } = await requireUser('/konto/zamowienia');
  const { data: orders, error } = await supabase.from('orders')
    .select('id, number, created_at, status, total, shipping_method, is_test, order_items(product_name, variant_name, quantity, price, variant_id, product_id, products(slug))')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <h1>Moje zamówienia</h1>
      {error && <p className="alert">Nie udało się wczytać zamówień. Odśwież stronę.</p>}
      {!error && !orders?.length && (
        <p className="box">Nie ma tu jeszcze zamówień. Jeśli kupowałeś u nas wcześniej na ten sam e-mail, pojawią się po zalogowaniu tym adresem.</p>
      )}
      <ul className="plain order-list">
        {(orders || []).map((o) => {
          const delivered = o.status === 'wyslane' || o.status === 'zrealizowane';
          return (
            <li key={o.id} className="box order-card">
              <div className="order-card-head">
                <strong>Zamówienie nr {o.number}</strong>
                <span className="muted">{new Date(o.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })}</span>
                <span className={`status status-${o.status}`}>{STATUS[o.status] || o.status}</span>
                {o.is_test && <span className="badge-test">TEST</span>}
                <strong className="order-card-total">{price(o.total)}</strong>
              </div>
              <ul className="order-card-items">
                {o.order_items.map((i, idx) => {
                  const slug = i.products?.slug;
                  return (
                    <li key={idx}>
                      {slug ? <Link href={`/produkt/${slug}`}>{i.product_name}</Link> : i.product_name}
                      {i.variant_name ? ` (${i.variant_name})` : ''} × {i.quantity}
                      <span className="item-links small">
                        {i.variant_id && o.status !== 'anulowane' && <Link href={`/konto/przypomnienia?dodaj=${i.variant_id}`}>Przypomnij o karmie</Link>}
                        {delivered && slug && <Link href={`/produkt/${slug}#opinie`}>Oceń produkt</Link>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="small muted">Dostawa: {shippingLabel(o.shipping_method)}</p>
              <p className="row-actions">
                <Link href={`/zamowienie/${o.id}`} className="btn btn-small btn-light">Szczegóły i śledzenie</Link>
                {o.status !== 'anulowane' && <ReorderButton orderId={o.id} />}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
