'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PLACE_SORT } from '@/lib/places';
import { placeCategory } from '@/lib/place-categories';

// Filtry salonów: zapisują się w adresie strony (da się wysłać link)
export default function PlacesFilters({ f, cities, services, featureDefs, category = 'groomer' }) {
  const cfg = placeCategory(category);
  const router = useRouter();
  const [where, setWhere] = useState(f.where);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (patch) => {
    const m = {
      q: f.q, miasto: f.city, rodzaj: f.kind, gatunek: f.species, usluga: f.service, wielkosc: f.size,
      cena_max: f.maxPrice ?? '', otwarte: f.openNow ? '1' : '', udogodnienia: f.features.join(','),
      lat: f.lat ?? '', lng: f.lng ?? '', gdzie: f.where, promien: f.radius ?? '', sort: f.sort, od: f.from, do: f.to, ...patch,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(m)) if (v !== '' && v != null && v !== false) p.set(k, String(v));
    const s = p.toString();
    router.push(`${cfg.base}${s ? `?${s}` : ''}`);
  };

  const nearMe = () => {
    if (f.lat != null && f.where === 'Twoja lokalizacja') { go({ lat: '', lng: '', gdzie: '', promien: '', sort: f.sort === 'odleglosc' ? '' : f.sort }); return; }
    if (!navigator.geolocation) { setMsg('Ta przeglądarka nie udostępnia lokalizacji. Wpisz adres.'); return; }
    setBusy(true); setMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); try { sessionStorage.setItem('places-focus-map', '1'); } catch {} go({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5), gdzie: 'Twoja lokalizacja', promien: 30, sort: 'odleglosc' }); },
      () => { setBusy(false); setMsg('Nie mamy dostępu do lokalizacji. Wpisz adres albo miasto.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const findAddress = async (e) => {
    e.preventDefault();
    const t = where.trim();
    if (t.length < 3) { setMsg('Wpisz miasto, ulicę albo kod pocztowy.'); return; }
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/geokoduj?q=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Nie znaleziono adresu.'); return; }
      go({ lat: data.lat.toFixed(5), lng: data.lng.toFixed(5), gdzie: t, sort: 'odleglosc' });
    } catch {
      setMsg('Nie udało się wyszukać adresu. Spróbuj ponownie.');
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  const sortVal = f.sort || (f.lat != null ? 'odleglosc' : 'najlepsze');

  const chev = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

  return (
    <div className="places-filters">
      <form onSubmit={findAddress} className="places-search">
        <div className="places-search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder={cfg.placeholder} aria-label="Adres lub miasto" enterKeyHint="search" />
        </div>
        <button className="places-search-btn" disabled={busy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.500 4.500" /></svg>
          Szukaj
        </button>
      </form>
      <div className="places-chips">
        <button type="button" className={`pchip${f.lat != null && f.where === 'Twoja lokalizacja' ? ' on' : ''}`} onClick={nearMe} disabled={busy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="12" r="8" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          {cfg.near}
        </button>
        {cfg.species && <button type="button" className={`pchip${f.species === 'pies' ? ' on' : ''}`} onClick={() => go({ gatunek: f.species === 'pies' ? '' : 'pies' })}>
          <img src="/ikony/pies.svg" alt="" width="20" height="20" /> Dla psów
        </button>}
        {cfg.species && <button type="button" className={`pchip${f.species === 'kot' ? ' on' : ''}`} onClick={() => go({ gatunek: f.species === 'kot' ? '' : 'kot' })}>
          <img src="/ikony/kot.svg" alt="" width="20" height="20" /> Dla kotów
        </button>}
      </div>
      {cfg.dates && (
        <div className="pcat-dates">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.500" y="5" width="17" height="15.500" rx="3" /><path d="M3.500 10h17M8 3v4M16 3v4" /></svg>
          <strong>Termin pobytu</strong>
          <label>Od<input type="date" value={f.from} min={today} onChange={(e) => go({ od: e.target.value, do: f.to && e.target.value && f.to < e.target.value ? e.target.value : f.to })} /></label>
          <label>Do<input type="date" value={f.to} min={f.from || today} onChange={(e) => go({ do: e.target.value })} /></label>
          {(f.from || f.to) && <button type="button" className="link-btn" onClick={() => go({ od: '', do: '' })}>Wyczyść</button>}
        </div>
      )}
      {msg && <p className="alert small">{msg}</p>}
      <div className="places-toolbar">
        <label className="places-sort"><span>Sortuj:</span>
          <select value={sortVal} onChange={(e) => go({ sort: e.target.value })}>
            {Object.entries(PLACE_SORT).filter(([k]) => k !== 'odleglosc' || f.lat != null).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {chev}
        </label>
      </div>

    </div>
  );
}
