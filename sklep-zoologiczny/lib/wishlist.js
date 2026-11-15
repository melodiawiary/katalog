// Ulubione produkty: zapis w przeglądarce klienta (bez konta). Używane tylko w komponentach klienckich.
const KEY = 'ulubione';
const EMPTY = [];
const listeners = new Set();
let cache = null;

function read() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter(Number.isInteger).slice(0, 200) : [];
  } catch { return []; }
}

export function subscribe(cb) {
  listeners.add(cb);
  const onStorage = () => { cache = null; cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
export function getSnapshot() { if (cache === null) cache = read(); return cache; }
export function getServerSnapshot() { return EMPTY; }

export function toggleWish(id) {
  const cur = read();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur];
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  cache = next;
  listeners.forEach((l) => l());
}
