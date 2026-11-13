'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { useCartRefresh, UNAVAILABLE } from '@/components/useCartRefresh';
import { placeOrder } from './actions';
import { price, shippingCost, SHIPPING, PAYMENT } from '@/lib/shop';

export default function CheckoutForm({ salesEnabled }) {
  const { items, loaded, subtotal } = useCart();
  const [state, formAction, pending] = useActionState(placeOrder, null);
  const [shipping, setShipping] = useState('kurier');
  const checked = useCartRefresh();

  if (!loaded) return null;

  if (items.length === 0) {
    return (
      <div className="center">
        <h1>Koszyk jest pusty</h1>
        <Link href="/" className="btn">Przejdź do zakupów</Link>
      </div>
    );
  }

  const delivery = shippingCost(shipping, subtotal);
  const blocked = items.filter((i) => i.unavailable);
  const payload = items
    .filter((i) => !i.unavailable)
    .map((i) => (i.variant_id ? { variant_id: i.variant_id, quantity: i.quantity } : { product_id: i.product_id, quantity: i.quantity }));

  return (
    <form action={formAction} className="checkout">
      <h1>Zamówienie</h1>
      <input type="hidden" name="items" value={JSON.stringify(payload)} />

      <ul className="checkout-items">
        {items.map((i) => (
          <li key={i.key} className={i.unavailable ? 'cart-off' : ''}>
            <span>
              {i.quantity} × {i.name}{i.variant_name ? ` (${i.variant_name})` : ''}
              {i.unavailable && <span className="alert-text small"> - {UNAVAILABLE[i.unavailable] || UNAVAILABLE.usuniety}</span>}
            </span>
            {!i.unavailable && <strong>{price(i.price * i.quantity)}</strong>}
          </li>
        ))}
      </ul>
      <p className="small"><Link href="/koszyk">Zmień koszyk</Link></p>

      <fieldset>
        <legend>Dane do wysyłki</legend>
        <label>Imię i nazwisko<input name="name" required autoComplete="name" /></label>
        <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>Telefon<input name="phone" type="tel" required autoComplete="tel" /></label>
        <label>Ulica i numer<input name="address" required autoComplete="street-address" /></label>
        <div className="row">
          <label>Kod pocztowy<input name="postal_code" required pattern="\d{2}-\d{3}" placeholder="00-000" autoComplete="postal-code" /></label>
          <label>Miejscowość<input name="city" required autoComplete="address-level2" /></label>
        </div>
        <label>Uwagi do zamówienia (np. numer paczkomatu)<textarea name="notes" rows={3} /></label>
      </fieldset>

      <fieldset>
        <legend>Dostawa</legend>
        {Object.entries(SHIPPING).map(([key, s]) => (
          <label key={key} className="radio">
            <input type="radio" name="shipping" value={key} checked={shipping === key} onChange={() => setShipping(key)} />
            {s.label} - {price(shippingCost(key, subtotal))}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Płatność</legend>
        {Object.entries(PAYMENT).map(([key, p], idx) => (
          <label key={key} className="radio">
            <input type="radio" name="payment" value={key} defaultChecked={idx === 0} />
            {p.label}
          </label>
        ))}
      </fieldset>

      <div className="summary">
        <p>Produkty: {price(subtotal)}</p>
        <p>Dostawa: {price(delivery)}</p>
        <p className="total">Do zapłaty: {price(subtotal + delivery)}</p>
        <label className="radio">
          <input type="checkbox" name="regulamin" required /> Akceptuję regulamin sklepu i politykę prywatności
        </label>
        {state?.error && <p className="alert">{state.error}</p>}
        {blocked.length > 0 && (
          <p className="alert">Część produktów jest niedostępna. <Link href="/koszyk">Popraw koszyk</Link>, żeby zamówić.</p>
        )}
        {!salesEnabled && (
          <p className="alert">Sklep jeszcze nie przyjmuje zamówień. Koszyk zostanie zapamiętany, zapraszamy wkrótce!</p>
        )}
        <button className="btn btn-big" disabled={pending || !salesEnabled || !checked || blocked.length > 0}>
          {!salesEnabled ? 'Zamówienia wkrótce' : pending ? 'Wysyłanie…' : 'Zamawiam i płacę'}
        </button>
      </div>
    </form>
  );
}
