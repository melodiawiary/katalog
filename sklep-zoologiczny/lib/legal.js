// Wspólne rzeczy dla stron prawnych (regulamin, prywatność, cookies, zwroty).
// Dane firmy biorą się z tabeli settings (panel /admin/ustawienia), nic nie jest wpisane na stałe.

// Zmieniać przy każdej zmianie treści dokumentów (zapisuje się przy zamówieniu jako wersja zaakceptowanego regulaminu).
export const LEGAL_VERSION = '2026-11-14-2';
export const LEGAL_DATE_PL = '14 listopada 2026 r.';

export const LEGAL_LINKS = [
  { href: '/regulamin', label: 'Regulamin' },
  { href: '/polityka-prywatnosci', label: 'Polityka prywatności' },
  { href: '/polityka-cookies', label: 'Polityka cookies' },
  { href: '/zwroty', label: 'Zwroty i reklamacje' },
];

// Adres sprzedawcy w jednej linii
export function sellerAddress(s) {
  return [s.address, [s.postal_code, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// Dane firmy brakujące w ustawieniach (do ostrzeżenia na stronach prawnych)
export function missingForLegal(s) {
  const need = {
    company_name: 'nazwa firmy', address: 'adres', postal_code: 'kod pocztowy', city: 'miejscowość',
    nip: 'NIP', email: 'e-mail', phone: 'telefon', feed_register_no: 'numer rejestru paszowego',
  };
  return Object.entries(need).filter(([k]) => !String(s?.[k] || '').trim()).map(([, label]) => label);
}
