'use client';

import { useActionState, useState, startTransition } from 'react';
import { saveOwnerData, replyToReview, deleteReply, setNotify, setPlus, releasePlace } from './actions';
import { HoursEditor, PricesEditor, toPriceRows, newKey } from '@/components/places/Editors';
import { SPECIES } from '@/lib/places';

const SPECIES_ALL = Object.keys(SPECIES);

export function DataForm({ place, hours: hoursIn, prices: pricesIn, services, featureDefs, slug }) {
  const [state, action, pending] = useActionState(saveOwnerData, null);
  const [species, setSpecies] = useState(place.species || ['pies']);
  const [features, setFeatures] = useState(place.features || []);
  const [hours, setHours] = useState(hoursIn.map((h) => ({ ...h, key: newKey() })));
  const [prices, setPrices] = useState(toPriceRows(pricesIn));
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <form
      className="stack-form place-form"
      onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="place_id" value={place.id} />
      <input type="hidden" name="hours" value={JSON.stringify(hours.map(({ weekday, opens, closes }) => ({ weekday, opens, closes })))} />
      <input type="hidden" name="prices" value={JSON.stringify(prices.map(({ key, ...p }) => p))} />

      <fieldset>
        <legend>{{ weterynarz: 'O gabinecie', hotel: 'O hotelu', trener: 'O trenerze', petsitter: 'O petsitterze', behawiorysta: 'O behawioryście', spacerowicz: 'O spacerowiczu', transport: 'O przewoźniku', fotograf: 'O fotografie' }[place.category] || 'O salonie'}</legend>
        {place.category === 'weterynarz' && SPECIES_ALL.map((k) => <input key={k} type="hidden" name="species" value={k} />)}
        {place.category !== 'weterynarz' && <div className="attr-group">
          <span className="attr-name">Przyjmujemy *</span>
          <div className="attr-values">
            {Object.entries(SPECIES).map(([k, l]) => (
              <label key={k} className={species.includes(k) ? 'pill on' : 'pill'}>
                <input type="checkbox" name="species" value={k} checked={species.includes(k)} onChange={() => toggle(species, setSpecies, k)} />{l}
              </label>
            ))}
          </div>
        </div>}
        <label>Opis (do 3000 znaków)<textarea name="description" rows={5} defaultValue={place.description || ''} maxLength={3000} /></label>
        <div className="attr-values">
          {featureDefs.map((f) => (
            <label key={f.code} className={features.includes(f.code) ? 'pill on' : 'pill'}>
              <input type="checkbox" name="features" value={f.code} checked={features.includes(f.code)} onChange={() => toggle(features, setFeatures, f.code)} />{f.label}
            </label>
          ))}
        </div>
        <p className="small muted">Nazwę, adres i pinezkę zmieniamy my. Jeśli coś się zmieniło, użyj „Zgłoś poprawkę” na stronie salonu.</p>
      </fieldset>

      <fieldset>
        <legend>Kontakt i linki</legend>
        <div className="grid-2">
          <label>Telefon<input name="phone" type="tel" defaultValue={place.phone || ''} maxLength={30} /></label>
          <label>E-mail salonu<input name="email" type="email" defaultValue={place.email || ''} maxLength={200} /></label>
        </div>
        <label>Strona www<input name="website" defaultValue={place.website || ''} placeholder="https://" /></label>
        <label>Link do rezerwacji<input name="booking_url" defaultValue={place.booking_url || ''} placeholder="https://" /></label>
        <div className="grid-2">
          <label>Instagram<input name="instagram" defaultValue={place.instagram || ''} placeholder="https://instagram.com/..." /></label>
          <label>Facebook<input name="facebook" defaultValue={place.facebook || ''} placeholder="https://facebook.com/..." /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Godziny otwarcia</legend>
        <p className="small muted">Dzień bez przedziału = zamknięte.</p>
        <HoursEditor hours={hours} setHours={setHours} />
      </fieldset>

      <fieldset>
        <legend>Cennik („od” dla usługi i wielkości psa)</legend>
        <PricesEditor prices={prices} setPrices={setPrices} services={services} />
      </fieldset>

      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok-box">{state.ok}</p>}
      <div className="sticky-save"><button className="btn" disabled={pending}>{pending ? 'Zapisywanie…' : 'Zapisz zmiany'}</button></div>
    </form>
  );
}

