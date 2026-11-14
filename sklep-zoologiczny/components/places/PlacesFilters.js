'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PLACE_KIND, SPECIES, SIZE_CLASS, PLACE_SORT } from '@/lib/places';

// Filtry salonów: zapisują się w adresie strony (da się wysłać link)
export default function PlacesFilters({ f, cities, services, featureDefs }) {
  const router = useRouter();
  const [q, setQ] = useState(f.q);
  const [where, setWhere] = useState(f.where);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(Boolean(f.city || f.kind || f.species || f.service || f.size || f.maxPrice || f.openNow || f.features.length));

  const go = (patch) => {
    const m = {
      q: f.q, miasto: f.city, rodzaj: f.kind, gatunek: f.species, usluga: f.service, wielkosc: f.size,
      cena_max: f.maxPrice ?? '', otwarte: f.openNow ? '1' : '', udogodnienia: f.features.join(','),
      lat: f.lat ?? '', lng: f.lng ?? '', gdzie: f.where, promien: f.radius ?? '', sort: f.sort, ...patch,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(m)) if (v !== '' && v != null && v !== false) p.set(k, String(v));
    const s = p.toString();
    router.push(`/salony${s ? `?${s}` : ''}`);
  };

  const submitFilters = (e) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    go({
      q: String(d.get('q') || '').trim(),
      miasto: d.get('miasto') || '', rodzaj: d.get('rodzaj') || '', gatunek: d.get('gatunek') || '',
      usluga: d.get('usluga') || '', wielkosc: d.get('wielkosc') || '',
      cena_max: String(d.get('cena_max') || '').trim(), otwarte: d.get('otwarte') ? '1' : '',
      udogodnienia: d.getAll('udogodnienia').join(','), promien: d.get('promien') || '',
    });
  };

  const nearMe = () => {
    if (!navigator.geolocation) { setMsg('Ta przeglądarka nie udostępnia lokalizacji. Wpisz adres.'); return; }
    setBusy(true); setMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); go({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5), gdzie: 'Twoja lokalizacja', sort: 'odleglosc' }); },
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

  return (
    <div className="places-filters">
      <form onSubmit={findAddress} className="locker-search">
        <input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Szukaj blisko adresu, np. Gdynia Świętojańska" aria-label="Adres" enterKeyHint="search" />
        <button className="btn btn-small" disabled={busy}>Szukaj</button>
      </form>
      <div className="places-filter-line">
        <button type="button" className="link-btn" onClick={nearMe} disabled={busy}>📍 Salony blisko mnie</button>
        {f.lat != null && <button type="button" className="link-btn" onClick={() => go({ lat: '', lng: '', gdzie: '', promien: '', sort: f.sort === 'odleglosc' ? '' : f.sort })}>Wyczyść pozycję</button>}
      </div>
      <label className="places-sort small">Sortuj:{' '}
        <select value={f.sort || (f.lat != null ? 'odleglosc' : 'najlepsze')} onChange={(e) => go({ sort: e.target.value })}>
          {Object.entries(PLACE_SORT).filter(([k]) => k !== 'odleglosc' || f.lat != null).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {msg && <p className="alert small">{msg}</p>}

      <details className="panel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="chip" style={{ display: 'inline-block', cursor: 'pointer' }}>Filtry</summary>
        <form onSubmit={submitFilters} className="stack-form places-filter-form">
          <label>Nazwa, dzielnica, ulica<input name="q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} /></label>
          <div className="grid-2">
            <label>Miasto
              <select name="miasto" defaultValue={f.city}>
                <option value="">Wszystkie</option>
                {cities.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.count})</option>)}
              </select>
            </label>
            <label>Rodzaj
              <select name="rodzaj" defaultValue={f.kind}>
                <option value="">Każdy</option>
                {Object.entries(PLACE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="grid-2">
            <label>Zwierzę
              <select name="gatunek" defaultValue={f.species}>
                <option value="">Psy i koty</option>
                {Object.entries(SPECIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label>Wielkość psa
              <select name="wielkosc" defaultValue={f.size}>
                <option value="">Dowolna</option>
                {Object.entries(SIZE_CLASS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="grid-2">
            <label>Usługa
              <select name="usluga" defaultValue={f.service}>
                <option value="">Dowolna</option>
                {services.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </label>
            <label>Cena do (zł)<input name="cena_max" defaultValue={f.maxPrice ?? ''} inputMode="decimal" placeholder="np. 150" /></label>
          </div>
          {f.lat != null && (
            <label>Promień od wybranego miejsca
              <select name="promien" defaultValue={f.radius ?? ''}>
                <option value="">Bez limitu</option>
                {[3, 5, 10, 20, 50].map((r) => <option key={r} value={r}>{r} km</option>)}
              </select>
            </label>
          )}
          <label className="radio"><input type="checkbox" name="otwarte" defaultChecked={f.openNow} /> Otwarte teraz</label>
          <div className="attr-values">
            {featureDefs.map((d) => (
              <label key={d.code} className="check"><input type="checkbox" name="udogodnienia" value={d.code} defaultChecked={f.features.includes(d.code)} /><span>{d.label}</span></label>
            ))}
          </div>
          <div className="filters-btns">
            <button className="btn btn-small">Pokaż salony</button>
            <button type="button" className="link-btn" onClick={() => router.push('/salony')}>Wyczyść wszystko</button>
          </div>
        </form>
      </details>
    </div>
  );
}
