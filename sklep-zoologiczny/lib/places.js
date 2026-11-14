// Katalog groomerów: stałe wspólne dla panelu i stron publicznych (zgodne z check-ami w 09_miejsca.sql)

export const PLACE_KIND = {
  salon: 'Salon',
  mobilny: 'Groomer mobilny',
  domowy: 'Groomer domowy',
};

export const PLACE_STATUS = {
  szkic: 'Szkic',
  opublikowany: 'Opublikowany',
  ukryty: 'Ukryty',
};

export const PLACE_STATUS_CLASS = {
  szkic: 'status-nowe',
  opublikowany: 'status-zrealizowane',
  ukryty: 'status-anulowane',
};

export const SPECIES = { pies: 'Psy', kot: 'Koty' };

export const SIZE_CLASS = {
  maly: 'Mały pies (do 10 kg)',
  sredni: 'Średni pies (10-25 kg)',
  duzy: 'Duży pies (25-40 kg)',
  olbrzymi: 'Olbrzymi pies (od 40 kg)',
  kot: 'Kot',
};

// 1 = poniedziałek ... 7 = niedziela (ISO, tak jak w place_hours)
export const WEEKDAYS = { 1: 'Poniedziałek', 2: 'Wtorek', 3: 'Środa', 4: 'Czwartek', 5: 'Piątek', 6: 'Sobota', 7: 'Niedziela' };

export const REQUEST_KIND = {
  polecenie: 'Polecenie salonu',
  korekta: 'Poprawka danych',
  usuniecie: 'Prośba o usunięcie',
};

export const PLACE_REQUEST_STATUS = {
  nowe: 'Nowe',
  w_toku: 'W toku',
  zalatwione: 'Załatwione',
  odrzucone: 'Odrzucone',
};

export const PLACE_REQUEST_STATUS_CLASS = {
  nowe: 'status-nowe',
  w_toku: 'status-oplacone',
  zalatwione: 'status-zrealizowane',
  odrzucone: 'status-anulowane',
};

// Granice współrzędnych jak w check-ach tabeli places (Polska z zapasem)
export const LAT_RANGE = [48.5, 55.5];
export const LNG_RANGE = [13.5, 24.5];

// Domyślny środek mapy w formularzu: Trójmiasto
export const DEFAULT_CENTER = { lat: 54.4, lng: 18.6, zoom: 10 };

export function isTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
}

// "12,50" -> 12.5; puste -> null; śmieci -> NaN
export function money(value) {
  const s = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

export const PLACE_SORT = {
  najlepsze: 'Najlepiej oceniane',
  opinie: 'Najwięcej opinii',
  odleglosc: 'Najbliżej',
  cena: 'Najtańsze',
  nazwa: 'Nazwa A-Z',
};

export const PLACE_BADGES = {
  polecany: 'Polecany',
  top_miasta: 'Top w mieście',
};

export const REVIEW_STATUS = {
  oczekuje: 'Czeka na zatwierdzenie',
  opublikowana: 'Opublikowana',
  ukryta: 'Ukryta',
};

// Liczba mnoga: 1 opinia, 2-4 opinie, 5+ opinii
export const opinionsWord = (n) => (n === 1 ? 'opinia' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'opinie' : 'opinii');
