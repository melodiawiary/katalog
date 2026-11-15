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

// Ikony pozostałych zwierząt: dobór po końcówce adresu (np. ptaki-klatki, akwarystyka-filtry).
// Kategorii nie zakładamy na zapas: ikona jest użyta dopiero, gdy kategoria istnieje w sklepie.
const OTHER = {
  ptaki: { karma: 'karma', proso: 'proso', klatki: 'klatki', zerdzie: 'zerdzie', zabawki: 'zabawki', higiena: 'higiena', pielegnacja: 'higiena', zdrowie: 'zdrowie', poidla: 'poidla', miski: 'poidla' },
  gryzonie: { karma: 'karma', przysmaki: 'przysmaki', klatki: 'klatki', domki: 'domki', sciolka: 'sciolka', zabawki: 'kolowrotek', miski: 'miski', pielegnacja: 'pielegnacja', transportery: 'transporter' },
  akwarystyka: { karma: 'karma', akwaria: 'akwaria', filtry: 'filtry', grzalki: 'grzalki', oswietlenie: 'oswietlenie', napowietrzanie: 'napowietrzanie', dekoracje: 'dekoracje', woda: 'woda', uzdatniacze: 'woda', akcesoria: 'akcesoria' },
};

export function subcategoryIcon(slug = '') {
  const [animal, ...rest] = slug.split('-');
  const suffix = rest[0];
  if (OTHER[animal]) {
    const name = OTHER[animal][suffix];
    return name ? `/ikony/podkategorie/${animal}-${name}.png` : null;
  }
  if (animal === 'koty') return CAT[suffix] ? `/ikony/podkategorie/${CAT[suffix]}.png` : null;
  const icon = BY_SUFFIX[suffix];
  if (!icon) return null;
  if (DOG_ONLY.has(suffix) && animal !== 'psy') return null;
  return `/ikony/podkategorie/${icon}.png`;
}

export const ANIMAL_ICONS = new Set(['psy', 'koty', 'gryzonie', 'ptaki', 'akwarystyka']);
