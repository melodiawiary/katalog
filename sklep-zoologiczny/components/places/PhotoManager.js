'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addPhotoRecord, deletePhotoAction, mainPhotoAction } from '@/app/konto/(panel)/salon/[slug]/actions';

async function shrink(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.84));
}

// Zdjęcia salonu (do 8): wspólne dla panelu właściciela i panelu admina
export default function PhotoManager({ placeId, slug, photos = [] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  async function add(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const blob = await shrink(f);
      const path = `${placeId}/${crypto.randomUUID()}.jpg`;
      const up = await createClient().storage.from('salony').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error('Nie udało się wgrać zdjęcia.');
      const r = await addPhotoRecord(placeId, path, '');
      if (r?.error) throw new Error(r.error);
      router.refresh();
    } catch (x) { setErr(x.message || 'Nie udało się dodać zdjęcia.'); }
    setBusy(false);
  }

  async function act(fn, id) {
    setBusy(true); setErr('');
    const r = await fn(slug, id);
    if (r?.error) setErr(r.error);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="box">
      <h3>Zdjęcia salonu ({photos.length}/8)</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
        {photos.map((ph, i) => (
          <div key={ph.id} style={{ textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/storage/v1/object/public/salony/${ph.path}`} alt="" style={{ height: 90, borderRadius: 6, display: 'block' }} />
            <span className="small">
              {i > 0 && <button type="button" className="link-btn" onClick={() => act(mainPhotoAction, ph.id)} disabled={busy}>Na początek</button>}
              {i > 0 && ' · '}
              <button type="button" className="link-btn danger" onClick={() => act(deletePhotoAction, ph.id)} disabled={busy}>Usuń</button>
            </span>
          </div>
        ))}
        {photos.length === 0 && <p className="muted small">Brak zdjęć. Dodaj zdjęcie salonu, jest dużo lepiej oglądane.</p>}
      </div>
      {photos.length < 8 && <input type="file" accept="image/jpeg,image/png,image/webp" onChange={add} disabled={busy} />}
      {busy && <p className="small muted">Chwileczkę...</p>}
      {err && <p className="alert">{err}</p>}
      <p className="small muted">Dodawaj zdjęcia salonu i swojej pracy. Bez zdjęć klientów i danych osobowych. Pierwsze zdjęcie jest główne.</p>
    </div>
  );
}
