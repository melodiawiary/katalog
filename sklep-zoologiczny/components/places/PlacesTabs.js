'use client';

import { useState } from 'react';

// Zakładki Lista / Mapa / Ranking: przewijają do właściwej części strony (mapa na telefonie otwiera się na cały ekran)
export default function PlacesTabs({ showRanking = false }) {
  const [on, setOn] = useState('lista');
  const go = (id, anchor) => {
    setOn(id);
    if (id === 'mapa') window.dispatchEvent(new Event('places:open-map'));
    else document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const tab = (id, label, anchor, icon) => (
    <button type="button" className={`pcat-tab${on === id ? ' on' : ''}`} onClick={() => go(id, anchor)} aria-pressed={on === id}>
      {icon}{label}
    </button>
  );
  const svg = (d) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  return (
    <div className="pcat-tabs" role="group" aria-label="Widok">
      {tab('lista', 'Lista', 'lista-miejsc', svg(<path d="M8 6h12M8 12h12M8 18h12M3.500 6h.01M3.500 12h.01M3.500 18h.01" />))}
      {tab('mapa', 'Mapa', 'lista-miejsc', svg(<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />))}
      {showRanking && tab('ranking', 'Ranking', 'ranking-miejsc', svg(<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />))}
    </div>
  );
}
