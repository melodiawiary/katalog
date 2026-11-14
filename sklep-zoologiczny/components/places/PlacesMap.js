'use client';

// Mapa salonów (Leaflet + OpenStreetMap). items: [{ slug, name, lat, lng, ... }]; me: { lat, lng } - pozycja klienta
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export default function PlacesMap({ items, me = null, height = 360, single = false }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const Lf = useRef(null);

  useEffect(() => {
    let alive = true;
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
      draw();
    })();
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function draw() {
    const L = Lf.current;
    const m = map.current;
    if (!L || !m || !layer.current) return;
    layer.current.clearLayers();
    const pts = [];
    for (const p of items) {
      const mk = L.circleMarker([p.lat, p.lng], { radius: single ? 11 : 9, color: '#c4631c', weight: 2, fillColor: '#e07a2f', fillOpacity: 0.95 }).addTo(layer.current);
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
      pts.push([p.lat, p.lng]);
    }
    if (me) {
      L.circleMarker([me.lat, me.lng], { radius: 8, color: '#1d4ed8', weight: 3, fillColor: '#60a5fa', fillOpacity: 1 })
        .bindTooltip('Tu jesteś', { permanent: false }).addTo(layer.current);
      pts.push([me.lat, me.lng]);
    }
    if (pts.length === 1) m.setView(pts[0], single ? 16 : 14);
    else if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  }

  useEffect(draw, [items, me, single]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="locker-map places-map" style={{ height }} />;
}
