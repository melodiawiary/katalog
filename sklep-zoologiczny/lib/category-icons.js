// Ikony podkategorii (public/ikony/podkategorie/*.png) dobierane po końcówce adresu kategorii.
// Przysmaki i smycze mają ikony tylko dla psów; dla pozostałych kategorii zostaje emoji.
const BY_SUFFIX = {
  karma: 'karma',
  przysmaki: 'przysmaki',
  zabawki: 'zabawki',
  spacer: 'smycze',
  legowiska: 'legowiska',
  miski: 'miski',
  pielegnacja: 'pielegnacja',
};
const DOG_ONLY = new Set(['przysmaki', 'spacer']);

const CAT = {
  karma: 'koty-karma',
  przysmaki: 'koty-przysmaki',
  zabawki: 'koty-kluebek',
  drapaki: 'koty-drapak',
  miski: 'koty-miski',
  pielegnacja: 'koty-pielegnacja',
};

export function subcategoryIcon(slug = '') {
  const [animal, ...rest] = slug.split('-');
  const suffix = rest[0];
  if (animal === 'koty') return CAT[suffix] ? `/ikony/podkategorie/${CAT[suffix]}.png` : null;
  const icon = BY_SUFFIX[suffix];
  if (!icon) return null;
  if (DOG_ONLY.has(suffix) && animal !== 'psy') return null;
  return `/ikony/podkategorie/${icon}.png`;
}

export const ANIMAL_ICONS = new Set(['psy', 'koty', 'gryzonie', 'ptaki', 'akwarystyka']);
