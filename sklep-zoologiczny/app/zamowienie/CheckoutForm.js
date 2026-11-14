'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { useCartRefresh, UNAVAILABLE } from '@/components/useCartRefresh';
import LockerPicker, { lockerText } from '@/components/checkout/LockerPicker';
import { placeOrder } from './actions';
import { price, shippingCost, SHIPPING, PAYMENT } from '@/lib/shop';
import { shippingInfo } from '@/lib/shipping-time';

const DATA_KEY = 'dane-klienta';

function storedCustomer() {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; } catch { return {}; }
}

export default function CheckoutForm({ salesEnabled, testMode, features, ship }) {
  const { items, loaded, subtotal } = useCart();
  const [state, formAction, pending] = useActionState(placeOrder, null);
  const [saved] = useState(storedCustomer);
  const [shipping, setShipping] = useState(saved.shipping === 'kurier' ? 'kurier' : 'paczkomat');
  const [payment, setPayment] = useState(features.p24 ? 'p24' : 'przelew');
  const [locker, setLocker] = useState(null);
  const [localError, setLocalError] = useState('');
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

  const canOrder = salesEnabled || testMode;
  const delivery = shippingCost(shipping, subtotal);
  const blocked = items.filter((i) => i.unavailable);
  const payload = items
    .filter((i) => !i.unavailable)
    .map((i) => (i.variant_id ? { variant_id: i.variant_id, quantity: i.quantity } : { product_id: i.product_id, quantity: i.quantity }));
  const when = shippingInfo(new Date(), ship.cutoff, ship.handlingDays);
  const v = state?.values || saved;

  const onSubmit = (e) => {
    setLocalError('');
    if (shipping === 'paczkomat' && !locker) {
      e.preventDefault();
      setLocalError('Wybierz paczkomat z mapy.');
      document.querySelector('.locker-picker, .locker-chosen')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    try {
      const fd = new FormData(e.currentTarget);
      const keep = { shipping };
      for (const k of ['name', 'email', 'phone', 'address', 'postal_code', 'city']) keep[k] = String(fd.get(k) || '');
      localStorage.setItem(DATA_KEY, JSON.stringify(keep));
    } catch { /* bez zapamiętywania */ }
  };

  return (
    <form action={formAction} onSubmit={onSubmit} className="checkout">
      <h1>Zamówienie</h1>
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <input type="hidden" name="shipping" value={shipping} />
      <input type="hidden" name="locker_id" value={shipping === 'paczkomat' ? locker?.id || '' : ''} />
      <input type="hidden" name="locker_desc" value={shipping === 'paczkomat' ? lockerText(locker) : ''} />

      {testMode && (
        <p className="box">
          <strong>Zamówienie testowe.</strong> Sprzedaż jest wyłączona, ale jesteś zalogowany jako administrator,
          więc możesz przetestować zamówienie. W panelu będzie oznaczone jako TEST i można je usunąć (towar wróci na stan).
        </p>
      )}

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
        <legend>Dostawa</legend>
        {Object.entries(SHIPPING).map(([key, s]) => (
          <label key={key} className="radio ship-option">
            <input type="radio" name="shipping_choice" value={key} checked={shipping === key} onChange={() => setShipping(key)} />
            <span>
              {s.label} - <strong>{price(shippingCost(key, subtotal))}</strong>
              <span className="small muted ship-when">dostawa {when.delivery}</span>
            </span>
          </label>
        ))}
        {shipping === 'paczkomat' && (
          <LockerPicker value={locker} onChange={(p) => { setLocker(p); setLocalError(''); }} geowidgetToken={features.geowidget_token} />
        )}
      </fieldset>

      <fieldset>
        <legend>{shipping === 'paczkomat' ? 'Twoje dane' : 'Dane do wysyłki'}</legend>
        <label>Imię i nazwisko<input name="name" required autoComplete="name" defaultValue={v.name || ''} /></label>
        <label>E-mail<input name="email" type="email" required autoComplete="email" defaultValue={v.email || ''} /></label>
        <label>
          Telefon {shipping === 'paczkomat' ? '(na ten numer przyjdzie SMS z kodem odbioru)' : '(dla kuriera)'}
          <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="600 100 200"
            pattern="(\+?48)?[ \-]?\d{3}[ \-]?\d{3}[ \-]?\d{3}" title="9 cyfr, np. 600 100 200" defaultValue={v.phone || ''} />
        </label>
        {shipping === 'kurier' && (
          <>
            <label>Ulica i numer<input name="address" required autoComplete="street-address" defaultValue={v.address || ''} /></label>
            <div className="row">
              <label>Kod pocztowy<input name="postal_code" required pattern="\d{2}-\d{3}" placeholder="00-000" autoComplete="postal-code" inputMode="numeric" defaultValue={v.postal_code || ''} /></label>
              <label>Miejscowość<input name="city" required autoComplete="address-level2" defaultValue={v.city || ''} /></label>
            </div>
          </>
        )}
        <label>Uwagi do zamówienia (nieobowiązkowe)<textarea name="notes" rows={2} defaultValue={state?.values?.notes || ''} /></label>
      </fieldset>

      <fieldset>
        <legend>Płatność</legend>
        {Object.entries(PAYMENT)
          .filter(([key]) => key !== 'p24' || features.p24)
          .map(([key, p]) => (
            <label key={key} className="radio">
              <input type="radio" name="payment" value={key} checked={payment === key} onChange={() => setPayment(key)} />
              <span>
                {p.label}
                {key === 'p24' && <span className="small muted"> (Przelewy24{features.p24_sandbox ? ', tryb testowy' : ''})</span>}
              </span>
            </label>
          ))}
      </fieldset>

      <div className="summary">
        <p>Produkty: {price(subtotal)}</p>
        <p>Dostawa: {price(delivery)}</p>
        <p className="total">Do zapłaty: {price(subtotal + delivery)}</p>
        <p className="small ship-summary">
          🚚 Wyślemy {when.ship}, przewidywana dostawa: <strong>{when.delivery}</strong>
          {payment === 'przelew' && ' (po zaksięgowaniu przelewu)'}
        </p>
        <label className="radio">
          <input type="checkbox" name="regulamin" required />
          <span>
            Zapoznałem się z <Link href="/regulamin" target="_blank">regulaminem</Link> i <Link href="/polityka-prywatnosci" target="_blank">polityką prywatności</Link> i akceptuję regulamin
          </span>
        </label>
        {(localError || state?.error) && <p className="alert">{localError || state.error}</p>}
        {blocked.length > 0 && (
          <p className="alert">Część produktów jest niedostępna. <Link href="/koszyk">Popraw koszyk</Link>, żeby zamówić.</p>
        )}
        {!canOrder && (
          <p className="alert">Sklep jeszcze nie przyjmuje zamówień. Koszyk zostanie zapamiętany, zapraszamy wkrótce!</p>
        )}
        <button className="btn btn-big" disabled={pending || !canOrder || !checked || blocked.length > 0}>
          {!canOrder ? 'Zamówienia wkrótce' : pending ? 'Wysyłanie…' : 'Zamawiam z obowiązkiem zapłaty'}
        </button>
        <p className="small muted center-text">Masz 14 dni na odstąpienie od umowy. <Link href="/zwroty" target="_blank">Zwroty i reklamacje</Link></p>
        {payment === 'p24' && canOrder && <p className="small muted center-text">Po kliknięciu przejdziesz do bezpiecznej płatności Przelewy24.</p>}
      </div>
    </form>
  );
}
