'use client';

import 'leaflet/dist/leaflet.css';
import { useActionState, useEffect, useRef, useState, startTransition } from 'react';
import { savePlace, geocodeAddress, reverseGeocode } from './actions';
import {
  PLACE_KIND, PLACE_STATUS, SPECIES, SIZE_CLASS, WEEKDAYS, DEFAULT_CENTER,
} from '@/lib/places';

const emptyPrice = () => ({
  key: Math.random().toString(36).slice(2),
  service: '', size_class: '', breed: '', price_from: '', price_to: '', duration_min: '', note: '',
});

// ---------- mapa z pinezką ----------
function PinMap({ lat, lng, onMove }) {
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const Lf = useRef(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  useEffect(() => {
    let alive = true;
    (async () => {
      const mod = await import('leaflet');
      if (!alive || !el.current || map.current) return;
      const L = mod.default || mod;
      Lf.current = L;
      const has = Number.isFinite(lat) && Number.isFinite(lng);
      const m = L.map(el.current).setView(has ? [lat, lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], has ? 16 : DEFAULT_CENTER.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({ className: 'pin-icon', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] });
      const put = (la, ln) => {
        if (marker.current) marker.current.setLatLng([la, ln]);
        else {
          marker.current = L.marker([la, ln], { draggable: true, icon }).addTo(m);
          marker.current.on('dragend', () => {
            const p = marker.current.getLatLng();
            moveRef.current(p.lat, p.lng, true);
          });
        }
      };
      m.on('click', (e) => { put(e.latlng.lat, e.latlng.lng); moveRef.current(e.latlng.lat, e.latlng.lng, true); });
      map.current = m;
      if (has) put(lat, lng);
      map.current._put = put;
    })();
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // pozycja zmieniona z zewnątrz (geokodowanie, wpisane liczby)
  useEffect(() => {
    const m = map.current;
    if (!m || !m._put || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const cur = marker.current?.getLatLng();
    if (cur && Math.abs(cur.lat - lat) < 1e-7 && Math.abs(cur.lng - lng) < 1e-7) return;
    m._put(lat, lng);
    m.setView([lat, lng], Math.max(m.getZoom(), 16));
  }, [lat, lng]);

  return <div ref={el} className="locker-map pin-map" />;
}

// ---------- godziny otwarcia ----------
function HoursEditor({ hours, setHours }) {
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

// ---------- formularz ----------
export default function PlaceForm({ place, hours: hoursIn = [], prices: pricesIn = [], priv = {}, services = [], featureDefs = [], requestId = null }) {
  const isNew = !place?.id;
  const [state, formAction, pending] = useActionState(savePlace, null);

  const [kind, setKind] = useState(place?.kind || 'salon');
  const [lat, setLat] = useState(place?.lat ?? NaN);
  const [lng, setLng] = useState(place?.lng ?? NaN);
  const [address, setAddress] = useState(place?.address || '');
  const [postal, setPostal] = useState(place?.postal_code || '');
  const [city, setCity] = useState(place?.city || '');
  const [district, setDistrict] = useState(place?.district || '');
  const [species, setSpecies] = useState(place?.species || ['pies']);
  const [features, setFeatures] = useState(place?.features || []);
  const [hours, setHours] = useState(hoursIn.map((h) => ({ ...h, key: Math.random().toString(36).slice(2) })));
  const [prices, setPrices] = useState(pricesIn.length ? pricesIn.map((p) => ({ ...emptyPrice(), ...p, price_from: String(p.price_from ?? ''), price_to: p.price_to == null ? '' : String(p.price_to), duration_min: p.duration_min == null ? '' : String(p.duration_min), size_class: p.size_class || '', breed: p.breed || '' })) : []);
  const [geoMsg, setGeoMsg] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  const hasPos = Number.isFinite(lat) && Number.isFinite(lng);

  const fillEmpty = (r) => {
    if (r.city && !city) setCity(r.city);
    if (r.postal_code && !postal) setPostal(r.postal_code);
    if (r.district && !district) setDistrict(r.district);
    if (r.street && !address) setAddress(r.street);
  };

  const find = async () => {
    setGeoBusy(true);
    setGeoMsg('');
    const r = await geocodeAddress({ address, postal_code: postal, city });
    setGeoBusy(false);
    if (r.error) { setGeoMsg(r.error); return; }
    setLat(Math.round(r.lat * 1e6) / 1e6);
    setLng(Math.round(r.lng * 1e6) / 1e6);
    fillEmpty(r);
    setGeoMsg(r.approximate ? 'Znaleziono tylko miasto. Przeciągnij pinezkę na właściwe miejsce.' : 'Znaleziono. Jeśli pinezka stoi obok, przeciągnij ją.');
  };

  const moved = async (la, ln, fromMap) => {
    setLat(Math.round(la * 1e6) / 1e6);
    setLng(Math.round(ln * 1e6) / 1e6);
    if (!fromMap) return;
    const r = await reverseGeocode({ lat: la, lng: ln });
    if (r.ok) { fillEmpty(r); setGeoMsg('Pozycja ustawiona. Puste pola adresu uzupełniono z mapy.'); }
  };

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setPrice = (idx, patch) => setPrices((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const hoursJson = JSON.stringify(hours.map(({ weekday, opens, closes }) => ({ weekday, opens, closes })));
  const pricesJson = JSON.stringify(prices.map(({ key, ...p }) => p));

  return (
    <form
      className="stack-form place-form"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => formAction(new FormData(e.currentTarget)));
      }}
    >
      {place?.id && <input type="hidden" name="id" value={place.id} />}
      {requestId && <input type="hidden" name="request_id" value={requestId} />}
      <input type="hidden" name="hours" value={hoursJson} />
      <input type="hidden" name="prices" value={pricesJson} />

      <fieldset>
        <legend>Podstawowe</legend>
        <label>Nazwa *<input name="name" defaultValue={place?.name || ''} required maxLength={120} /></label>
        <div className="grid-2">
          <label>Rodzaj
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(PLACE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label>Status
            <select name="status" defaultValue={place?.status || 'szkic'}>
              {Object.entries(PLACE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        <label className="radio"><input type="checkbox" name="verified" defaultChecked={Boolean(place?.verified)} /> Sprawdzony przez nas (odznaka „Sprawdzony”, mały bonus w rankingu, wymagany do odznak „Polecany” i „Top w mieście”)</label>
        <div className="attr-group">
          <span className="attr-name">Przyjmuje *</span>
          <div className="attr-values">
            {Object.entries(SPECIES).map(([k, l]) => (
              <label key={k} className={species.includes(k) ? 'pill on' : 'pill'}>
                <input type="checkbox" name="species" value={k} checked={species.includes(k)} onChange={() => toggle(species, setSpecies, k)} />{l}
              </label>
            ))}
          </div>
        </div>
        <label>Opis (do 3000 znaków)<textarea name="description" rows={5} defaultValue={place?.description || ''} maxLength={3000} /></label>
      </fieldset>

      <fieldset>
        <legend>Adres i pinezka</legend>
        <label>Ulica i numer{kind === 'mobilny' ? ' (groomer mobilny: niewymagane)' : ' *'}
          <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} autoComplete="off" />
        </label>
        <div className="grid-3">
          <label>Kod pocztowy<input name="postal_code" value={postal} onChange={(e) => setPostal(e.target.value)} maxLength={10} inputMode="numeric" /></label>
          <label>Miasto *<input name="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} /></label>
          <label>Dzielnica<input name="district" value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={80} /></label>
        </div>
        <div className="input-with-btn">
          <button type="button" className="btn btn-small" onClick={find} disabled={geoBusy}>{geoBusy ? 'Szukam…' : 'Znajdź na mapie'}</button>
          <span className="small muted">Adres zamieni się na pinezkę. Pinezkę można przeciągnąć albo kliknąć miejsce na mapie.</span>
        </div>
        {geoMsg && <p className="small">{geoMsg}</p>}
        <PinMap lat={lat} lng={lng} onMove={moved} />
        <div className="grid-2">
          <label>Szerokość geogr. (lat)<input name="lat" value={Number.isFinite(lat) ? lat : ''} onChange={(e) => setLat(e.target.value === '' ? NaN : Number(e.target.value.replace(',', '.')))} inputMode="decimal" /></label>
          <label>Długość geogr. (lng)<input name="lng" value={Number.isFinite(lng) ? lng : ''} onChange={(e) => setLng(e.target.value === '' ? NaN : Number(e.target.value.replace(',', '.')))} inputMode="decimal" /></label>
        </div>
        {!hasPos && <p className="small warn">Bez pinezki nie da się zapisać miejsca.</p>}
        <label>Zasięg dojazdu w km{kind === 'mobilny' ? ' *' : ' (tylko groomer mobilny)'}
          <input name="service_radius_km" defaultValue={place?.service_radius_km ?? ''} inputMode="numeric" placeholder={kind === 'mobilny' ? 'np. 25' : 'puste'} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Kontakt i linki</legend>
        <div className="grid-2">
          <label>Telefon<input name="phone" type="tel" defaultValue={place?.phone || ''} maxLength={30} /></label>
          <label>E-mail salonu<input name="email" type="email" defaultValue={place?.email || ''} maxLength={200} /></label>
        </div>
        <label>Strona www<input name="website" defaultValue={place?.website || ''} placeholder="https://" /></label>
        <label>Link do rezerwacji<input name="booking_url" defaultValue={place?.booking_url || ''} placeholder="https://" /></label>
        <div className="grid-2">
          <label>Instagram<input name="instagram" defaultValue={place?.instagram || ''} placeholder="https://instagram.com/..." /></label>
          <label>Facebook<input name="facebook" defaultValue={place?.facebook || ''} placeholder="https://facebook.com/..." /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Godziny otwarcia</legend>
        <p className="small muted">Dzień bez przedziału = zamknięte. Od tego zależy filtr „otwarte teraz”.</p>
        <HoursEditor hours={hours} setHours={setHours} />
      </fieldset>

      <fieldset>
        <legend>Cennik („od” dla usługi i wielkości psa)</legend>
        <p className="small muted">Wielkość puste = cena dla każdej wielkości. Rasa tylko, gdy cena dotyczy konkretnej rasy.</p>
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
      </fieldset>

      <fieldset>
        <legend>Udogodnienia</legend>
        <div className="attr-values">
          {featureDefs.map((f) => (
            <label key={f.code} className={features.includes(f.code) ? 'pill on' : 'pill'}>
              <input type="checkbox" name="features" value={f.code} checked={features.includes(f.code)} onChange={() => toggle(features, setFeatures, f.code)} />{f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Notatki prywatne (widzisz tylko Ty)</legend>
        <label>Notatki<textarea name="notes" rows={3} defaultValue={priv.notes || ''} maxLength={3000} /></label>
        <div className="grid-2">
          <label>Osoba kontaktowa<input name="contact_person" defaultValue={priv.contact_person || ''} maxLength={120} /></label>
          <label>Telefon do właściciela<input name="contact_phone" type="tel" defaultValue={priv.contact_phone || ''} maxLength={30} /></label>
        </div>
        <label>E-mail do właściciela<input name="contact_email" type="email" defaultValue={priv.contact_email || ''} maxLength={200} /></label>
        <div className="grid-2">
          <label>Skąd dane (link)<input name="source_url" defaultValue={priv.source_url || ''} maxLength={500} /></label>
          <label>Dane sprawdzone dnia<input name="last_checked_at" type="date" defaultValue={priv.last_checked_at || ''} /></label>
        </div>
      </fieldset>

      {state?.error && <p className="alert">{state.error}</p>}
      <div className="sticky-save">
        <button className="btn" disabled={pending || !hasPos}>{pending ? 'Zapisywanie…' : isNew ? 'Dodaj miejsce' : 'Zapisz zmiany'}</button>
      </div>
    </form>
  );
}
