import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { topCategories, visibleCategories } from '@/lib/categories';
import { browseHref, flatParams } from '@/lib/browse';
import { FREE_SHIPPING_FROM } from '@/lib/shop';
import { getSettings } from '@/lib/settings';
import ProductCard from '@/components/browse/ProductCard';
import AcademyForm from '@/components/AcademyForm';
import HomeStrip from '@/components/HomeStrip';
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
      <HomeStrip freeFrom={FREE_SHIPPING_FROM} categories={categories} showSalons={Boolean(isPublic)} />

      <section className="home-banner">
        <svg className="home-banner-bg" viewBox="0 0 360 210" preserveAspectRatio="none" aria-hidden="true">
          <path d="M8 72C8 44 26 30 54 29L112 28C126 28 134 36 150 34C190 28 232 20 272 22C330 24 352 46 352 86L352 170C352 196 338 205 314 205L46 205C22 205 8 196 8 172Z" fill="#fdf8f0" stroke="#f0dbbf" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <img src="/ikony/start/hero.png" alt="" className="home-banner-art" width="465" height="397" />
        <h1 className="home-banner-title"><span>Wszystko dla</span> <span>psa i kota</span> <span>w jednym miejscu</span></h1>
        <svg className="home-banner-sparks" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e8801f" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M4 6l5 5M16 3l1.5 6" /></svg>
        <div className="home-banner-btns">
          <Link href="/sklep" className="home-banner-btn home-banner-btn-main">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h3l2.6 11.2a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.5L21 7H6" /><circle cx="10" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg>
            <span>Zakupy dla pupila</span>
          </Link>
          {isPublic ? (
            <Link href="/salony" className="home-banner-btn home-banner-btn-alt">
              <svg viewBox="0 0 30 26" width="30" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="17" r="3" /><circle cx="6" cy="6.5" r="3" /><path d="M8.5 8.4l10 9.4M8.5 15l10-9.4" /><g fill="currentColor" stroke="none"><circle cx="20.5" cy="6" r="1.5" /><circle cx="24" cy="4" r="1.5" /><circle cx="27.4" cy="6" r="1.4" /><ellipse cx="24" cy="9.2" rx="3" ry="2.3" /></g></svg>
              <span>Znajdź groomera</span>
            </Link>
          ) : (
            <Link href="/akademia" className="home-banner-btn home-banner-btn-alt"><span>Akademia</span></Link>
          )}
        </div>
      </section>

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
        <p>Kursy dla właścicieli i przyszłych groomerów. Zapisz się na listę, a damy znać o terminach.</p>
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
