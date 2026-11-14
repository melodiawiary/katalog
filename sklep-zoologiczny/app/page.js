import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { topCategories, visibleCategories } from '@/lib/categories';
import { browseHref, flatParams } from '@/lib/browse';
import { FREE_SHIPPING_FROM } from '@/lib/shop';
import { getSettings } from '@/lib/settings';
import ProductCard from '@/components/browse/ProductCard';
import AcademyForm from '@/components/AcademyForm';
import { PlaceRating, PlaceBadges } from '@/components/places/Rating';
import { PLACE_KIND } from '@/lib/places';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const s = await getSettings();
  return {
    title: `${s.shop_name}: sklep zoologiczny i katalog groomerów`,
    description: 'Karma i akcesoria dla psów i kotów, ranking salonów groomerskich z opiniami klientów i zapisy na kursy pielęgnacji.',
  };
}

const emoji = (name = '') => (/pies|psy|psa/i.test(name) ? '🐶' : /kot/i.test(name) ? '🐱' : /gryz|chomik|królik/i.test(name) ? '🐹' : /ptak|ptaki/i.test(name) ? '🐦' : /ryb|akwar/i.test(name) ? '🐠' : '🐾');

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const params = flatParams(sp);

  // stare adresy: /?kategoria=psy -> /kategoria/psy, /?q=karma -> /szukaj, /?marka=... -> /sklep?marka=...
  if (params.kategoria && !params.q) {
    const { kategoria, ...rest } = params;
    redirect(browseHref(`/kategoria/${encodeURIComponent(kategoria)}`, rest, {}));
  }
  if (params.q) redirect(browseHref('/szukaj', params, {}));
  if (Object.keys(params).length > 0) redirect(browseHref('/sklep', params, {}));

  const supabase = await createClient();
  const [{ data: cats }, { data: popular }, { data: isPublic }, { data: { user } }, s] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.rpc('search_products', { p_q: '', p_category: null, p_filters: {}, p_sort: 'popularne', p_page: 1, p_per_page: 8 }),
    supabase.rpc('places_public'),
    supabase.auth.getUser(),
    getSettings(),
  ]);
  const categories = topCategories(visibleCategories(cats || []));
  const products = (popular?.items || []).filter((p) => p.stock > 0).slice(0, 8);

  let places = [];
  if (isPublic) {
    const { data } = await supabase.rpc('search_places', { p_sort: 'najlepsze', p_page: 1, p_per_page: 3 });
    places = data?.items || [];
  }

  return (
    <>
      <section className="home-hero">
        <h1>Wszystko dla psa i kota w jednym miejscu</h1>
        <p className="muted">Sklep z karmą i akcesoriami oraz ranking sprawdzonych groomerów z opiniami klientów.</p>
        <div className="hero-btns">
          <Link href="/sklep" className="btn">Zakupy dla pupila</Link>
          {isPublic ? <Link href="/salony" className="btn btn-light">Znajdź groomera w pobliżu</Link> : <Link href="/akademia" className="btn btn-light">Akademia: zapisz się</Link>}
        </div>
      </section>

      <ul className="trust-bar">
        <li>🚚 Darmowa dostawa od {FREE_SHIPPING_FROM} zł</li>
        <li>📦 Szybka wysyłka</li>
        <li>↩️ 14 dni na zwrot</li>
        <li>💳 BLIK i szybkie przelewy</li>
      </ul>

      {categories.length > 0 && (
        <section className="tile-row" aria-label="Kategorie">
          {categories.map((c) => (
            <Link key={c.id} href={`/kategoria/${c.slug}`} className="tile"><span className="tile-emoji">{emoji(c.name)}</span>{c.name}</Link>
          ))}
        </section>
      )}

      {user && (
        <p className="box">Kupowałeś już u nas? <Link href="/konto/zamowienia">Zamów ponownie</Link> jednym kliknięciem z historii zamówień.</p>
      )}

      {products.length > 0 && (
        <section className="home-section">
          <h2>Najpopularniejsze</h2>
          <div className="grid">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          <p className="center-text"><Link href="/sklep" className="btn btn-light">Zobacz wszystkie produkty</Link></p>
        </section>
      )}

      {places.length > 0 && (
        <section className="home-section">
          <h2>Polecani groomerzy</h2>
          <ul className="home-cards">
            {places.map((p) => (
              <li key={p.id} className="place-card">
                <Link href={`/salony/${p.slug}`} className="place-card-name">{p.name}</Link>
                <div className="rating-line"><PlaceRating avg={p.rating_avg} count={p.rating_count} /> <PlaceBadges badges={p.badges || []} verified={p.verified} /></div>
                <div className="small muted">{PLACE_KIND[p.kind]} · {[p.district, p.city].filter(Boolean).join(', ')}</div>
              </li>
            ))}
          </ul>
          <p className="center-text"><Link href="/salony" className="btn btn-light">Wszystkie salony i mapa</Link></p>
        </section>
      )}

      <section className="home-section academy-box">
        <h2>Akademia: kursy pielęgnacji psów i kotów</h2>
        <p>Planujemy kursy dla właścicieli i przyszłych groomerów. Zapisz się, a damy znać, gdy ruszą zapisy.</p>
        <AcademyForm />
      </section>

      <section className="home-section box">
        <h2>Prowadzisz salon groomerski?</h2>
        <p>Dołącz do katalogu za darmo: klienci znajdą Twój salon na mapie, ocenią go, a Ty zobaczysz swoje miejsce w rankingu miasta.</p>
        <Link href="/salony/polec" className="btn btn-light">Dodaj swój salon</Link>
      </section>
    </>
  );
}
