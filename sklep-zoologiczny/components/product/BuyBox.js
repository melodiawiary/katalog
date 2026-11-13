'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart, cartItem } from '@/components/CartProvider';
import { price, FREE_SHIPPING_FROM } from '@/lib/shop';
import ShipTime from './ShipTime';
import NotifyForm from './NotifyForm';

const UNIT = { kg: 'kg', l: 'l' };
const LOW_STOCK = 3;

function promoEnd(v) {
  if (!v.promo_to) return null;
  return new Date(v.promo_to).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long' });
}

// Wybór wariantu, cena (z Omnibusem i ceną za kg), dostępność, wysyłka, ilość i "Do koszyka"
export default function BuyBox({ product, initialVariantId, shipCutoff, shipHandlingDays }) {
  const variants = product.variants;
  const multi = variants.length > 1;
  const [selectedId, setSelectedId] = useState(initialVariantId);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { add, items, subtotal } = useCart();

  const v = variants.find((x) => x.id === selectedId) || variants[0];
  const reduced = v.promo_active && Number(v.effective_price) < Number(v.price);
  const percent = reduced ? Math.round((1 - v.effective_price / v.price) * 100) : 0;
  const inCart = items.find((i) => i.variant_id === v.id || (!multi && i.product_id === product.id));
  const maxQty = Math.max(0, Math.min(v.stock - (inCart?.quantity || 0), 99));
  const missing = FREE_SHIPPING_FROM - subtotal;

  function choose(id) {
    setSelectedId(id);
    setQty(1);
    setAdded(false);
    // adres strony z wybranym wariantem (da się go wysłać komuś)
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('wariant', id);
      window.history.replaceState(null, '', url);
    } catch {}
  }

  function addToCart() {
    if (qty < 1 || qty > maxQty) return;
    add(cartItem(product, v, variants.length), qty);
    setAdded(true);
    setQty(1);
  }

  return (
    <div className="buybox">
      {multi && (
        <div className="variant-picker" role="radiogroup" aria-label="Wariant">
          {variants.map((x) => {
            const xReduced = x.promo_active && Number(x.effective_price) < Number(x.price);
            return (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={x.id === v.id}
                className={`variant-opt${x.id === v.id ? ' on' : ''}${x.stock < 1 ? ' out' : ''}`}
                onClick={() => choose(x.id)}
              >
                <span className="variant-name">{x.name || 'Standard'}</span>
                <span className={xReduced ? 'variant-price promo' : 'variant-price'}>{price(x.effective_price)}</span>
                {x.unit_price != null && UNIT[x.unit] && (
                  <span className="variant-unit">{price(x.unit_price)} / {UNIT[x.unit]}</span>
                )}
                {x.stock < 1 && <span className="variant-out">brak</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="buy-price">
        <div className="buy-price-row">
          <strong className={`price big${reduced ? ' price-promo' : ''}`}>{price(v.effective_price)}</strong>
          {reduced && <s className="muted">{price(v.price)}</s>}
          {reduced && percent > 0 && <span className="badge-promo">-{percent}%</span>}
        </div>
        {v.unit_price != null && UNIT[v.unit] && (
          <p className="unit-price">{price(v.unit_price)} / {UNIT[v.unit]}</p>
        )}
        {reduced && (
          <p className="omnibus">
            Najniższa cena z 30 dni przed obniżką: {price(v.lowest_30d ?? v.price)}
            {promoEnd(v) && <> · promocja do {promoEnd(v)}</>}
          </p>
        )}
      </div>

      {v.stock > 0 ? (
        <>
          <p className="stock-ok">
            ✓ Dostępny{v.stock <= LOW_STOCK && <span className="stock-low"> · ostatnie sztuki</span>}
          </p>
          <ShipTime cutoff={shipCutoff} handlingDays={shipHandlingDays} />

          {maxQty > 0 ? (
            <div className="buy-row">
              <div className="qty" aria-label="Ilość">
                <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Mniej">−</button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty} aria-label="Więcej">+</button>
              </div>
              <button type="button" className="btn btn-big buy-btn" onClick={addToCart}>Do koszyka</button>
            </div>
          ) : (
            <p className="muted">Masz w koszyku wszystkie dostępne sztuki tego {multi ? 'wariantu' : 'produktu'}.</p>
          )}

          {added && (
            <div className="added-box" role="status">
              <span>✓ Dodano do koszyka{multi && v.name ? `: ${v.name}` : ''}</span>
              <Link href="/koszyk" className="btn btn-small">Przejdź do koszyka</Link>
            </div>
          )}

          <p className="small muted free-ship">
            {missing > 0
              ? <>Darmowa dostawa od {price(FREE_SHIPPING_FROM)}{subtotal > 0 && <> · brakuje {price(missing)}</>}</>
              : <span className="ok">Masz darmową dostawę!</span>}
          </p>
        </>
      ) : (
        <>
          <p className="stock-out">Chwilowo niedostępny</p>
          <NotifyForm key={v.id} variantId={v.id} label={multi && v.name ? `${product.name} (${v.name})` : product.name} />
        </>
      )}
    </div>
  );
}
