// Kategorie usług portalu: jedno źródło dla strony głównej, strony "Wszystkie usługi" i dolnego paska.
// Ikony: public/ikony/uslugi/<icon>.png (arkusze Mariusza, 2026-11-15).
// open: kategoria ma gotowy katalog (dziś tylko groomerzy; reszta pokazuje stronę zgłoszeń).
export const SERVICE_CATEGORIES = [
  { slug: 'weterynarze', name: 'Weterynarze', icon: 'weterynarze', blurb: 'Opieka zdrowotna dla Twojego pupila' },
  { slug: 'groomerzy', name: 'Groomerzy', icon: 'groomerzy', href: '/salony', open: true, blurb: 'Pielęgnacja i stylizacja' },
  { slug: 'hotele', name: 'Hotele', title: 'Hotele dla zwierząt', icon: 'hotele', blurb: 'Bezpieczny pobyt podczas Twojej nieobecności' },
  { slug: 'opiekunowie', name: 'Opiekunowie', title: 'Petsitterzy', icon: 'opiekunowie', blurb: 'Opieka nad pupilem w Twoim domu' },
  { slug: 'trenerzy', name: 'Trenerzy', title: 'Trenerzy psów', icon: 'trenerzy', blurb: 'Szkolenia i posłuszeństwo' },
  { slug: 'behawiorysci', name: 'Behawioryści', icon: 'behawiorysci', blurb: 'Pomoc w problemach z zachowaniem' },
  { slug: 'spacery', name: 'Spacery z psami', icon: 'spacery', blurb: 'Regularne spacery i aktywność' },
  { slug: 'fizjoterapia', name: 'Fizjoterapia i rehabilitacja', icon: 'fizjoterapia', blurb: 'Powrót do sprawności' },
  { slug: 'transport', name: 'Transport zwierząt', icon: 'transport', blurb: 'Bezpieczny przewóz' },
  { slug: 'fotografia', name: 'Fotografie zwierząt', icon: 'fotografia', blurb: 'Profesjonalne sesje zdjęciowe' },
  { slug: 'adopcje', name: 'Adopcje', icon: 'adopcje', blurb: 'Znajdź nowy dom' },
  { slug: 'hodowle', name: 'Hodowle', icon: 'hodowle', blurb: 'Odpowiedzialne hodowle' },
];

// Na stronie głównej: sześć głównych specjalistów.
export const HOME_CATEGORY_SLUGS = ['weterynarze', 'groomerzy', 'hotele', 'opiekunowie', 'trenerzy', 'behawiorysci'];

export const categoryBySlug = (slug) => SERVICE_CATEGORIES.find((c) => c.slug === slug);
export const categoryHref = (c) => c.href || `/uslugi/${c.slug}`;
