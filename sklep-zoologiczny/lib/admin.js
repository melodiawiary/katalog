// Pomocnicze funkcje panelu admina (bez 'use server' - zwykłe funkcje).

// Błąd "brak tabeli / kolumny / relacji" = nie wklejono jeszcze pliku SQL w Supabase
export function needsSql(error) {
  if (!error) return false;
  return ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error.code)
    || /does not exist|schema cache|Could not find/i.test(error.message || '');
}

export const SQL_HINT = 'Baza nie ma jeszcze nowych tabel. Wklej w Supabase po kolei pliki supabase/01_ustawienia.sql i supabase/02_produkty.sql (SQL Editor -> New query -> Run).';

// "12,50" -> 12.5; puste -> null; śmieci -> NaN
export function parseDecimal(value) {
  const s = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function parseIntOrNull(value) {
  const s = String(value ?? '').trim();
  if (s === '') return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

// --- daty w strefie Europe/Warsaw (serwer Vercela działa w UTC) ---

const TZ = 'Europe/Warsaw';

function tzOffsetMs(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

// "2026-12-01" -> początek tego dnia w Polsce jako ISO (UTC)
export function warsawDayStart(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  let utc = guess - tzOffsetMs(guess);
  utc = guess - tzOffsetMs(utc); // poprawka przy zmianie czasu
  return new Date(utc).toISOString();
}

// "2026-12-31" -> koniec tego dnia (= początek następnego) w Polsce
export function warsawDayEnd(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return warsawDayStart(next.toISOString().slice(0, 10));
}

// ISO z bazy -> "2026-12-01" (dzień w Polsce); przy końcu promocji odejmujemy 1 ms
export function isoToWarsawDate(iso, isEnd = false) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - (isEnd ? 1 : 0);
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: TZ });
}

// Do zapytań PostgREST .or(...): usuwamy znaki, które psują składnię
export function cleanSearch(q) {
  return String(q || '').replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function promoActive(v, now = Date.now()) {
  return v.promo_price != null && Number(v.promo_price) < Number(v.price)
    && (!v.promo_from || new Date(v.promo_from).getTime() <= now)
    && (!v.promo_to || new Date(v.promo_to).getTime() > now);
}

// Poprawna długość i cyfra kontrolna EAN-8 / EAN-13 / GTIN-14 / UPC-12
export function validEan(ean) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(ean)) return false;
  const digits = ean.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
