// Kategorie usług portalu: jedno źródło dla strony głównej, strony "Wszystkie usługi" i dolnego paska.
// Ikony: public/ikony/uslugi/<icon>.png (arkusze Mariusza, 2026-11-15).
// open: kategoria ma gotowy katalog (groomerzy, weterynarze, hotele; reszta pokazuje stronę zgłoszeń).
export const SERVICE_CATEGORIES = [
  { slug: 'weterynarze', name: 'Weterynarze', title: 'Weterynarze', icon: 'weterynarze', href: '/weterynarze', open: true, blurb: 'Zdrowie pupila' },
  { slug: 'groomerzy', name: 'Groomerzy', title: 'Groomerzy', icon: 'groomerzy', href: '/salony', open: true, blurb: 'Pielęgnacja' },
  { slug: 'hotele', name: 'Hotele', title: 'Hotele', icon: 'hotele', href: '/hotele', open: true, blurb: 'Bezpieczny pobyt' },
  { slug: 'opiekunowie', name: 'Opiekunowie', title: 'Petsitterzy', icon: 'opiekunowie', href: '/petsitterzy', open: true, blurb: 'Opieka domowa' },
  { slug: 'trenerzy', name: 'Trenerzy', title: 'Trenerzy', icon: 'trenerzy', href: '/trenerzy', open: true, blurb: 'Szkolenia' },
  { slug: 'behawiorysci', name: 'Behawioryści', title: 'Behawioryści', icon: 'behawiorysci', href: '/behawiorysci', open: true, blurb: 'Zachowanie' },
  { slug: 'spacery', name: 'Spacery z psami', title: 'Spacery', icon: 'spacery', href: '/spacerowicze', open: true, blurb: 'Dla psów' },
  { slug: 'fizjoterapia', name: 'Fizjoterapia i rehabilitacja', title: 'Rehabilitacja', icon: 'fizjoterapia', blurb: 'Powrót do formy' },
  { slug: 'transport', name: 'Transport zwierząt', title: 'Transport', icon: 'transport', href: '/transport', open: true, blurb: 'Bezpieczny przewóz' },
  { slug: 'fotografia', name: 'Fotografie zwierząt', title: 'Fotografia', icon: 'fotografia', href: '/fotografowie', open: true, blurb: 'Sesje zdjęciowe' },
  { slug: 'adopcje', name: 'Adopcje', title: 'Adopcje', icon: 'adopcje', blurb: 'Nowy dom' },
  { slug: 'hodowle', name: 'Hodowle', title: 'Hodowle', icon: 'hodowle', blurb: 'Sprawdzone hodowle' },
];

// Na stronie głównej: sześć głównych specjalistów.
export const HOME_CATEGORY_SLUGS = ['weterynarze', 'groomerzy', 'hotele', 'opiekunowie', 'trenerzy', 'behawiorysci'];

export const categoryBySlug = (slug) => SERVICE_CATEGORIES.find((c) => c.slug === slug);
export const categoryHref = (c) => c.href || `/uslugi/${c.slug}`;
