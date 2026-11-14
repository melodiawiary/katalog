// TYLKO NA SERWERZE. Przelewy24, REST API v1 (https://developers.przelewy24.pl).
// Klucze w panelu: Integracje. Tryb testowy = sandbox.przelewy24.pl.
import crypto from 'node:crypto';

export function p24Base(integ) {
  return integ.p24_sandbox ? 'https://sandbox.przelewy24.pl' : 'https://secure.przelewy24.pl';
}

const merchantId = (i) => Number(i.p24_merchant_id);
const posId = (i) => Number(i.p24_pos_id || i.p24_merchant_id);

// Podpis: sha384 z JSON-a z polami w dokładnie tej kolejności (JSON.stringify nie zmienia "/" ani polskich znaków)
function sign(obj) {
  return crypto.createHash('sha384').update(JSON.stringify(obj)).digest('hex');
}

async function call(integ, method, path, body) {
  const auth = Buffer.from(`${posId(integ)}:${integ.p24_api_key}`).toString('base64');
  try {
    const res = await fetch(`${p24Base(integ)}/api/v1${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error || data || {});
      return { ok: false, status: res.status, error: `Przelewy24 (${res.status}): ${msg}`.slice(0, 400) };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `Przelewy24: brak połączenia (${e.message})` };
  }
}

// Sprawdzenie kluczy (przycisk w panelu)
export function testAccess(integ) {
  return call(integ, 'GET', '/testAccess');
}

// Rejestracja transakcji -> { ok, token, url }
// t: { sessionId, amount (grosze), description, email, client, phone, urlReturn, urlStatus }
export async function registerTransaction(integ, t) {
  const body = {
    merchantId: merchantId(integ),
    posId: posId(integ),
    sessionId: t.sessionId,
    amount: t.amount,
    currency: 'PLN',
    description: t.description.slice(0, 1024),
    email: t.email,
    client: t.client?.slice(0, 40),
    phone: t.phone?.replace(/[^\d+]/g, '').slice(0, 12) || undefined,
    country: 'PL',
    language: 'pl',
    urlReturn: t.urlReturn,
    urlStatus: t.urlStatus,
    timeLimit: 30,
    waitForResult: true,
    encoding: 'UTF-8',
    sign: sign({ sessionId: t.sessionId, merchantId: merchantId(integ), amount: t.amount, currency: 'PLN', crc: integ.p24_crc }),
  };
  const r = await call(integ, 'POST', '/transaction/register', body);
  if (!r.ok) return r;
  const token = r.data?.data?.token;
  if (!token) return { ok: false, error: 'Przelewy24 nie zwróciły tokenu płatności.' };
  return { ok: true, token, url: `${p24Base(integ)}/trnRequest/${token}` };
}

// Czy powiadomienie (urlStatus) jest prawdziwe
export function notificationValid(integ, n) {
  const expected = sign({
    merchantId: Number(n.merchantId),
    posId: Number(n.posId),
    sessionId: String(n.sessionId),
    amount: Number(n.amount),
    originAmount: Number(n.originAmount),
    currency: String(n.currency),
    orderId: Number(n.orderId),
    methodId: Number(n.methodId),
    statement: String(n.statement),
    crc: integ.p24_crc,
  });
  const got = String(n.sign || '');
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// Potwierdzenie transakcji (bez tego Przelewy24 nie przekażą pieniędzy)
export function verifyTransaction(integ, { sessionId, orderId, amount }) {
  return call(integ, 'PUT', '/transaction/verify', {
    merchantId: merchantId(integ),
    posId: posId(integ),
    sessionId,
    amount,
    currency: 'PLN',
    orderId: Number(orderId),
    sign: sign({ sessionId, orderId: Number(orderId), amount, currency: 'PLN', crc: integ.p24_crc }),
  });
}

// Stan transakcji po sessionId: data.status 0 = brak wpłaty, 1 = wpłacone (do potwierdzenia), 2 = potwierdzone, 3 = zwrot
export function transactionBySession(integ, sessionId) {
  return call(integ, 'GET', `/transaction/by/sessionId/${encodeURIComponent(sessionId)}`);
}
