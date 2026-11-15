'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlacesMap from './PlacesMap';

const TOP = 56; // rozwinięty panel zostawia u góry pasek mapy
const PEEK = 76; // zwinięty panel: widać tylko uchwyt i liczbę salonów

// Telefon: mapa w karcie nad listą z przyciskiem "Pokaż mapę"; po dotknięciu mapa na cały ekran i przeciągany panel z listą.
// Komputer: mapa po prawej, lista obok (układ z CSS).
export default function PlacesBrowser({ items, me, total, children, base = '/salony', tone = 'orange', noun = { none: 'Brak salonów', one: 'salon', few: 'salony', many: 'salonów' }, linkLabel = 'Zobacz salon' }) {
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
  const [mapOpen, setMapOpen] = useState(false);
  const open = mobile && mapOpen;

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

  // pełny ekran mapy: blokada przewijania strony pod spodem i zamknięcie klawiszem Esc
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => { if (e.key === 'Escape') closeMap(); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // przycisk "Mapa" w zakładkach: na telefonie mapa na cały ekran, na komputerze przewinięcie do mapy
  useEffect(() => {
    const h = () => {
      if (mobile) openMap();
      else stageRef.current?.querySelector('.places-map-col')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('places:open-map', h);
    return () => window.removeEventListener('places:open-map', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function openMap() { setSnap('half'); setSelected(null); setMoved(null); setMapOpen(true); }
  function closeMap() { setMapOpen(false); setMoved(null); setSelected(null); }

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
    if (mobile && !mapOpen) { setSnap('half'); setMoved(null); setMapOpen(true); }
    setSelected(slug);
    if (open && snap !== 'half') setSnap('half');
  }

  function onDown(e) {
    if (!open) return;
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
    router.push(`${base}?${p.toString()}`);
  }

  const sheetStyle = open ? { transform: `translateY(${top}px)`, transition: dragTop == null ? 'transform 0.25s ease' : 'none' } : undefined;
  const listStyle = open ? { height: Math.max(0, h - top - 52), overflowY: snap === 'full' && dragTop == null ? 'auto' : 'hidden' } : undefined;

  return (
    <div className={`places-stage${open ? ' is-open' : ''}`} ref={stageRef}>
      <div className="places-map-col">
        <PlacesMap
          items={items}
          me={me}
          height={380}
          fill={mobile}
          selected={selected}
          onSelect={pick}
          onMove={open ? setMoved : null}
          bottomInset={open ? Math.max(0, h - top) : 0}
          refit={mapOpen ? 1 : 0}
          interactive={!mobile || open}
          base={base}
          tone={tone}
          linkLabel={linkLabel}
        />
        {mobile && !open && (
          <button type="button" className="places-show-map" onClick={openMap}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>
            Pokaż mapę
          </button>
        )}
        {open && (
          <button type="button" className="places-close" onClick={closeMap} aria-label="Zamknij mapę i wróć do listy">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        )}
        {open && moved && (
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
          aria-label="Panel z listą: dotknij lub przeciągnij, aby zmienić wysokość"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSnap((s) => (s === 'half' ? 'full' : 'half')); } }}
        >
          <span className="sheet-handle" aria-hidden="true" />
          <span className="sheet-count">{total === 0 ? noun.none : `${total} ${total === 1 ? noun.one : total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 10 || total % 100 >= 20) ? noun.few : noun.many}`}</span>
        </div>
        <div
          className="sheet-list"
          ref={listRef}
          style={listStyle}
          onClick={(e) => {
            if (open && snap === 'peek') { setSnap('half'); return; }
            const li = e.target.closest('li[data-slug]');
            if (open && li && !e.target.closest('a, button')) setSelected(li.dataset.slug);
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
