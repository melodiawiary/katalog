'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { OPEN_EVENT, OPTIONAL_CATEGORIES, readConsent, saveConsent } from '@/lib/consent';

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState({});

  useEffect(() => {
    const c = readConsent();
    if (c) setChoices(c); else setOpen(true);
    const reopen = () => { setChoices(readConsent() || {}); setOpen(true); };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;
  const optional = OPTIONAL_CATEGORIES.length > 0;
  const close = (c) => { saveConsent(c); setOpen(false); };
  const all = Object.fromEntries(OPTIONAL_CATEGORIES.map((c) => [c.key, true]));
  const none = Object.fromEntries(OPTIONAL_CATEGORIES.map((c) => [c.key, false]));

  return (
    <div className="cookie-banner" role="dialog" aria-label="Pliki cookies">
      <p>
        <strong>Cookies i pamięć przeglądarki.</strong>{' '}
        {optional
          ? 'Niezbędne dane (koszyk, dane do zamówienia) zapisujemy zawsze. Pozostałe tylko za Twoją zgodą.'
          : 'Zapisujemy w przeglądarce tylko to, co niezbędne do działania sklepu: koszyk, ostatnio wpisane dane do zamówienia i wybrany paczkomat. Nie używamy cookies reklamowych ani analitycznych.'}{' '}
        <Link href="/polityka-cookies">Szczegóły</Link>
      </p>
      {optional && OPTIONAL_CATEGORIES.map((c) => (
        <label key={c.key} className="radio">
          <input type="checkbox" checked={Boolean(choices[c.key])} onChange={(e) => setChoices({ ...choices, [c.key]: e.target.checked })} />
          <span><strong>{c.label}</strong> - {c.desc}</span>
        </label>
      ))}
      <div className="cookie-actions">
        {optional ? (
          <>
            <button type="button" className="btn btn-small" onClick={() => close(all)}>Akceptuję wszystkie</button>
            <button type="button" className="btn btn-small" onClick={() => close(choices)}>Zapisz wybór</button>
            <button type="button" className="link-btn" onClick={() => close(none)}>Tylko niezbędne</button>
          </>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => close({})}>Rozumiem</button>
        )}
      </div>
    </div>
  );
}
