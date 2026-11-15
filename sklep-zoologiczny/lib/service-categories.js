// Kategorie usług portalu: jedno źródło dla strony głównej, strony "Wszystkie usługi" i dolnego paska.
// Ikony: public/ikony/uslugi/<icon>.png (arkusze Mariusza, 2026-11-15).
// open: kategoria ma gotowy katalog (dziś tylko groomerzy; reszta pokazuje stronę zgłoszeń).
export const SERVICE_CATEGORIES = [
  { slug: 'weterynarze', name: 'Weterynarze', icon: 'weterynarze', blurb: 'Przychodnie, lecznice i gabinety weterynaryjne.' },
  { slug: 'groomerzy', name: 'Groomerzy', icon: 'groomerzy', href: '/salony', open: true, blurb: 'Salony strzyżenia i pielęgnacji psów i kotów.' },
  { slug: 'hotele', name: 'Hotele', icon: 'hotele', blurb: 'Hotele i pensjonaty dla psów i kotów.' },
  { slug: 'opiekunowie', name: 'Opiekunowie', icon: 'opiekunowie', blurb: 'Opiekunowie zwierząt, gdy Cię nie ma.' },
  { slug: 'trenerzy', name: 'Trenerzy', icon: 'trenerzy', blurb: 'Szkoły i trenerzy psów.' },
  { slug: 'behawiorysci', name: 'Behawioryści', icon: 'behawiorysci', blurb: 'Behawioryści psów i kotów.' },
  { slug: 'spacery', name: 'Spacery z psami', icon: 'spacery', blurb: 'Wyprowadzanie psów.' },
  { slug: 'fizjoterapia', name: 'Fizjoterapia i rehabilitacja', icon: 'fizjoterapia', blurb: 'Rehabilitacja, hydroterapia i masaż.' },
  { slug: 'transport', name: 'Transport zwierząt', icon: 'transport', blurb: 'Przewóz psów, kotów i innych zwierząt.' },
  { slug: 'fotografia', name: 'Fotografie zwierząt', icon: 'fotografia', blurb: 'Sesje zdjęciowe z pupilami.' },
  { slug: 'adopcje', name: 'Adopcje', icon: 'adopcje', blurb: 'Schroniska i fundacje, w których czekają zwierzęta.' },
  { slug: 'hodowle', name: 'Hodowle', icon: 'hodowle', blurb: 'Hodowle psów i kotów.' },
];

// Na stronie głównej: sześć głównych specjalistów.
export const HOME_CATEGORY_SLUGS = ['weterynarze', 'groomerzy', 'hotele', 'opiekunowie', 'trenerzy', 'behawiorysci'];

export const categoryBySlug = (slug) => SERVICE_CATEGORIES.find((c) => c.slug === slug);
export const categoryHref = (c) => c.href || `/uslugi/${c.slug}`;
