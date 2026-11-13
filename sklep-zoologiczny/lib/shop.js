// Koszty dostawy muszą się zgadzać z funkcją create_order (najnowszy plik w supabase/, teraz 02_produkty.sql).
// Dane firmy i nazwa sklepu są w bazie (tabela settings, panel: /admin/ustawienia), patrz lib/settings.js.
export const FREE_SHIPPING_FROM = 200;

export const SHIPPING = {
  kurier: { label: 'Kurier', price: 15.99 },
  paczkomat: { label: 'Paczkomat', price: 12.99 },
};

export const PAYMENT = {
  przelew: { label: 'Przelew tradycyjny' },
  pobranie: { label: 'Płatność przy odbiorze' },
};

export const STATUS = {
  nowe: 'Nowe',
  oplacone: 'Opłacone',
  wyslane: 'Wysłane',
  zrealizowane: 'Zrealizowane',
  anulowane: 'Anulowane',
};

// Nazwa dostawy, także dla starych zamówień z odbiorem osobistym
export function shippingLabel(method) {
  return SHIPPING[method]?.label || (method === 'odbior' ? 'Odbiór osobisty' : method);
}

export function shippingCost(method, subtotal) {
  if (subtotal >= FREE_SHIPPING_FROM) return 0;
  return SHIPPING[method]?.price ?? 0;
}

const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
export function price(value) {
  return formatter.format(Number(value) || 0);
}

export function slugify(text) {
  const map = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
  return String(text)
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => map[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
