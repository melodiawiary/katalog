'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WEIGHTS, browseHref } from '@/lib/browse';

const FIXED_KEYS = ['marka', 'waga', 'cena_od', 'cena_do', 'dostepne', 'promocje'];
const DESKTOP = '(min-width: 900px)';

function Check({ name, value, checked, label, count, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} onChange={onChange} />
      <span>{label}</span>
      {count != null && <span className="count">{count}</span>}
    </label>
  );
}

// Lista z "Pokaż więcej" przy długich listach (np. marki)
function Many({ items, limit = 8, render }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <>
      {shown.map(render)}
      {items.length > limit && (
        <button type="button" className="link-btn" onClick={() => setAll(!all)}>
          {all ? 'Pokaż mniej' : `Pokaż wszystkie (${items.length})`}
        </button>
      )}
    </>
  );
}

// Filtry: na telefonie wysuwany panel z przyciskiem "Pokaż wyniki",
// na komputerze kolumna z lewej, zmiany od razu odświeżają listę.
// Bez JavaScriptu działa jako zwykły formularz GET.
export default function FilterPanel({ path, params, state, facets, categoryLinks, total, sortSlot }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [open, setOpen] = useState(false);
  const f = state.filters;
  const attrCodes = new Set([...(facets.attributes || []).map((a) => a.code), ...Object.keys(f.attr)]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    return () => document.body.classList.remove('no-scroll');
  }, [open]);

  function apply(e) {
    e?.preventDefault();
    const form = formRef.current;
    const data = new FormData(form);
    const next = { ...params };
    for (const key of [...FIXED_KEYS, ...attrCodes]) delete next[key];
    const changes = {};
    for (const [key, value] of data.entries()) {
      const v = String(value).trim();
      if (!v || ['q', 'sort', 'kategoria'].includes(key)) continue;
      changes[key] = changes[key] ? `${changes[key]},${v}` : v;
    }
    setOpen(false);
    router.push(browseHref(path, next, changes), { scroll: false });
  }

  // na komputerze zaznaczenie od razu zmienia wyniki
  function autoApply() {
    if (window.matchMedia(DESKTOP).matches) apply();
  }

  const brands = facets.brands || [];
  const weights = WEIGHTS.filter(([k]) => facets.weights?.[k] || f.waga.includes(k));
  const clearHref = browseHref(path, params, Object.fromEntries([...FIXED_KEYS, ...attrCodes].map((k) => [k, null])));

  return (
    <div className="filters-wrap">
      <div className="filters-bar">
        <button type="button" className="btn btn-light btn-small" onClick={() => setOpen(true)}>
          Filtry{state.active > 0 ? ` (${state.active})` : ''}
        </button>
        {sortSlot}
      </div>

      {open && <div className="drawer-shade" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`drawer${open ? ' open' : ''}`} aria-label="Filtry">
        <div className="drawer-head">
          <strong>Filtry</strong>
          <button type="button" className="link-btn" onClick={() => setOpen(false)} aria-label="Zamknij">✕</button>
        </div>

        <form ref={formRef} key={JSON.stringify(params)} action={path} method="get" onSubmit={apply} className="drawer-body">
          {state.q && <input type="hidden" name="q" value={state.q} />}
          {state.sort && <input type="hidden" name="sort" value={state.sort} />}
          {params.kategoria && <input type="hidden" name="kategoria" value={params.kategoria} />}

          {categoryLinks?.items?.length > 0 && (
            <section className="facet">
              <h3>Kategoria</h3>
              {categoryLinks.up && <Link href={categoryLinks.up.href} className="facet-link muted">‹ {categoryLinks.up.label}</Link>}
              {categoryLinks.items.map((c) => (
                <Link key={c.slug} href={c.href} className={`facet-link${c.active ? ' on' : ''}`} onClick={() => setOpen(false)}>
                  <span>{c.emoji ? `${c.emoji} ` : ''}{c.name}</span>
                  <span className="count">{c.count}</span>
                </Link>
              ))}
            </section>
          )}

          <section className="facet">
            <h3>Dostępność</h3>
            <Check name="dostepne" value="1" checked={f.dostepne} label="Tylko dostępne" count={facets.available} onChange={autoApply} />
            {(facets.promo > 0 || f.promocje) && (
              <Check name="promocje" value="1" checked={f.promocje} label="Promocje" count={facets.promo} onChange={autoApply} />
            )}
          </section>

          <section className="facet">
            <h3>Cena (zł)</h3>
            <div className="price-range">
              <input name="cena_od" inputMode="decimal" placeholder={facets.price_min != null ? `od ${facets.price_min}` : 'od'}
                defaultValue={f.cena_od ?? ''} aria-label="Cena od" />
              <span>-</span>
              <input name="cena_do" inputMode="decimal" placeholder={facets.price_max != null ? `do ${facets.price_max}` : 'do'}
                defaultValue={f.cena_do ?? ''} aria-label="Cena do" />
              <button className="btn btn-small btn-light desktop-only">OK</button>
            </div>
          </section>

          {brands.length > 0 && (
            <section className="facet">
              <h3>Marka</h3>
              <Many
                items={brands}
                render={(b) => (
                  <Check key={b.slug} name="marka" value={b.slug} checked={f.marka.includes(b.slug)}
                    label={b.name} count={b.count} onChange={autoApply} />
                )}
              />
            </section>
          )}

          {(facets.attributes || []).map((a) => (
            <section className="facet" key={a.code}>
              <h3>{a.name}</h3>
              <Many
                items={a.values}
                render={(v) => (
                  <Check key={v.slug} name={a.code} value={v.slug} checked={(f.attr[a.code] || []).includes(v.slug)}
                    label={v.value} count={v.count} onChange={autoApply} />
                )}
              />
            </section>
          ))}

          {weights.length > 0 && (
            <section className="facet">
              <h3>Waga opakowania</h3>
              {weights.map(([k, label]) => (
                <Check key={k} name="waga" value={k} checked={f.waga.includes(k)} label={label}
                  count={facets.weights?.[k] || 0} onChange={autoApply} />
              ))}
            </section>
          )}

          <div className="drawer-foot">
            {state.active > 0 && <Link href={clearHref} className="link-btn" onClick={() => setOpen(false)}>Wyczyść</Link>}
            <button className="btn mobile-only">Pokaż wyniki</button>
          </div>
        </form>
      </aside>
      <span className="sr-only" aria-live="polite">{total} wyników</span>
    </div>
  );
}
