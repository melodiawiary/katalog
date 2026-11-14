'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { submitPlaceReview, toggleFavoritePlace } from '@/app/salony/actions';
import { SIZE_CLASS } from '@/lib/places';

function StarPick({ label, value, onChange, required }) {
  return (
    <div className="rating-pick-row">
      <span>{label}{required ? ' *' : ''}</span>
      <div className="rating-pick" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} z 5`}
            className={`star-btn${n <= value ? ' on' : ''}`} onClick={() => onChange(value === n && !required ? 0 : n)}>★</button>
        ))}
      </div>
    </div>
  );
}

// Serduszko "ulubiony salon" + formularz opinii (tylko zalogowani; stan z funkcji place_user_state)
export default function PlaceReviewForm({ placeId, services = [] }) {
  const [info, setInfo] = useState(null);
  const [fav, setFav] = useState(false);
  const [state, action, pending] = useActionState(submitPlaceReview, null);
  const [q, setQ] = useState(0);
  const [c, setC] = useState(0);
  const [cl, setCl] = useState(0);
  const [pr, setPr] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    try {
      createClient().rpc('place_user_state', { p_place: placeId }).then(({ data }) => {
        if (!alive) return;
        setInfo(data || { logged_in: false });
        setFav(Boolean(data?.favorite));
        const m = data?.mine;
        if (m) { setQ(m.r_quality || 0); setC(m.r_care || 0); setCl(m.r_clean || 0); setPr(m.r_price || 0); }
      });
    } catch { /* bez formularza */ }
    return () => { alive = false; };
  }, [placeId]);

  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  const toggleFav = async () => {
    const res = await toggleFavoritePlace(placeId);
    if (res?.ok) setFav(res.favorite);
  };

  if (!info) return null;
  const login = `/konto/logowanie?next=${encodeURIComponent(pathname)}`;
  if (!info.logged_in) {
    return (
      <div className="box small">
        <p><Link href={login}>Zaloguj się</Link>, żeby ocenić ten salon albo zapisać go jako ulubiony. Logowanie jest bez hasła, wystarczy e-mail.</p>
      </div>
    );
  }
  const mine = info.mine;
  return (
    <>
      <p><button type="button" className="link-btn fav-btn" onClick={toggleFav} aria-pressed={fav}>{fav ? '♥ Ulubiony salon' : '♡ Zapisz jako ulubiony'}</button></p>
      <form action={action} className="review-form box">
        <h3>{mine ? 'Twoja opinia (możesz ją zmienić)' : 'Oceń ten salon'}</h3>
        <input type="hidden" name="place_id" value={placeId} />
        <input type="hidden" name="r_quality" value={q} />
        <input type="hidden" name="r_care" value={c} />
        <input type="hidden" name="r_clean" value={cl} />
        <input type="hidden" name="r_price" value={pr} />
        <StarPick label="Jakość usługi" value={q} onChange={setQ} required />
        <StarPick label="Podejście do zwierzęcia" value={c} onChange={setC} />
        <StarPick label="Czystość" value={cl} onChange={setCl} />
        <StarPick label="Cena do jakości" value={pr} onChange={setPr} />
        <label>Twoja opinia (jak przebiegła wizyta, jak zwierzak zniósł pielęgnację)
          <textarea name="body" rows={4} maxLength={2000} defaultValue={mine?.body || ''} />
        </label>
        <details>
          <summary className="small">Dodaj, ile zapłaciłeś (nieobowiązkowo, pomaga innym)</summary>
          <div className="grid-2" style={{ marginTop: 8 }}>
            <label>Usługa
              <select name="service" defaultValue={mine?.service || ''}>
                <option value="">-</option>
                {services.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </label>
            <label>Zwierzę
              <select name="size_class" defaultValue={mine?.size_class || ''}>
                <option value="">-</option>
                {Object.entries(SIZE_CLASS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
        </details>
        <p className="small muted">Nie sprawdzamy, czy byłeś w tym salonie, dlatego pisz tylko o własnych doświadczeniach. <Link href="/salony/zasady-opinii">Zasady opinii</Link></p>
        {state?.error && <p className="alert">{state.error}</p>}
        {state?.ok && <p className="ok-box">{state.ok}</p>}
        <button className="btn btn-small" disabled={pending || q < 1}>{pending ? 'Zapisywanie…' : mine ? 'Zapisz zmiany' : 'Wyślij opinię'}</button>
        {mine?.status === 'oczekuje' && <p className="small muted">Twoja opinia czeka na zatwierdzenie i pojawi się po sprawdzeniu.</p>}
        {mine?.status === 'ukryta' && <p className="small muted">Ta opinia została ukryta (niezgodna z zasadami).</p>}
      </form>
    </>
  );
}
