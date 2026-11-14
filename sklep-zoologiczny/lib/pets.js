// Wiek, etap życia i dopasowanie karmy dla zwierzaka z konta klienta.
// Sluggi cech (wiek, wielkość psa, gatunek) pochodzą z 02_produkty.sql.

export const SPECIES = { pies: 'Pies', kot: 'Kot', inne: 'Inne zwierzę' };
export const SPECIES_ICON = { pies: '🐶', kot: '🐱', inne: '🐾' };

export function ageMonths(birth, now = new Date()) {
  if (!birth) return null;
  const b = new Date(`${birth}T12:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  return Math.max(0, (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth()) - (now.getDate() < b.getDate() ? 1 : 0));
}

export function ageText(birth) {
  const m = ageMonths(birth);
  if (m == null) return '';
  if (m < 12) return m === 0 ? 'poniżej miesiąca' : m === 1 ? '1 miesiąc' : [2, 3, 4].includes(m) ? `${m} miesiące` : `${m} miesięcy`;
  const y = Math.floor(m / 12);
  const r = y === 1 ? 'rok' : [2, 3, 4].includes(y % 10) && ![12, 13, 14].includes(y % 100) ? 'lata' : 'lat';
  return `${y} ${r}`;
}

// Etap życia: junior / dorosły / senior (pies od 7 lat, kot od 10 lat - przybliżenie)
export function lifeStage(pet) {
  const m = ageMonths(pet.birth_date);
  if (m == null || (pet.species !== 'pies' && pet.species !== 'kot')) return null;
  if (m < 12) return 'junior';
  if (m >= (pet.species === 'pies' ? 84 : 120)) return 'senior';
  return 'dorosly';
}

export function dogSize(weight) {
  const w = Number(weight);
  if (!w) return null;
  if (w < 5) return 'mini';
  if (w < 10) return 'mala';
  if (w < 25) return 'srednia';
  if (w < 45) return 'duza';
  return 'olbrzymia';
}

// Link do sklepu z filtrami dla zwierzaka (adresy filtrów jak w lib/browse.js)
export function shopLink(pet) {
  if (pet.species !== 'pies' && pet.species !== 'kot') return null;
  const q = new URLSearchParams({ gatunek: pet.species });
  const stage = lifeStage(pet);
  if (stage) q.set('wiek', stage);
  const size = pet.species === 'pies' ? dogSize(pet.weight_kg) : null;
  if (size) q.set('wielkosc', size);
  return `/?${q.toString()}`;
}

// Orientacyjnie, na ile dni starcza opakowanie karmy SUCHEJ (netto w kg) dla zwierzaka o danej wadze.
// Dzienna dawka z zapotrzebowania energetycznego: pies ~31 g * waga^0,75, kot ~21,5 g * waga^0,75.
// To tylko podpowiedź - klient ustawia własną liczbę dni, a dawkowanie podaje opakowanie.
export function foodDaysEstimate(species, weightKg, netKg) {
  const w = Number(weightKg);
  const net = Number(netKg);
  if (!w || !net || net < 1) return null;
  const k = species === 'pies' ? 31 : species === 'kot' ? 21.5 : null;
  if (!k) return null;
  const perDay = k * Math.pow(w, 0.75);
  const days = Math.round((net * 1000) / perDay);
  return Math.min(365, Math.max(7, days));
}
