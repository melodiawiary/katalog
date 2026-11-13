'use client';

import { useEffect, useState } from 'react';
import { shippingInfo, formatLeft } from '@/lib/shipping-time';

// "Zamów w ciągu 2 godz. 15 min, a wyślemy dziś" - liczone w przeglądarce co minutę
export default function ShipTime({ cutoff, handlingDays }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const tick = () => setInfo(shippingInfo(new Date(), cutoff, handlingDays));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [cutoff, handlingDays]);

  if (!info) return <p className="ship-time" aria-hidden="true">&nbsp;</p>;

  return (
    <p className="ship-time">
      <span aria-hidden="true">🚚 </span>
      {info.minutesLeft != null ? (
        <>Zamów w ciągu <strong>{formatLeft(info.minutesLeft)}</strong>, a wyślemy <strong>dziś</strong>.</>
      ) : (
        <>Wyślemy <strong>{info.ship}</strong>.</>
      )}
      {' '}<span className="muted">Dostawa zwykle {info.delivery}.</span>
    </p>
  );
}
