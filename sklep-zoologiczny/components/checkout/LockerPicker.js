'use client';

// Wybór paczkomatu InPost z mapy.
// - bez tokenu: własna mapa (Leaflet + OpenStreetMap) z punktami z /api/paczkomaty
// - z tokenem Geowidget (panel: Integracje): oficjalna mapa InPost
// value / onChange: { id, line1, line2, desc } albo null
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLAND = { lat: 52.1, lng: 19.4, zoom: 6 };
const STORE_KEY = 'paczkomat';

export function lockerText(p) {
  if (!p) return '';
  return [p.line1, p.line2].filter(Boolean).join(', ') + (p.desc ? ` (${p.desc})` : '');
}

function readStored() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}

function store(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* bez pamięci */ }
}

function distance(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

export default function LockerPicker({ value, onChange, geowidgetToken }) {
  const [open, setOpen] = useState(!value);

  // ostatnio wybrany paczkomat podpowiadamy od razu
  useEffect(() => {
    if (!value) {
      const last = readStored();
      if (last?.id) { onChange(last); setOpen(false); }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (p) => {
    const clean = { id: p.id, line1: p.line1 || '', line2: p.line2 || '', desc: p.desc || '', lat: p.lat, lng: p.lng };
    store(clean);
    onChange(clean);
    setOpen(false);
  };

  if (value && !open) {
    return (
      <div className="locker-chosen">
        <div>
          <strong>Paczkomat {value.id}</strong>
          <div className="small">{lockerText(value)}</div>
        </div>
        <button type="button" className="btn btn-small btn-light" onClick={() => setOpen(true)}>Zmień</button>
      </div>
    );
  }

  return (
    <div className="locker-picker">
      {geowidgetToken ? <GeoWidget token={geowidgetToken} onPick={choose} /> : <OwnMap onPick={choose} />}
      {value && (
        <button type="button" className="link-btn small" onClick={() => setOpen(false)}>Zostaw paczkomat {value.id}</button>
      )}
    </div>
  );
}

// ---------- oficjalna mapa InPost (Geowidget v5) ----------
function GeoWidget({ token, onPick }) {
  const box = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!document.querySelector('link[data-geowidget]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://geowidget.inpost.pl/inpost-geowidget.css';
      css.dataset.geowidget = '1';
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[data-geowidget]')) {
      const js = document.createElement('script');
      js.src = 'https://geowidget.inpost.pl/inpost-geowidget.js';
      js.defer = true;
      js.dataset.geowidget = '1';
      document.head.appendChild(js);
    }
    const handler = (e) => {
      const p = e.detail || e.details;
      if (!p?.name) return;
      pickRef.current({
        id: String(p.name).toUpperCase(),
        line1: p.address?.line1 || '',
        line2: p.address?.line2 || '',
        desc: p.location_description || '',
      });
    };
    document.addEventListener('onpointselect', handler);
    const el = document.createElement('inpost-geowidget');
    el.setAttribute('onpoint', 'onpointselect');
    el.setAttribute('token', token);
    el.setAttribute('language', 'pl');
    el.setAttribute('config', 'parcelCollect');
    box.current?.replaceChildren(el);
    return () => document.removeEventListener('onpointselect', handler);
  }, [token]);

  return <div ref={box} className="geowidget-box" />;
}

// ---------- własna mapa (Leaflet + OpenStreetMap) ----------
function OwnMap({ onPick }) {
  const mapEl = useRef(null);
  const L = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const quiet = useRef(false); // przesunięcie mapy z kodu - bez ponownego pobierania
  const timer = useRef(null);
  const [points, setPoints] = useState([]);
  const [active, setActive] = useState(null);
  const [center, setCenter] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [zoomHint, setZoomHint] = useState(true);

  const merge = useCallback((list) => {
    setPoints((old) => {
      const byId = new Map(old.map((p) => [p.id, p]));
      for (const p of list) byId.set(p.id, p);
      return [...byId.values()].slice(-400);
    });
  }, []);

  const load = useCallback(async (url) => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) setMsg(data.error);
      merge(data.points || []);
      return data;
    } catch {
      setMsg('Nie udało się pobrać paczkomatów. Sprawdź internet i spróbuj ponownie.');
      return {};
    } finally {
      setBusy(false);
    }
  }, [merge]);

  const goTo = useCallback((c, zoom = 15) => {
    if (!map.current) return;
    quiet.current = true;
    map.current.setView([c.lat, c.lng], zoom);
    setCenter(c);
    setZoomHint(false);
  }, []);

  // start mapy
  useEffect(() => {
    let alive = true;
    (async () => {
      const mod = await import('leaflet');
      if (!alive || !mapEl.current || map.current) return;
      L.current = mod.default || mod;
      const m = L.current.map(mapEl.current, { zoomControl: true, attributionControl: true })
        .setView([POLAND.lat, POLAND.lng], POLAND.zoom);
      L.current.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      layer.current = L.current.layerGroup().addTo(m);
      map.current = m;
      m.on('moveend', () => {
        const c = m.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
        if (quiet.current) { quiet.current = false; return; }
        if (m.getZoom() < 12) { setZoomHint(true); return; }
        setZoomHint(false);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const r = Math.min(m.distance(m.getCenter(), m.getBounds().getNorthEast()), 15000);
          load(`/api/paczkomaty?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}&r=${Math.round(r)}`);
        }, 350);
      });
      // ostatnie miejsce z poprzedniej wizyty
      const last = readStored();
      if (last?.lat && last?.lng) {
        goTo({ lat: last.lat, lng: last.lng }, 14);
        load(`/api/paczkomaty?lat=${last.lat}&lng=${last.lng}&r=2500`);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer.current);
      map.current?.remove();
      map.current = null;
    };
  }, [goTo, load]);

  // znaczniki
  useEffect(() => {
    const Lf = L.current;
    if (!Lf || !layer.current) return;
    layer.current.clearLayers();
    for (const p of points) {
      const isActive = active?.id === p.id;
      Lf.circleMarker([p.lat, p.lng], {
        radius: isActive ? 11 : 8,
        color: isActive ? '#c4631c' : '#3b3b3b',
        weight: 2,
        fillColor: isActive ? '#e07a2f' : '#ffcd00',
        fillOpacity: 1,
      })
        .on('click', () => setActive(p))
        .bindTooltip(p.id, { direction: 'top', offset: [0, -6] })
        .addTo(layer.current);
    }
  }, [points, active]);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) { setMsg('Wpisz miasto, ulicę, kod pocztowy albo kod paczkomatu.'); return; }
    const data = await load(`/api/paczkomaty?q=${encodeURIComponent(q)}`);
    if (data.center) goTo(data.center, 15);
    if (data.exact) setActive(data.points.find((p) => p.id === data.exact) || null);
  };

  const nearMe = () => {
    if (!navigator.geolocation) { setMsg('Ta przeglądarka nie udostępnia lokalizacji. Wpisz adres.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        goTo(c, 15);
        await load(`/api/paczkomaty?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}&r=2000`);
      },
      () => { setBusy(false); setMsg('Nie mamy dostępu do lokalizacji. Wpisz adres albo kod pocztowy.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const pick = (p) => onPick({ ...p });
  const near = center
    ? points.map((p) => ({ ...p, d: distance(center, p) })).sort((a, b) => a.d - b.d).slice(0, 6)
    : [];

  return (
    <div>
      <div className="locker-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="Miasto i ulica, kod pocztowy albo kod paczkomatu"
          aria-label="Szukaj paczkomatu"
          enterKeyHint="search"
        />
        <button type="button" className="btn btn-small" onClick={search} disabled={busy}>Szukaj</button>
      </div>
      <button type="button" className="link-btn small" onClick={nearMe} disabled={busy}>📍 Pokaż paczkomaty blisko mnie</button>
      <div className="locker-map-wrap">
        <div ref={mapEl} className="locker-map" />
        {busy && <div className="locker-map-busy">Szukam paczkomatów…</div>}
        {zoomHint && !busy && points.length === 0 && <div className="locker-map-hint">Wpisz adres albo przybliż mapę</div>}
      </div>
      {msg && <p className="alert small">{msg}</p>}

      {active && (
        <div className="locker-card">
          <div>
            <strong>{active.id}</strong>{active.is247 && <span className="locker-247">24/7</span>}
            <div className="small">{[active.line1, active.line2].filter(Boolean).join(', ')}</div>
            {active.desc && <div className="small muted">{active.desc}</div>}
          </div>
          <button type="button" className="btn btn-small" onClick={() => pick(active)}>Wybieram</button>
        </div>
      )}

      {near.length > 0 && (
        <ul className="locker-list">
          {near.map((p) => (
            <li key={p.id}>
              <button type="button" className={active?.id === p.id ? 'locker-row active' : 'locker-row'} onClick={() => { setActive(p); goTo(p, Math.max(map.current?.getZoom() || 15, 15)); }}>
                <span><strong>{p.id}</strong> <span className="small">{p.line1}{p.line2 ? `, ${p.line2}` : ''}</span></span>
                <span className="small muted">{fmtDist(p.d)}</span>
              </button>
              <button type="button" className="btn btn-small btn-light" onClick={() => pick(p)}>Wybierz</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
