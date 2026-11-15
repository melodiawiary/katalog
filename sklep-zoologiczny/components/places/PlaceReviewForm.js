'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { submitPlaceReview, toggleFavoritePlace } from '@/app/salony/actions';
import { SIZE_CLASS } from '@/lib/places';

async function shrink(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}

// Zdjęcia do własnej opinii (do 3). Idą do sprawdzenia, zanim pojawią się publicznie.
function ReviewPhotos({ review, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const photos = review.photos || [];

  async function add(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Zaloguj się ponownie.');
      const blob = await shrink(f);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from('opinie-salonow').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error('Nie udało się wgrać zdjęcia.');
      const { error } = await supabase.rpc('add_review_photo', { p_review: review.id, p_path: path });
      if (error) {
        await supabase.storage.from('opinie-salonow').remove([path]);
        throw new Error(error.code === 'P0001' ? error.message : 'Nie udało się dodać zdjęcia.');
      }
      onChange();
    } catch (x) { setErr(x.message || 'Nie udało się dodać zdjęcia.'); }
    setBusy(false);
  }

  async function remove(ph) {
    setBusy(true); setErr('');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('delete_review_photo', { p_photo: ph.id });
    if (error) setErr('Nie udało się usunąć zdjęcia.');
    else if (data) await supabase.storage.from('opinie-salonow').remove([data]);
    setBusy(false);
    onChange();
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <div className="box">
      <strong className="small">Zdjęcia do opinii (do 3, nieobowiązkowo)</strong>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        {photos.map((ph) => (
          <div key={ph.id} style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/storage/v1/object/public/opinie-salonow/${ph.path}`} alt="" style={{ height: 80, borderRadius: 6, display: 'block' }} />
            <span className="small muted">{ph.status === 'oczekuje' ? 'czeka na sprawdzenie' : 'opublikowane'}</span>
            <br /><button type="button" className="link-btn small" onClick={() => remove(ph)} disabled={busy}>Usuń</button>
          </div>
        ))}
      </div>
      {photos.length < 3 && <input type="file" accept="image/jpeg,image/png,image/webp" onChange={add} disabled={busy} />}
      {busy && <p className="small muted">Chwileczkę...</p>}
      {err && <p className="alert">{err}</p>}
      <p className="small muted">Zdjęcia sprawdzamy przed publikacją. Nie dodawaj zdjęć osób ani cudzych danych.</p>
    </div>
  );
}


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

  const reloadState = () => {
    try {
      createClient().rpc('place_user_state', { p_place: placeId }).then(({ data }) => {
        setInfo(data || { logged_in: false });
        setFav(Boolean(data?.favorite));
        const m = data?.mine;
        if (m) { setQ(m.r_quality || 0); setC(m.r_care || 0); setCl(m.r_clean || 0); setPr(m.r_price || 0); }
      });
    } catch { /* bez formularza */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reloadState(); }, [placeId]);

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
  if (info.is_owner) {
    return <div className="box small"><p>To Twój salon, więc nie możesz go oceniać. Odpowiadaj na opinie w <Link href="/konto/salon">panelu salonu</Link>.</p></div>;
  }
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
          <summary className="small">Dodaj, jakiej usługi dotyczy opinia (nieobowiązkowo)</summary>
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
      {mine && <ReviewPhotos review={mine} onChange={() => { reloadState(); router.refresh(); }} />}
    </>
  );
}
