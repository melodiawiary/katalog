'use client';

import { WEEKDAYS, SIZE_CLASS } from '@/lib/places';

export const newKey = () => Math.random().toString(36).slice(2);

export const emptyPrice = () => ({
  key: newKey(),
  service: '', size_class: '', breed: '', price_from: '', price_to: '', duration_min: '', note: '',
});

export const toPriceRows = (list) => list.map((p) => ({
  ...emptyPrice(), ...p,
  price_from: String(p.price_from ?? ''),
  price_to: p.price_to == null ? '' : String(p.price_to),
  duration_min: p.duration_min == null ? '' : String(p.duration_min),
  size_class: p.size_class || '', breed: p.breed || '', note: p.note || '',
}));

// ---------- godziny otwarcia ----------
export function HoursEditor({ hours, setHours }) {
  const setRange = (idx, patch) => setHours((hs) => hs.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  const add = (weekday) => setHours((hs) => [...hs, { key: Math.random().toString(36).slice(2), weekday, opens: '09:00', closes: '17:00' }]);
  const remove = (idx) => setHours((hs) => hs.filter((_, i) => i !== idx));
  // poniedziałek -> pozostałe dni robocze
  const copyMonday = () => setHours((hs) => {
    const mon = hs.filter((h) => h.weekday === 1);
    if (!mon.length) return hs;
    const rest = hs.filter((h) => h.weekday === 1 || h.weekday > 5);
    const copies = [2, 3, 4, 5].flatMap((d) => mon.map((h) => ({ ...h, key: Math.random().toString(36).slice(2), weekday: d })));
    return [...rest, ...copies];
  });

  return (
    <div className="hours-edit">
      {Object.entries(WEEKDAYS).map(([d, label]) => {
        const day = Number(d);
        const rows = hours.map((h, i) => ({ h, i })).filter((x) => x.h.weekday === day);
        return (
          <div key={d} className="hours-day">
            <strong>{label}</strong>
            <div className="hours-ranges">
              {rows.length === 0 && <span className="muted">zamknięte</span>}
              {rows.map(({ h, i }) => (
                <span key={h.key} className="hours-range">
                  <input type="time" value={h.opens} onChange={(e) => setRange(i, { opens: e.target.value })} aria-label={`${label} od`} />
                  <span>-</span>
                  <input type="time" value={h.closes} onChange={(e) => setRange(i, { closes: e.target.value })} aria-label={`${label} do`} />
                  <button type="button" className="link-btn danger" onClick={() => remove(i)}>Usuń</button>
                </span>
              ))}
              <button type="button" className="link-btn" onClick={() => add(day)}>+ przedział</button>
            </div>
          </div>
        );
      })}
      <button type="button" className="link-btn" onClick={copyMonday}>Skopiuj poniedziałek na wtorek-piątek</button>
    </div>
  );
}


// Cennik: lista pozycji (wspólna dla panelu admina i właściciela)
export function PricesEditor({ prices, setPrices, services }) {
  const setPrice = (idx, patch) => setPrices((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  return (
    <>
        {prices.map((p, i) => (
          <div key={p.key} className="variant price-row">
            <div className="grid-2">
              <label>Usługa
                <select value={p.service} onChange={(e) => setPrice(i, { service: e.target.value })}>
                  <option value="">Wybierz…</option>
                  {services.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                </select>
              </label>
              <label>Wielkość
                <select value={p.size_class} onChange={(e) => setPrice(i, { size_class: e.target.value })}>
                  <option value="">Każda</option>
                  {Object.entries(SIZE_CLASS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="grid-3p">
              <label>Cena od (zł)<input value={p.price_from} onChange={(e) => setPrice(i, { price_from: e.target.value })} inputMode="decimal" /></label>
              <label>Cena do (zł)<input value={p.price_to} onChange={(e) => setPrice(i, { price_to: e.target.value })} inputMode="decimal" /></label>
              <label>Czas (min)<input value={p.duration_min} onChange={(e) => setPrice(i, { duration_min: e.target.value })} inputMode="numeric" /></label>
            </div>
            <div className="grid-2">
              <label>Rasa (opcjonalnie)<input value={p.breed} onChange={(e) => setPrice(i, { breed: e.target.value })} maxLength={80} /></label>
              <label>Uwaga<input value={p.note} onChange={(e) => setPrice(i, { note: e.target.value })} maxLength={300} /></label>
            </div>
            <button type="button" className="link-btn danger" onClick={() => setPrices((ps) => ps.filter((_, j) => j !== i))}>Usuń pozycję</button>
          </div>
        ))}
      <button type="button" className="btn btn-small btn-light" onClick={() => setPrices((ps) => [...ps, emptyPrice()])}>+ Dodaj pozycję cennika</button>
    </>
  );
}
