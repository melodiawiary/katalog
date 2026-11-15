'use client';

import { useActionState, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { startClaim, verifyClaim, submitManual, createDraft } from './actions';

async function shrink(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}

const ROLES = [['wlasciciel', 'Jestem właścicielem'], ['zarzadzajacy', 'Zarządzam salonem']];

function Person({ defaults }) {
  return (
    <>
      <label>Imię i nazwisko<input name="name" required minLength={2} maxLength={120} defaultValue={defaults?.contact_name || ''} autoComplete="name" /></label>
      <label>Kim jesteś dla salonu?
        <select name="role" defaultValue={defaults?.role || 'wlasciciel'}>
          {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Telefon (nieobowiązkowo, tylko dla nas)<input name="phone" maxLength={30} defaultValue={defaults?.contact_phone || ''} autoComplete="tel" inputMode="tel" /></label>
      <label className="check">
        <input type="checkbox" name="consent" required />{' '}
        <span className="small">Zgadzam się, żebyście sprawdzili, czy mogę zarządzać tym salonem, i przechowali dane z tego zgłoszenia na czas weryfikacji.</span>
      </label>
    </>
  );
}

export default function ClaimForm({ info, slug }) {
  const [method, setMethod] = useState(info.known_email_hint || info.website_domain ? 'mail' : 'reczna');
  const [start, startAction, startPending] = useActionState(startClaim, null);
  const [verify, verifyAction, verifyPending] = useActionState(verifyClaim, null);
  const [manual, manualAction, manualPending] = useActionState(submitManual, null);
  const [draft, draftAction, draftPending] = useActionState(createDraft, null);
  const [upload, setUpload] = useState({ path: '', busy: false, error: '' });

  const claimId = verify?.claimId || start?.claimId || (info.claim?.status === 'nowe' ? info.claim.id : null);
  const showCode = (start?.step === 'code' || verify?.step === 'code' || (info.claim?.status === 'nowe' && info.claim.code_active)) && verify?.step !== 'form';
  const result = verify?.done || manual?.done;

  if (result === 'zatwierdzone') {
    return (
      <div className="ok-box">
        <p><strong>Gotowe, salon jest na Twoim koncie.</strong></p>
        <p><a className="btn" href={`/konto/salon/${slug}`}>Przejdź do panelu salonu</a></p>
      </div>
    );
  }
  if (result === 'oczekuje_admina') {
    return (
      <div className="ok-box">
        <p><strong>Zgłoszenie przyjęte.</strong> Sprawdzimy je ręcznie i odpiszemy na adres z Twojego konta. Zwykle trwa to do kilku dni roboczych.</p>
      </div>
    );
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUpload({ path: '', busy: true, error: '' });
    try {
      const uid = draft?.userId;
      if (!uid) throw new Error('Najpierw wypełnij dane powyżej i kliknij "Zapisz dane".');
      const blob = await shrink(f);
      const supabase = createClient();
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('przejecia').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error('Nie udało się wgrać zdjęcia.');
      setUpload({ path, busy: false, error: '' });
    } catch (err) {
      setUpload({ path: '', busy: false, error: err.message || 'Nie udało się wgrać zdjęcia.' });
    }
  }

  return (
    <div className="stack-form">
      {showCode ? (
        <form action={verifyAction} className="stack-form">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="claim_id" value={claimId || ''} />
          <p>Wysłaliśmy kod na adres <strong>{start?.sentTo || info.claim?.code_hint}</strong>. Wpisz go poniżej (działa kilkanaście minut).</p>
          <label>Kod z e-maila<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={12} required /></label>
          {(verify?.error || start?.error) && <p className="alert">{verify?.error || start?.error}</p>}
          <button className="btn" disabled={verifyPending}>Potwierdź</button>
        </form>
      ) : (
        <>
          <div className="method-tabs" role="tablist">
            {(info.known_email_hint || info.website_domain) && (
              <button type="button" className={`method-tab ${method === 'mail' ? 'on' : ''}`} onClick={() => setMethod('mail')}>Kod na e-mail salonu</button>
            )}
            <button type="button" className={`method-tab ${method === 'reczna' ? 'on' : ''}`} onClick={() => setMethod('reczna')}>Weryfikacja ręczna</button>
          </div>

          {method === 'mail' ? (
            <form action={startAction} className="stack-form">
              <input type="hidden" name="slug" value={slug} />
              <Person defaults={info.claim} />
              {info.known_email_hint ? (
                <>
                  <p className="small muted">Kod wyślemy na adres salonu z katalogu: <strong>{info.known_email_hint}</strong>.</p>
                  <input type="hidden" name="mode" value="known" />
                </>
              ) : (
                <>
                  <input type="hidden" name="mode" value="domain" />
                  <label>Twój e-mail w domenie salonu ({info.website_domain})
                    <input name="email" type="email" required maxLength={200} placeholder={`kontakt@${info.website_domain}`} />
                  </label>
                  <p className="small muted">Adresy z poczty publicznej (gmail, wp, onet i podobne) nie wystarczą. Użyj adresu na stronie salonu albo wybierz weryfikację ręczną.</p>
                </>
              )}
              {start?.error && <p className="alert">{start.error}</p>}
              <button className="btn" disabled={startPending}>Wyślij kod</button>
            </form>
          ) : (
            <div className="stack-form">
              {!draft?.draft && info.claim?.status !== 'nowe' && (
                <form action={draftAction} className="stack-form">
                  <input type="hidden" name="slug" value={slug} />
                  <Person defaults={info.claim} />
                  {draft?.error && <p className="alert">{draft.error}</p>}
                  <button className="btn btn-light" disabled={draftPending}>Zapisz dane i przejdź dalej</button>
                </form>
              )}
              {(draft?.draft || info.claim?.status === 'nowe') && (
                <form action={manualAction} className="stack-form">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="evidence_path" value={upload.path} />
                  <p className="small muted">Dodaj zdjęcie szyldu z wejścia albo opisz, jak możemy Cię potwierdzić (np. dane z CEIDG: nazwa i adres firmy). Zdjęcie jest prywatne i usuwamy je po decyzji.</p>
                  <label>Zdjęcie szyldu lub dokumentu
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
                  </label>
                  {upload.busy && <p className="small muted">Wgrywam...</p>}
                  {upload.path && <p className="small ok">Zdjęcie wgrane.</p>}
                  {upload.error && <p className="alert">{upload.error}</p>}
                  <label>Opis<textarea name="note" rows={3} maxLength={1500} /></label>
                  {manual?.error && <p className="alert">{manual.error}</p>}
                  <button className="btn" disabled={manualPending || upload.busy}>Wyślij do sprawdzenia</button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
