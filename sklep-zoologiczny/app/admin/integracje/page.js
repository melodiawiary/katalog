import { adminClient } from '@/lib/admin-server';
import { getIntegrations, maskSecret } from '@/lib/integrations';
import { hasServiceKey } from '@/lib/supabase/service';
import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import IntegrationsForm from './IntegrationsForm';

export const metadata = { title: 'Integracje' };

export default async function IntegrationsPage() {
  const supabase = await adminClient();
  const integ = await getIntegrations(supabase);
  const settings = await getSettings();
  const { data: { user } } = await (await createClient()).auth.getUser();

  if (integ._missing) {
    return (
      <>
        <h1>Integracje</h1>
        <p className="alert">Wklej w Supabase plik supabase/06_zamowienie.sql (SQL Editor -&gt; New query -&gt; Run).</p>
      </>
    );
  }

  const view = {
    mail_from: integ.mail_from,
    notify_email: integ.notify_email,
    p24_enabled: integ.p24_enabled,
    p24_sandbox: integ.p24_sandbox,
    p24_merchant_id: integ.p24_merchant_id,
    p24_pos_id: integ.p24_pos_id,
    inpost_geowidget_token: integ.inpost_geowidget_token,
    masked: {
      resend_api_key: maskSecret(integ.resend_api_key),
      p24_crc: maskSecret(integ.p24_crc),
      p24_api_key: maskSecret(integ.p24_api_key),
    },
  };

  return (
    <>
      <h1>Integracje</h1>
      <p className="muted">E-maile (Resend), płatności online (Przelewy24) i mapa paczkomatów (InPost). Klucze widzi tylko administrator.</p>
      {!hasServiceKey() && (
        <div className="alert">
          <strong>Brakuje klucza serwisowego Supabase na Vercelu.</strong> Bez niego nie wyjdą e-maile z potwierdzeniem
          zamówienia i nie zadziałają płatności Przelewy24. Skopiuj klucz „secret” (albo „service_role”) z Supabase
          (Project Settings → API Keys) i dodaj na Vercelu zmienną <code>SUPABASE_SERVICE_ROLE_KEY</code>, potem Redeploy.
        </div>
      )}
      <IntegrationsForm data={view} defaultTo={settings.email || user?.email || ''} shopEmail={settings.email || ''} />
    </>
  );
}
