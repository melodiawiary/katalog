'use client';

import { useState } from 'react';
import Link from 'next/link';

// Strona "Wszystkie usługi": szukanie po nazwie i opisie oraz szybkie filtry kategorii.
export default function ServicesBrowser({ items, contactHref }) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('');
  const term = q.trim().toLowerCase();
  const list = items.filter((c) => {
    if (only && c.slug !== only) return false;
    if (!term) return true;
    return `${c.name} ${c.title} ${c.blurb}`.toLowerCase().includes(term);
  });
  const chips = items.slice(0, 7);

  return (
    <>
      <label className="svcpage-search">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj usług, np. weterynarz, groomer, hotel..." aria-label="Szukaj usług" />
      </label>
      <div className="svcpage-chips" role="group" aria-label="Kategorie">
        <button type="button" className={!only ? 'svcpage-chip active' : 'svcpage-chip'} onClick={() => setOnly('')}>Wszystkie</button>
        {chips.map((c) => (
          <button type="button" key={c.slug} className={only === c.slug ? 'svcpage-chip active' : 'svcpage-chip'} onClick={() => setOnly(only === c.slug ? '' : c.slug)}>{c.name}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="muted">Nic nie znaleziono. Spróbuj innego słowa albo napisz do nas.</p>
      ) : (
        <ul className="svcpage-grid">
          {list.map((c) => (
            <li key={c.slug}>
              <Link href={c.href} className="svcpage-card">
                <img src={`/ikony/uslugi/${c.icon}.png`} alt="" loading="lazy" />
                <span className="svcpage-text"><strong>{c.title}</strong><span>{c.blurb}</span></span>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e8801f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="svcpage-help">
        <div><strong>Nie znalazłeś tego, czego szukasz?</strong><span>Skontaktuj się z nami, a pomożemy Ci znaleźć odpowiednią usługę!</span></div>
        <a href={contactHref} className="svcpage-help-btn">Skontaktuj się</a>
      </div>
    </>
  );
}
