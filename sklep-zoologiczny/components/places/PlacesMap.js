'use client';

// Mapa salonów (Leaflet + OpenStreetMap). items: [{ slug, name, lat, lng, ... }]; me: { lat, lng } - pozycja klienta
// selected: slug zaznaczonego salonu, onSelect(slug): dotknięcie pinezki, onMove({lat,lng,radius}): klient przesunął lub przybliżył mapę
// fill: mapa wypełnia nadrzędny element (telefon), bottomInset: ile pikseli od dołu zasłania panel z listą
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

// Pinezka z łapką (jak w projekcie): zwykła i zaznaczona (większa, ciemniejsza)
function pawSvg(w, h, fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 34 42"><path d="M17 41C17 41 3 26 3 15a14 14 0 0 1 28 0c0 11-14 26-14 26z" fill="${fill}" stroke="#fff" stroke-width="2"/><ellipse cx="17" cy="21.5" rx="5.6" ry="4.4" fill="#fff"/><circle cx="10.4" cy="15.6" r="2.4" fill="#fff"/><circle cx="14.4" cy="11.4" r="2.5" fill="#fff"/><circle cx="19.6" cy="11.4" r="2.5" fill="#fff"/><circle cx="23.6" cy="15.6" r="2.4" fill="#fff"/></svg>`;
}
const TONES = { orange: ['#e07a2f', '#b4500f'], teal: ['#00a39e', '#00716d'], purple: ['#7c3fcf', '#5c2aa8'], green: ['#1f9a3d', '#167a2f'], sea: ['#1b9a8e', '#12766c'] };
const pawIcon = (L, on, tone = 'orange') => (on
  ? L.divIcon({ className: 'paw-pin', html: pawSvg(42, 52, TONES[tone][1]), iconSize: [42, 52], iconAnchor: [21, 51] })
  : L.divIcon({ className: 'paw-pin', html: pawSvg(34, 42, TONES[tone][0]), iconSize: [34, 42], iconAnchor: [17, 41] }));

export default function PlacesMap({ items, me = null, height = 360, single = false, fill = false, selected = null, onSelect = null, onMove = null, bottomInset = 0, refit = 0, interactive = true, base = '/salony', tone = 'orange', linkLabel = 'Zobacz salon' }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const Lf = useRef(null);
  const markers = useRef(new Map());
  const programmatic = useRef(0);
  const cb = useRef({});
  cb.current = { onSelect, onMove, bottomInset, single, base, tone, linkLabel };

  useEffect(() => {
    let alive = true;
    let ro = null;
    (async () => {
      const mod = await import('leaflet');
      if (!alive || !el.current || map.current) return;
      const L = mod.default || mod;
      Lf.current = L;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([54.4, 18.6], 10);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      const report = () => {
        if (programmatic.current > 0) { programmatic.current = Math.max(0, programmatic.current - 1); return; }
        if (!cb.current.onMove) return;
        const c = m.getCenter();
        const r = Math.min(200, Math.max(1, Math.ceil(c.distanceTo(m.getBounds().getNorthEast()) / 1000)));
        cb.current.onMove({ lat: c.lat, lng: c.lng, radius: r });
      };
      m.on('moveend', report);
      ro = new ResizeObserver(() => m.invalidateSize());
      ro.observe(el.current);
      draw();
    })();
    return () => {
      alive = false;
      ro?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function draw() {
    const L = Lf.current;
    const m = map.current;
    if (!L || !m || !layer.current) return;
    layer.current.clearLayers();
    markers.current = new Map();
    const pts = [];
    for (const p of items) {
      const mk = L.marker([p.lat, p.lng], { icon: pawIcon(L, false, cb.current.tone), title: p.name, keyboard: false }).addTo(layer.current);
      markers.current.set(p.slug, mk);
      if (cb.current.onSelect) {
        mk.on('click', () => cb.current.onSelect(p.slug));
      } else {
        const box = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = p.name;
        box.appendChild(strong);
        if (!single) {
          box.appendChild(document.createElement('br'));
          const a = document.createElement('a');
          a.href = `${cb.current.base}/${p.slug}`;
          a.textContent = cb.current.linkLabel;
          box.appendChild(a);
        }
        mk.bindPopup(box);
      }
      pts.push([p.lat, p.lng]);
    }
    if (me) {
      L.circleMarker([me.lat, me.lng], { radius: 8, color: '#1d4ed8', weight: 3, fillColor: '#60a5fa', fillOpacity: 1 })
        .bindTooltip('Tu jesteś', { permanent: false }).addTo(layer.current);
      pts.push([me.lat, me.lng]);
    }
    programmatic.current += 2; // setView/fitBounds wywołują moveend (czasem dwa razy)
    if (pts.length === 1) m.setView(pts[0], single ? 16 : 14);
    else if (pts.length > 1) m.fitBounds(pts, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 30 + (cb.current.bottomInset || 0)], maxZoom: 15 });
    else programmatic.current = 0;
    setTimeout(() => { programmatic.current = 0; }, 800);
  }

  useEffect(draw, [items, me, single]); // eslint-disable-line react-hooks/exhaustive-deps

  // zmiana rozmiaru mapy (podgląd -> pełny ekran): przeliczenie i ponowne dopasowanie widoku
  useEffect(() => {
    if (!refit && !map.current) return undefined;
    const t = setTimeout(() => { map.current?.invalidateSize(); draw(); }, 80);
    return () => clearTimeout(t);
  }, [refit]); // eslint-disable-line react-hooks/exhaustive-deps

  // podgląd na stronie: mapa nie przechwytuje przewijania strony, przybliżanie tylko przyciskami +/-
  useEffect(() => {
    const t = setInterval(() => {
      const m = map.current;
      if (!m) return;
      clearInterval(t);
      for (const h of ['dragging', 'touchZoom', 'doubleClickZoom', 'boxZoom']) interactive ? m[h].enable() : m[h].disable();
    }, 50);
    return () => clearInterval(t);
  }, [interactive]);

  // zaznaczony salon: większa pinezka i wycentrowanie nad panelem z listą
  useEffect(() => {
    const m = map.current;
    for (const [slug, mk] of markers.current) {
      const on = slug === selected;
      if (Lf.current) mk.setIcon(pawIcon(Lf.current, on, cb.current.tone));
      mk.setZIndexOffset(on ? 1000 : 0);
    }
    const mk = selected && markers.current.get(selected);
    if (m && mk) {
      const size = m.getSize();
      const cur = m.latLngToContainerPoint(mk.getLatLng());
      const targetY = Math.max(40, (size.y - (cb.current.bottomInset || 0)) / 2);
      programmatic.current += 2;
      m.panBy([cur.x - size.x / 2, cur.y - targetY]);
      setTimeout(() => { programmatic.current = 0; }, 800);
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="locker-map places-map" style={{ height: fill ? '100%' : height, borderRadius: fill ? 0 : undefined, border: fill ? 0 : undefined }} />;
}
