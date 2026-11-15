import Link from 'next/link';
import { redirect } from 'next/navigation';
import { browseHref, flatParams } from '@/lib/browse';
import { getSettings } from '@/lib/settings';
import { SERVICE_CATEGORIES, HOME_CATEGORY_SLUGS, categoryHref } from '@/lib/service-categories';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const s = await getSettings();
  return {
    title: `${s.shop_name}: sklep i sprawdzone usługi dla psów i kotów`,
    description: 'Karma i akcesoria dla psów i kotów oraz sprawdzone usługi: weterynarze, groomerzy, hotele, opiekunowie, trenerzy i behawioryści, z opiniami klientów.',
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

  const homeCats = HOME_CATEGORY_SLUGS.map((slug) => SERVICE_CATEGORIES.find((c) => c.slug === slug));

  return (
    <>
      <form action="/szukaj" method="get" role="search" className="home-search">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
        <input type="search" name="q" placeholder="Czego szukasz dla pupila?" aria-label="Szukaj produktów" enterKeyHint="search" />
      </form>

      <section className="portal-hero">
        <h1 className="portal-title">
          Wszystko dla Twojego pupila
          <svg className="portal-sparks" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#e8801f" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 4l4 6M13 2l1.6 7M20 5l-5 4" /></svg>
        </h1>
        <p className="portal-sub">Zakupy i sprawdzone usługi w jednym miejscu</p>
        <div className="portal-stage">
          <img src="/ilustracje/pies-kot-serce.png" alt="" className="portal-art" width="700" height="472" />
        </div>
        <div className="portal-btns">
          <Link href="/sklep" className="portal-btn portal-btn-main">
            <span className="portal-ico" style={{ '--ikona': 'url(/ikony/sklep.png)' }} aria-hidden="true" />
            <span className="portal-btn-text"><span className="long">Zakupy dla pupila</span><span className="short">Zakupy</span></span>
            <svg className="portal-chev" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </Link>
          <Link href="/uslugi" className="portal-btn portal-btn-alt">
            <span className="portal-ico" style={{ '--ikona': 'url(/ikony/uslugi.png)' }} aria-hidden="true" />
            <span className="portal-btn-text"><span className="long">Znajdź usługę w pobliżu</span><span className="short">Usługi w pobliżu</span></span>
            <svg className="portal-chev" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      <section className="portal-specialists" aria-labelledby="znajdz-specjaliste">
        <h2 id="znajdz-specjaliste" className="portal-h2">
          Znajdź specjalistę
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e8801f" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M5 4l4 6M13 2l1.6 7M20 5l-5 4" /></svg>
        </h2>
        <ul className="svc-grid">
          {homeCats.map((c) => (
            <li key={c.slug}>
              <Link href={categoryHref(c)} className="svc-tile">
                <img src={`/ikony/uslugi/${c.icon}.png`} alt="" loading="eager" />
                <span>{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/uslugi" className="portal-wide-btn">
          Wszystkie usługi
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
        </Link>
        <Link href="/konto/zamowienia" className="reorder-strip">
          <svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="#e8801f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 22l24-10 24 10v26L32 58 8 48z" /><path d="M8 22l24 10 24-10M32 32v26" /><g fill="#e8801f" stroke="none"><circle cx="42" cy="40" r="2" /><circle cx="46" cy="37" r="2" /><circle cx="50" cy="40" r="2" /><ellipse cx="46" cy="44" rx="3.4" ry="2.6" /></g></svg>
          <span className="reorder-sep" aria-hidden="true" />
          <span className="reorder-text">Zamów ponownie</span>
          <svg className="portal-chev" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e8801f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </Link>
      </section>
    </>
  );
}
