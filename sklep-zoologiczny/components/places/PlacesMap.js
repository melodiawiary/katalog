'use client';

// Mapa salonów (Leaflet + OpenStreetMap). items: [{ slug, name, lat, lng, ... }]; me: { lat, lng } - pozycja klienta
// selected: slug zaznaczonego salonu, onSelect(slug): dotknięcie pinezki, onMove({lat,lng,radius}): klient przesunął lub przybliżył mapę
// fill: mapa wypełnia nadrzędny element (telefon), bottomInset: ile pikseli od dołu zasłania panel z listą
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const STYLE = { color: '#c4631c', weight: 2, fillColor: '#e07a2f', fillOpacity: 0.95 };
const STYLE_ON = { color: '#7a3a0c', weight: 3, fillColor: '#ffb066', fillOpacity: 1 };

export default function PlacesMap({ items, me = null, height = 360, single = false, fill = false, selected = null, onSelect = null, onMove = null, bottomInset = 0 }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const Lf = useRef(null);
  const markers = useRef(new Map());
  const programmatic = useRef(0);
  const cb = useRef({});
  cb.current = { onSelect, onMove, bottomInset, single };

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
      const mk = L.circleMarker([p.lat, p.lng], { radius: single ? 11 : 10, ...STYLE }).addTo(layer.current);
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
          a.href = `/salony/${p.slug}`;
          a.textContent = 'Zobacz salon';
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

  // zaznaczony salon: większa pinezka i wycentrowanie nad panelem z listą
  useEffect(() => {
    const m = map.current;
    for (const [slug, mk] of markers.current) {
      const on = slug === selected;
      mk.setStyle(on ? STYLE_ON : STYLE);
      mk.setRadius(on ? 14 : single ? 11 : 10);
      if (on) mk.bringToFront();
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
