'use client';

import { useActionState } from 'react';
import { saveSettings } from '../actions';
import { SETTINGS_FIELDS, missingSettings } from '@/lib/settings-fields';

export default function SettingsForm({ settings }) {
  const [state, formAction, pending] = useActionState(saveSettings, null);
  const s = state?.values || settings;
  const missing = missingSettings(s);

  return (
    <form action={formAction} className="checkout" key={state?.ok ? JSON.stringify(s) : 'form'}>
      <fieldset>
        <legend>Sprzedaż</legend>
        <label className="radio">
          <input type="checkbox" name="sales_enabled" defaultChecked={s.sales_enabled} disabled={missing.length > 0} />
          Sprzedaż włączona
        </label>
        {missing.length > 0 ? (
          <div className="box">
            <p><strong>Sklep działa w trybie „przed startem”</strong>: klienci oglądają produkty i dodają do koszyka,
              ale nie mogą zamówić. Żeby włączyć sprzedaż, uzupełnij:</p>
            <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        ) : !s.sales_enabled ? (
          <p className="muted">Wszystkie dane są wpisane. Zaznacz „Sprzedaż włączona” i zapisz, żeby ruszyć ze sprzedażą.</p>
        ) : (
          <p className="ok">Sklep przyjmuje zamówienia.</p>
        )}
      </fieldset>

      <fieldset>
        <legend>Dane firmy i sklepu</legend>
        {SETTINGS_FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}{f.required ? ' *' : ''}{f.hint ? ` (${f.hint})` : ''}
            <input
              name={f.key}
              defaultValue={s[f.key] || ''}
              type={f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
              inputMode={['nip', 'regon', 'bank_account'].includes(f.key) ? 'numeric' : undefined}
            />
          </label>
        ))}
        <label>
          Status VAT
          <select name="vat_status" defaultValue={s.vat_status || 'zwolniony'}>
            <option value="zwolniony">Zwolniony z VAT (do 240 000 zł sprzedaży rocznie)</option>
            <option value="czynny">Czynny podatnik VAT</option>
          </select>
        </label>
      </fieldset>

      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok">Zapisano.</p>}
      <button className="btn btn-big" disabled={pending}>{pending ? 'Zapisywanie…' : 'Zapisz ustawienia'}</button>
    </form>
  );
}
