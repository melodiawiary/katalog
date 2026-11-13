import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClearCart from '@/components/ClearCart';
import { price, SHIPPING, PAYMENT } from '@/lib/shop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dziękujemy za zamówienie' };

export default async function OrderPage({ params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: order } = await supabase.rpc('get_order', { p_id: id });
  if (!order) notFound();

  return (
    <div className="order-done">
      <ClearCart />
      <h1>Dziękujemy za zamówienie! 🐾</h1>
      <p>Numer zamówienia: <strong>{order.number}</strong></p>

      <ul className="order-items">
        {order.items.map((i, idx) => (
          <li key={idx}>
            {i.name} × {i.quantity} <span>{price(i.price * i.quantity)}</span>
          </li>
        ))}
        <li>Dostawa ({SHIPPING[order.shipping_method]?.label}) <span>{price(order.shipping_cost)}</span></li>
        <li className="total">Razem <span>{price(order.total)}</span></li>
      </ul>

      {order.payment_method === 'przelew' ? (
        <div className="box">
          <h2>Dane do przelewu</h2>
          <p>Kwota: <strong>{price(order.total)}</strong></p>
          <p>Tytuł: <strong>Zamówienie nr {order.number}</strong></p>
          <p>Numer konta: <strong>{process.env.NEXT_PUBLIC_BANK_ACCOUNT || '(uzupełnij w ustawieniach)'}</strong></p>
          {process.env.NEXT_PUBLIC_BANK_RECIPIENT && <p>Odbiorca: {process.env.NEXT_PUBLIC_BANK_RECIPIENT}</p>}
          <p className="muted">Wyślemy paczkę po zaksięgowaniu wpłaty.</p>
        </div>
      ) : (
        <div className="box">
          <p>{PAYMENT[order.payment_method]?.label}: zapłacisz {price(order.total)} przy odbiorze paczki.</p>
        </div>
      )}

      <Link href="/" className="btn">Wróć do sklepu</Link>
    </div>
  );
}
