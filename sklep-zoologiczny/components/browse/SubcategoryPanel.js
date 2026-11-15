'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'panel-kategorii-zwiniety';

// Rozwijany panel z podkategoriami (kafelki z ikonami). Stan zwinięcia pamiętany w przeglądarce.
export default function SubcategoryPanel({ title, items, allHref, allLabel }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { if (window.localStorage.getItem(KEY) === '1') setOpen(false); } catch {}
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(KEY, next ? '0' : '1'); } catch {}
  }

  return (
    <section className="subcat-panel" aria-label={title}>
      <button type="button" className="subcat-head" onClick={toggle} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
        <strong>{title}</strong>
        <span className="subcat-toggle">{open ? 'Zwiń' : 'Rozwiń'}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'none' : 'rotate(180deg)' }}><path d="M6 15l6-6 6 6" /></svg>
        </span>
      </button>
      {open && (
        <div className="subcat-body">
          <div className="subcat-grid">
            {items.map((c) => (
              <Link key={c.slug} href={c.href} className={`subcat-tile${c.active ? ' active' : ''}`}>
                {c.icon ? <img src={c.icon} alt="" width="40" height="40" /> : <span className="subcat-emoji" aria-hidden="true">{c.emoji}</span>}
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
          {allHref && <Link href={allHref} className="subcat-all">{allLabel}</Link>}
        </div>
      )}
    </section>
  );
}
