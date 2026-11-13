import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';
import {
  PER_PAGE, WEIGHTS, parseBrowse, rpcFilters, flatParams, browseHref, toggleHref, productsCount, categoryCounts,
} from '@/lib/browse';
import { price } from '@/lib/shop';
import ProductCard from './ProductCard';
import FilterPanel from './FilterPanel';
import SortSelect from './SortSelect';
import RequestForm from './RequestForm';

function Pagination({ path, params, page, pages }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const href = (n) => browseHref(path, params, { strona: n });
  return (
    <nav className="pagination" aria-label="Strony">
      {page > 1 ? <Link href={href(page - 1)} rel="prev">‹ Poprzednia</Link> : <span className="off">‹ Poprzednia</span>}
      <span className="pages">
        {nums.map((n, i) => (
          <span key={n}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="gap">…</span>}
            {n === page ? <strong aria-current="page">{n}</strong> : <Link href={href(n)}>{n}</Link>}
          </span>
        ))}
      </span>
      {page < pages ? <Link href={href(page + 1)} rel="next">Następna ›</Link> : <span className="off">Następna ›</span>}
    </nav>
  );
}

// Lista produktów z filtrami, sortowaniem i stronicowaniem.
// path: adres strony (/, /szukaj, /kategoria/psy-karma); categorySlug: kategoria strony (z podkategoriami)
// categories: widoczne kategorie (do linków i nazw)
export default async function Listing({ path, searchParams, categorySlug = null, categories = [] }) {
  const state = parseBrowse(searchParams);
  const params = flatParams(searchParams);
  const supabase = await createClient();
  const slug = categorySlug || state.kategoria;

  const { data, error } = await supabase.rpc('search_products', {
    p_q: state.q,
    p_category: slug,
    p_filters: rpcFilters(state.filters),
    p_sort: state.sort,
    p_page: state.page,
    p_per_page: PER_PAGE,
  });

  if (error) {
    return (
      <p className="alert">
        {needsSql(error)
          ? 'Wyszukiwarka czeka na aktualizację bazy (plik supabase/04_szukanie.sql). Zajrzyj za chwilę.'
          : 'Nie udało się wczytać produktów. Spróbuj odświeżyć stronę.'}
      </p>
    );
  }

  const { total = 0, items = [], facets = {}, did_you_mean: didYouMean, sort } = data || {};
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));

  // Kategorie w filtrach (wyszukiwarka i strona główna): dzieci wybranej kategorii albo kategorie główne
  let categoryLinks = null;
  if (!categorySlug) {
    const current = state.kategoria ? bySlug.get(state.kategoria) : null;
    const items = categoryCounts(categories, facets.categories, current?.id).map((c) => ({
      ...c, href: browseHref(path, params, { kategoria: c.slug }),
    }));
    if (current && items.length === 0) items.push({ ...current, count: total, active: true, href: browseHref(path, params, {}) });
    const parent = current?.parent_id ? byId.get(current.parent_id) : null;
    categoryLinks = {
      items,
      up: current ? { href: browseHref(path, params, { kategoria: parent?.slug || null }), label: parent ? parent.name : 'Wszystkie kategorie' } : null,
    };
  }

  // Wybrane filtry jako "pigułki" do usuwania jednym kliknięciem
  const chips = [];
  const brandName = new Map((facets.brands || []).map((b) => [b.slug, b.name]));
  for (const b of state.filters.marka) chips.push([brandName.get(b) || b, toggleHref(path, params, 'marka', b)]);
  for (const [code, values] of Object.entries(state.filters.attr)) {
    const attr = (facets.attributes || []).find((a) => a.code === code);
    for (const v of values) {
      const label = attr?.values.find((x) => x.slug === v)?.value || v;
      chips.push([attr ? `${attr.name}: ${label}` : label, toggleHref(path, params, code, v)]);
    }
  }
  for (const w of state.filters.waga) chips.push([WEIGHTS.find(([k]) => k === w)?.[1] || w, toggleHref(path, params, 'waga', w)]);
  if (state.filters.cena_od != null || state.filters.cena_do != null) {
    const label = [state.filters.cena_od != null && `od ${price(state.filters.cena_od)}`, state.filters.cena_do != null && `do ${price(state.filters.cena_do)}`].filter(Boolean).join(' ');
    chips.push([`Cena ${label}`, browseHref(path, params, { cena_od: null, cena_do: null })]);
  }
  if (state.filters.dostepne) chips.push(['Tylko dostępne', browseHref(path, params, { dostepne: null })]);
  if (state.filters.promocje) chips.push(['Promocje', browseHref(path, params, { promocje: null })]);
  const clearAll = browseHref(path, params, Object.fromEntries(
    ['marka', 'waga', 'cena_od', 'cena_do', 'dostepne', 'promocje', ...Object.keys(state.filters.attr)].map((k) => [k, null])
  ));

  const sortEl = <SortSelect path={path} params={params} sort={sort} hasQuery={Boolean(state.q)} />;

  return (
    <div className="browse">
      <FilterPanel
        path={path}
        params={params}
        state={state}
        facets={facets}
        categoryLinks={categoryLinks}
        total={total}
        sortSlot={<div className="mobile-only">{sortEl}</div>}
      />

      <section className="results">
        <div className="results-head">
          <span className="muted">{productsCount(total)}</span>
          <div className="desktop-only">{sortEl}</div>
        </div>

        {chips.length > 0 && (
          <div className="active-filters">
            {chips.map(([label, href]) => (
              <Link key={href + label} href={href} scroll={false} className="chip chip-x">{label} <span aria-label="usuń">✕</span></Link>
            ))}
            {chips.length > 1 && <Link href={clearAll} scroll={false} className="link-btn">Wyczyść wszystko</Link>}
          </div>
        )}

        {total === 0 ? (
          <div className="empty">
            {state.q ? <h2>Nie znaleźliśmy „{state.q}”</h2> : <h2>Brak produktów</h2>}
            {didYouMean && (
              <p>Może chodziło o: <Link href={browseHref('/szukaj', {}, { q: didYouMean })} className="did-you-mean">{didYouMean}</Link>?</p>
            )}
            {state.active > 0 && (
              <p>Spróbuj usunąć część filtrów: <Link href={clearAll}>pokaż bez filtrów</Link>.</p>
            )}
            {(state.q || slug) && (
              <div className="request-box">
                <h3>Nie mamy? Napisz, sprowadzimy</h3>
                <p className="muted">Współpracujemy z hurtowniami, które mają tysiące produktów. Sprawdzimy, czy możemy go dla Ciebie zamówić.</p>
                <RequestForm query={state.q} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid">
              {items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
            <Pagination path={path} params={params} page={state.page} pages={pages} />
            {state.page > pages && <p className="muted">Ta strona jest pusta. <Link href={browseHref(path, params, {})}>Wróć na pierwszą</Link>.</p>}
            {state.q && (
              <details className="request-more">
                <summary>Nie widzisz tego, czego szukasz? Napisz, sprowadzimy</summary>
                <RequestForm query={state.q} />
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
