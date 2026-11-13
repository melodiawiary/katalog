// Pola ustawień sklepu - wspólne dla serwera i przeglądarki.
// (te same zasady sprawdza baza: funkcja settings_missing w supabase/01_ustawienia.sql).
export const SETTINGS_FIELDS = [
  { key: 'shop_name', label: 'Nazwa sklepu', required: true },
  { key: 'domain', label: 'Domena (np. sklep.pl)', required: false },
  { key: 'company_name', label: 'Pełna nazwa firmy', required: true },
  { key: 'owner_name', label: 'Imię i nazwisko właściciela', required: true },
  { key: 'nip', label: 'NIP', required: true, hint: '10 cyfr' },
  { key: 'regon', label: 'REGON', required: true, hint: '9 lub 14 cyfr' },
  { key: 'address', label: 'Ulica i numer', required: true },
  { key: 'postal_code', label: 'Kod pocztowy', required: true, hint: '00-000' },
  { key: 'city', label: 'Miejscowość', required: true },
  { key: 'email', label: 'E-mail kontaktowy', required: true },
  { key: 'phone', label: 'Telefon kontaktowy', required: true },
  { key: 'bank_account', label: 'Numer konta do przelewów', required: true, hint: '26 cyfr' },
  { key: 'feed_register_no', label: 'Numer wpisu do rejestru paszowego (PIW)', required: true },
];

const digits = (v) => String(v || '').replace(/\D/g, '');
const filled = (v) => String(v || '').trim() !== '';

const CHECKS = {
  shop_name: filled,
  company_name: filled,
  owner_name: filled,
  nip: (v) => /^\d{10}$/.test(digits(v)),
  regon: (v) => /^(\d{9}|\d{14})$/.test(digits(v)),
  address: filled,
  postal_code: (v) => /^\d{2}-\d{3}$/.test(String(v || '').trim()),
  city: filled,
  email: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim()),
  phone: filled,
  bank_account: (v) => /^(PL)?\d{26}$/.test(String(v || '').replace(/[\s-]/g, '')),
  feed_register_no: filled,
};

// Zwraca listę etykiet pól, których brakuje (lub są błędne)
export function missingSettings(s) {
  return SETTINGS_FIELDS.filter((f) => CHECKS[f.key] && !CHECKS[f.key](s?.[f.key])).map((f) => f.label);
}

// "PL61 1090 1014 0000 0712 1981 2874" - czytelny zapis numeru konta
export function formatAccount(value) {
  const d = String(value || '').replace(/[\s-]/g, '').replace(/^PL/i, '');
  return d.replace(/(\d{2})(?=\d)/, '$1 ').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
