'use client';

import { useActionState } from 'react';
import ActionForm from '@/components/admin/ActionForm';
import { saveIntegrations, sendTestEmail, testP24 } from './actions';

function Secret({ name, label, masked, hint }) {
  return (
    <div>
      <label>
        {label}
        <input name={name} type="password" autoComplete="off" placeholder={masked ? `zapisany: ${masked} (wpisz nowy, żeby zmienić)` : 'wklej klucz'} />
      </label>
      {hint && <p className="secret-note">{hint}</p>}
      {masked && <label className="radio small"><input type="checkbox" name={`clear_${name}`} /> usuń zapisany klucz</label>}
    </div>
  );
}

export default function IntegrationsForm({ data, defaultTo, shopEmail }) {
  const [state, action, pending] = useActionState(saveIntegrations, null);
  const d = data;

  return (
    <>
      <form action={action} className="checkout" key={state?.at || 'f'}>
        <fieldset>
          <legend>E-maile (Resend)</legend>
          <p className="small muted">
            Darmowe konto: resend.com (3000 e-maili miesięcznie). Klucz: Resend → API Keys → Create API Key.
            Dopóki nie dodasz w Resend własnej domeny, e-maile dochodzą tylko na adres, którym założono konto Resend (do testów wystarczy).
          </p>
          <Secret name="resend_api_key" label="Klucz API Resend (re_...)" masked={d.masked.resend_api_key} />
          <label>
            Nadawca (po dodaniu domeny w Resend, np. „Sklep &lt;sklep@twojadomena.pl&gt;”)
            <input name="mail_from" defaultValue={d.mail_from} placeholder="puste = onboarding@resend.dev (tylko testy)" />
          </label>
          <label>
            Kopie nowych zamówień wysyłaj na
            <input name="notify_email" type="email" defaultValue={d.notify_email} placeholder={shopEmail || 'twój e-mail'} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Płatności online (Przelewy24: BLIK, przelewy, karty)</legend>
          <p className="small muted">
            Dane z panelu Przelewy24: Moje dane → Dane API i konfiguracja. Na start konto testowe (sandbox),
            prawdziwe dopiero z danymi firmy.
          </p>
          <label>ID sprzedawcy (Merchant ID)<input name="p24_merchant_id" defaultValue={d.p24_merchant_id} inputMode="numeric" /></label>
          <label>ID sklepu (POS ID, zwykle to samo - można zostawić puste)<input name="p24_pos_id" defaultValue={d.p24_pos_id} inputMode="numeric" /></label>
          <Secret name="p24_crc" label="Klucz CRC" masked={d.masked.p24_crc} />
          <Secret name="p24_api_key" label="Klucz API (klucz do raportów)" masked={d.masked.p24_api_key} />
          <label className="radio"><input type="checkbox" name="p24_sandbox" defaultChecked={d.p24_sandbox} /> Tryb testowy (sandbox - bez prawdziwych pieniędzy)</label>
          <label className="radio"><input type="checkbox" name="p24_enabled" defaultChecked={d.p24_enabled} /> Pokazuj klientom płatność online</label>
        </fieldset>

        <fieldset>
          <legend>Mapa paczkomatów (nieobowiązkowe)</legend>
          <p className="small muted">
            Sklep ma własną mapę paczkomatów i działa bez tego. Gdy będziesz mieć konto InPost (Manager Paczek → Moje konto → API → Token do Geowidget),
            możesz wkleić token - wtedy pokaże się oficjalna mapa InPost.
          </p>
          <label>Token Geowidget InPost<textarea name="inpost_geowidget_token" rows={2} defaultValue={d.inpost_geowidget_token} /></label>
        </fieldset>

        {state?.error && <p className="alert">{state.error}</p>}
        {state?.ok && <p className="ok">{state.message}</p>}
        <button className="btn btn-big" disabled={pending}>{pending ? 'Zapisywanie…' : 'Zapisz'}</button>
      </form>

      <div className="checkout">
        <fieldset>
          <legend>Sprawdź</legend>
          <ActionForm action={sendTestEmail} submitLabel="Wyślij e-mail testowy">
            <label>Na adres<input name="to" type="email" defaultValue={defaultTo} required /></label>
          </ActionForm>
          <ActionForm action={testP24} submitLabel="Sprawdź połączenie z Przelewy24" />
        </fieldset>
      </div>
    </>
  );
}
