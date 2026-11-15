'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlacesMap from './PlacesMap';

const TOP = 56; // rozwinięty panel zostawia u góry pasek mapy
const PEEK = 76; // zwinięty panel: widać tylko uchwyt i liczbę salonów

// Telefon: mapa na cały obszar i przeciągany panel z listą (zwinięty, w połowie, rozwinięty).
// Komputer: mapa po prawej, lista obok (układ z CSS).
export default function PlacesBrowser({ items, me, total, children }) {
  const router = useRouter();
  const stageRef = useRef(null);
  const listRef = useRef(null);
  const drag = useRef(null);
  const [h, setH] = useState(560);
  const [mobile, setMobile] = useState(false);
  const [snap, setSnap] = useState('half');
  const [dragTop, setDragTop] = useState(null);
  const [selected, setSelected] = useState(null);
  const [moved, setMoved] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const upd = () => setMobile(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const tops = { peek: Math.max(TOP + 40, h - PEEK), half: Math.round(h * 0.5), full: TOP };
  const top = dragTop ?? tops[snap];

  // podświetlenie wybranej karty na liście
  useEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    ul.querySelectorAll('li.is-selected').forEach((n) => n.classList.remove('is-selected'));
    if (!selected) return;
    const li = ul.querySelector(`li[data-slug="${CSS.escape(selected)}"]`);
    if (li) {
      li.classList.add('is-selected');
      ul.scrollTo({ top: Math.max(0, li.offsetTop - 8), behavior: 'smooth' });
    }
  }, [selected]);

  function pick(slug) {
    setSelected(slug);
    if (mobile && snap !== 'half') setSnap('half');
  }

  function onDown(e) {
    if (!mobile) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, top: tops[snap], t: Date.now(), moved: false };
  }
  function onMove(e) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 5) d.moved = true;
    setDragTop(Math.min(tops.peek, Math.max(TOP, d.top + dy)));
  }
  function onUp(e) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap((s) => (s === 'half' ? 'full' : 'half'));
      setDragTop(null);
      return;
    }
    const v = (e.clientY - d.y) / Math.max(1, Date.now() - d.t);
    const t = Math.min(tops.peek, Math.max(TOP, d.top + (e.clientY - d.y))) + v * 160;
    const best = Object.entries(tops).sort((a, b) => Math.abs(a[1] - t) - Math.abs(b[1] - t))[0][0];
    setSnap(best);
    setDragTop(null);
  }

  function searchHere() {
    if (!moved) return;
    const p = new URLSearchParams(window.location.search);
    p.set('lat', moved.lat.toFixed(5));
    p.set('lng', moved.lng.toFixed(5));
    p.set('promien', String(moved.radius));
    p.set('gdzie', 'Obszar na mapie');
    p.set('sort', 'odleglosc');
    setMoved(null);
    setSelected(null);
    router.push(`/salony?${p.toString()}`);
  }

  const sheetStyle = mobile ? { transform: `translateY(${top}px)`, transition: dragTop == null ? 'transform 0.25s ease' : 'none' } : undefined;
  const listStyle = mobile ? { height: Math.max(0, h - top - 52), overflowY: snap === 'full' && dragTop == null ? 'auto' : 'hidden' } : undefined;

  return (
    <div className="places-stage" ref={stageRef}>
      <div className="places-map-col">
        <PlacesMap
          items={items}
          me={me}
          height={380}
          fill={mobile}
          selected={selected}
          onSelect={pick}
          onMove={mobile ? setMoved : null}
          bottomInset={mobile ? Math.max(0, h - top) : 0}
        />
        {mobile && moved && (
          <button type="button" className="places-here" onClick={searchHere}>Szukaj w tym obszarze</button>
        )}
      </div>
      <div className="places-sheet" style={sheetStyle}>
        <div
          className="sheet-grip"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          role="button"
          tabIndex={0}
          aria-label="Panel z listą salonów: dotknij lub przeciągnij, aby zmienić wysokość"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSnap((s) => (s === 'half' ? 'full' : 'half')); } }}
        >
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sheet-count">{total === 0 ? 'Brak salonów' : `${total} ${total === 1 ? 'salon' : total < 5 ? 'salony' : 'salonów'}`}</span>
        </div>
        <div
          className="sheet-list"
          ref={listRef}
          style={listStyle}
          onClick={(e) => {
            if (mobile && snap === 'peek') { setSnap('half'); return; }
            const li = e.target.closest('li[data-slug]');
            if (li && !e.target.closest('a')) setSelected(li.dataset.slug);
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
