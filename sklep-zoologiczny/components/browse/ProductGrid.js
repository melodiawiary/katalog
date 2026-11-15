'use client';
import { useEffect, useState } from 'react';

const KEY = 'widok-produktow';

// Siatka produktów z przełącznikiem: kafelki (domyślnie, 2 kolumny na telefonie) albo lista
export default function ProductGrid({ children }) {
  const [view, setView] = useState('kafelki');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === 'lista' || saved === 'kafelki') setView(saved);
    } catch {}
  }, []);

  function choose(v) {
    setView(v);
    try { window.localStorage.setItem(KEY, v); } catch {}
  }

  return (
    <>
      <div className="view-toggle" role="group" aria-label="Widok produktów">
        <button type="button" className={view === 'kafelki' ? 'is-on' : ''} aria-pressed={view === 'kafelki'} onClick={() => choose('kafelki')}>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="7" height="7" rx="1.5" /><rect x="11" y="2" width="7" height="7" rx="1.5" /><rect x="2" y="11" width="7" height="7" rx="1.5" /><rect x="11" y="11" width="7" height="7" rx="1.5" /></svg>
          Kafelki
        </button>
        <button type="button" className={view === 'lista' ? 'is-on' : ''} aria-pressed={view === 'lista'} onClick={() => choose('lista')}>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="4" height="4" rx="1" /><rect x="8" y="4" width="10" height="2" rx="1" /><rect x="2" y="9" width="4" height="4" rx="1" /><rect x="8" y="10" width="10" height="2" rx="1" /><rect x="2" y="15" width="4" height="3" rx="1" /><rect x="8" y="15.5" width="10" height="2" rx="1" /></svg>
          Lista
        </button>
      </div>
      <div className={`grid product-grid${view === 'lista' ? ' is-list' : ''}`}>{children}</div>
    </>
  );
}
