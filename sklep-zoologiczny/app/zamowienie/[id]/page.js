import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClearCart from '@/components/ClearCart';
import PaymentWatcher from '@/components/checkout/PaymentWatcher';
import { price, shippingLabel, PAYMENT, STATUS } from '@/lib/shop';
import { getSettings, formatAccount } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import { checkPendingPayments } from '@/lib/payments';
import { trackingUrl, deliveryText } from '@/lib/mail-templates';
import { payAgain } from '../actions';
import { currentUser } from '@/lib/account';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Twoje zamówienie', robots: { index: false } };

export default async function OrderPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { user } = await currentUser();
  const s = await getSettings();
  let { data: order } = await supabase.rpc('get_order', { p_id: id });
  if (!order) notFound();

  // płatność online jeszcze niezaksięgowana: pytamy Przelewy24 (gdy powiadomienie nie dotarło)
  const p24Pending = order.payment_method === 'p24' && order.payment_status !== 'oplacone' && order.status !== 'anulowane';
  if (p24Pending) {
    const r = await checkPendingPayments(id, await siteUrl(s)).catch(() => null);
    if (r?.paid) ({ data: order } = await supabase.rpc('get_order', { p_id: id }));
  }
  const paid = order.payment_status === 'oplacone';
  const track = trackingUrl(order);
  const justOrdered = Date.now() - new Date(order.created_at).getTime() < 30 * 60000;

  return (
    <div className="order-done">
      {justOrdered && <ClearCart />}
      {order.is_test && <p className="box"><strong>Zamówienie testowe</strong> - sklep jeszcze nie sprzedaje.</p>}
      <h1>{justOrdered ? 'Dziękujemy za zamówienie! 🐾' : `Zamówienie nr ${order.number}`}</h1>
      <p>
        Numer zamówienia: <strong>{order.number}</strong> · Status: <span className={`status status-${order.status}`}>{STATUS[order.status] || order.status}</span>
      </p>
      {justOrdered && <p className="muted small">Potwierdzenie wysyłamy na adres {order.email}. Zachowaj ten link, żeby sprawdzić zamówienie później.</p>}

      {order.status !== 'anulowane' && order.payment_method === 'p24' && (
        paid ? (
          <div className="box ok-box">✓ Płatność przyjęta. Dziękujemy!</div>
        ) : (
          <div className="box">
            <h2>Płatność online</h2>
            {sp?.blad === 'platnosc' && <p className="alert">Nie udało się rozpocząć płatności. Spróbuj ponownie za chwilę.</p>}
            {sp?.platnosc ? (
              <PaymentWatcher />
            ) : (
              <p>Zamówienie czeka na płatność: <strong>{price(order.total)}</strong> (BLIK, szybki przelew, karta).</p>
            )}
            <form action={payAgain}>
              <input type="hidden" name="id" value={order.id} />
              <button className="btn">{sp?.platnosc ? 'Zapłać ponownie' : 'Zapłać teraz'}</button>
            </form>
          </div>
        )
      )}

      <ul className="order-items">
        {order.items.map((i, idx) => (
          <li key={idx}>
            {i.name} × {i.quantity} <span>{price(i.price * i.quantity)}</span>
          </li>
        ))}
        <li>Dostawa ({shippingLabel(order.shipping_method)}) <span>{price(order.shipping_cost)}</span></li>
        <li className="total">Razem <span>{price(order.total)}</span></li>
      </ul>

      <div className="box">
        <p><strong>Dostawa:</strong> {deliveryText(order)}</p>
        {order.tracking_number && (
          <p>
            Numer przesyłki: <strong>{order.tracking_number}</strong>
            {track && <> · <a href={track} target="_blank" rel="noopener noreferrer">Śledź paczkę</a></>}
          </p>
        )}
      </div>

      {order.status !== 'anulowane' && order.payment_method === 'przelew' && !paid && (
        <div className="box">
          <h2>Dane do przelewu</h2>
          <p>Kwota: <strong>{price(order.total)}</strong></p>
          <p>Tytuł: <strong>Zamówienie nr {order.number}</strong></p>
          <p>Numer konta: <strong>{s.bank_account ? formatAccount(s.bank_account) : '(brak - uzupełnij w panelu)'}</strong></p>
          {s.company_name && (
            <p>Odbiorca: {s.company_name}, {s.address}, {s.postal_code} {s.city}</p>
          )}
          <p className="muted">Wyślemy paczkę po zaksięgowaniu wpłaty.</p>
        </div>
      )}
      {order.payment_method === 'przelew' && paid && <div className="box ok-box">✓ Przelew zaksięgowany. Dziękujemy!</div>}
      {order.payment_method === 'pobranie' && (
        <div className="box">
          <p>{PAYMENT.pobranie.label}: zapłacisz {price(order.total)} przy odbiorze paczki.</p>
        </div>
      )}

      {justOrdered && !user && (
        <div className="box">
          <h2>Załóż konto jednym kliknięciem</h2>
          <p>Zobaczysz tu historię zamówień, zamówisz ponownie jednym przyciskiem i ustawisz przypomnienie o karmie.
            Bez hasła: wyślemy link na {order.email}.</p>
          <Link href={`/konto/logowanie?email=${encodeURIComponent(order.email)}&next=/konto/zamowienia`} className="btn btn-small">Załóż konto</Link>
        </div>
      )}
      {user && <p><Link href="/konto/zamowienia">Wszystkie moje zamówienia</Link></p>}

      <Link href="/sklep" className="btn">Wróć do sklepu</Link>
    </div>
  );
}