export function ReplyBox({ review, slug }) {
  const [state, action, pending] = useActionState(replyToReview, null);
  const [delState, delAction, delPending] = useActionState(deleteReply, null);
  const r = review.reply;
  return (
    <div style={{ marginTop: 8 }}>
      {r?.status === 'ukryta' && <p className="small warn">Twoja odpowiedź została ukryta przez nas (niezgodna z zasadami). Zmień ją, jeśli chcesz.</p>}
      <form action={action} className="stack-form">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="review_id" value={review.id} />
        <label>{r ? 'Twoja odpowiedź (możesz ją poprawić)' : 'Odpowiedz na opinię'}
          <textarea name="body" rows={3} maxLength={1500} defaultValue={r?.body || ''} />
        </label>
        {state?.error && <p className="alert">{state.error}</p>}
        {state?.ok && <p className="small ok">{state.ok}</p>}
        <button className="btn btn-small btn-light" disabled={pending}>{r ? 'Zapisz odpowiedź' : 'Odpowiedz'}</button>
      </form>
      {r && (
        <form action={delAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="review_id" value={review.id} />
          <button className="link-btn danger small" disabled={delPending}>Usuń odpowiedź</button>
        </form>
      )}
    </div>
  );
}

export function NotifyToggle({ placeId, slug, on }) {
  const [state, action, pending] = useActionState(setNotify, null);
  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="place_id" value={placeId} />
      <label className="check"><input type="checkbox" name="on" defaultChecked={on} /> Wysyłaj mi e-mail o nowych opiniach</label>
      {state?.ok && <p className="small ok">{state.ok}</p>}
      <button className="btn btn-small btn-light" disabled={pending}>Zapisz</button>
    </form>
  );
}

export function PlusDoor({ placeId, slug, interested, note }) {
  const [state, action, pending] = useActionState(setPlus, null);
  return (
    <form action={action} className="stack-form">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="place_id" value={placeId} />
      <input type="hidden" name="on" value={interested ? '0' : '1'} />
      <p>Płatny plan z dodatkowymi możliwościami dla salonów. <strong>Nic nie kupujesz teraz</strong> - zapisujesz się tylko na listę zainteresowanych, a my odezwiemy się ze szczegółami.</p>
      {!interested && <label>Co byłoby dla Ciebie najważniejsze? (nieobowiązkowo)<textarea name="note" rows={2} maxLength={500} defaultValue={note || ''} /></label>}
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="small ok">{state.ok}</p>}
      <button className="btn btn-small btn-light" disabled={pending}>{interested ? 'Wypisz mnie z listy' : 'Zapisz mnie na listę'}</button>
    </form>
  );
}

export function ReleaseBox({ placeId, slug, name, copy }) {
  const [state, action, pending] = useActionState(releasePlace, null);
  const download = () => {
    const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `salon-${slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <details className="danger-zone">
      <summary className="link-btn danger">Zwolnij ten salon z mojego konta</summary>
      <form action={action} className="stack-form" onSubmit={(e) => { if (!window.confirm(`Zwolnić salon „${name}” z Twojego konta?`)) e.preventDefault(); }}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="place_id" value={placeId} />
        <p className="small">Salon zostanie w katalogu, ale przestaniesz go prowadzić. Jeśli jesteś ostatnim opiekunem, wrócą dane sprzed Twoich zmian (godziny, ceny, opis), a Twoje zdjęcia zostaną usunięte.</p>
        <label className="check"><input type="checkbox" name="delete_data" /> Usuń też moje dane z tego zgłoszenia (imię, telefon, dowody)</label>
        <button type="button" className="link-btn" onClick={download}>Pobierz kopię danych salonu (JSON)</button>
        {state?.error && <p className="alert">{state.error}</p>}
        <button className="btn btn-small btn-light" disabled={pending}>Zwolnij salon</button>
      </form>
    </details>
  );
}
