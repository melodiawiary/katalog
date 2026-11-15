'use client';
import { useSyncExternalStore } from 'react';

const KEY = 'widok-produktow';
const listeners = new Set();
let cache = null;

function read() {
  try { const v = window.localStorage.getItem(KEY); return v === 'lista' ? 'lista' : 'kafelki'; } catch { return 'kafelki'; }
}
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
const getSnapshot = () => (cache ??= read());
const getServerSnapshot = () => 'kafelki';

function useView() { return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot); }

// Przełącznik widoku (ikony): kafelki albo lista, wybór pamiętany w przeglądarce
export function ViewToggle() {
  const view = useView();
  function choose(v) {
    cache = v;
    try { window.localStorage.setItem(KEY, v); } catch {}
    listeners.forEach((l) => l());
  }
  return (
    <div className="view-toggle" role="group" aria-label="Widok produktów">
      <button type="button" className={view === 'kafelki' ? 'is-on' : ''} aria-pressed={view === 'kafelki'} aria-label="Kafelki" onClick={() => choose('kafelki')}>
        <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="7" height="7" rx="1.5" /><rect x="11" y="2" width="7" height="7" rx="1.5" /><rect x="2" y="11" width="7" height="7" rx="1.5" /><rect x="11" y="11" width="7" height="7" rx="1.5" /></svg>
      </button>
      <button type="button" className={view === 'lista' ? 'is-on' : ''} aria-pressed={view === 'lista'} aria-label="Lista" onClick={() => choose('lista')}>
        <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="2" y="3" width="4" height="4" rx="1" /><rect x="8" y="4" width="10" height="2" rx="1" /><rect x="2" y="9" width="4" height="4" rx="1" /><rect x="8" y="10" width="10" height="2" rx="1" /><rect x="2" y="15" width="4" height="3" rx="1" /><rect x="8" y="15.5" width="10" height="2" rx="1" /></svg>
      </button>
    </div>
  );
}

export default function ProductGrid({ children }) {
  const view = useView();
  return <div className={`grid product-grid${view === 'lista' ? ' is-list' : ''}`}>{children}</div>;
}
