// TYLKO NA SERWERZE. Klucze usług (tabela integrations z 06_zamowienie.sql).
import { serviceClient } from '@/lib/supabase/service';

export const INTEGRATION_DEFAULTS = {
  resend_api_key: '',
  mail_from: '',
  notify_email: '',
  p24_enabled: false,
  p24_sandbox: true,
  p24_merchant_id: '',
  p24_pos_id: '',
  p24_crc: '',
  p24_api_key: '',
  inpost_geowidget_token: '',
};

// db: klient z prawem odczytu (serwisowy albo zalogowany administrator). Bez db: klient serwisowy.
export async function getIntegrations(db = serviceClient()) {
  if (!db) return { ...INTEGRATION_DEFAULTS, _missing: 'service' };
  const { data, error } = await db.from('integrations').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return { ...INTEGRATION_DEFAULTS, _missing: error ? 'sql' : 'row' };
  return { ...INTEGRATION_DEFAULTS, ...data };
}

export function p24Ready(i) {
  return Boolean(i?.p24_enabled && /^\d+$/.test(String(i.p24_merchant_id || '')) && i.p24_crc && i.p24_api_key);
}

// "abcd...wxyz" - do pokazania w panelu zamiast pełnego klucza
export function maskSecret(v) {
  const s = String(v || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}
