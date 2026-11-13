'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { price } from '@/lib/shop';

// Wyszukiwarka w nagłówku z podpowiedziami (funkcja search_suggest w 04_szukanie.sql).
// Strzałki góra / dół wybierają podpowiedź, Enter otwiera, Esc zamyka.
export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = pathname === '/szukaj' ? searchParams.get('q') || '' : '';
  const [q, setQ] = useState(urlQ);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const reqId = useRef(0);
  const supabase = useRef(null);

  // po przejściu na inną stronę pole pokazuje aktualne zapytanie
  useEffect(() => {
    setQ(urlQ);
    setOpen(false);
  }, [urlQ, pathname]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      reqId.current++;
      setData(null);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      supabase.current ||= createClient();
      const { data: res, error } = await supabase.current.rpc('search_suggest', { p_q: term });
      if (id !== reqId.current) return; // przyszła starsza odpowiedź
      setData(error ? null : res);
      setActive(-1);
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onClick(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onClick);
    return () => document.removeEventListener('pointerdown', onClick);
  }, []);

  const term = q.trim();
  const searchHref = `/szukaj?q=${encodeURIComponent(term)}`;
  const options = [];
  if (data) {
    for (const c of data.categories || []) {
      options.push({ key: `c${c.slug}`, href: `/kategoria/${c.slug}`, kind: 'cat', item: c });
    }
    for (const b of data.brands || []) {
      options.push({ key: `b${b.slug}`, href: `/szukaj?marka=${encodeURIComponent(b.slug)}`, kind: 'brand', item: b });
    }
    for (const p of data.products || []) {
      options.push({ key: `p${p.id}`, href: `/produkt/${p.slug}`, kind: 'product', item: p });
    }
    if (data.did_you_mean) {
      options.push({ key: 'dym', href: `/szukaj?q=${encodeURIComponent(data.did_you_mean)}`, kind: 'dym', item: data.did_you_mean });
    }
  }
  const showList = open && term.length >= 2 && data;

  function go(href) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % (options.length + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? options.length : a - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      go(active < options.length ? options[active].href : searchHref);
    }
  }

  return (
    <div className="searchbox" ref={boxRef}>
      <form
        action="/szukaj"
        method="get"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (term) go(searchHref);
        }}
      >
        <input
          type="search"
          name="q"
          value={q}
          placeholder="Szukaj: karma, marka, smak…"
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Szukaj produktów"
          aria-expanded={Boolean(showList)}
          aria-controls="podpowiedzi"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          maxLength={100}
        />
        <button className="btn btn-small" aria-label="Szukaj">Szukaj</button>
      </form>

      {showList && (
        <div className="suggest" id="podpowiedzi" role="listbox">
          {options.map((o, i) => (
            <Link
              key={o.key}
              href={o.href}
              role="option"
              aria-selected={i === active}
              className={`suggest-row suggest-${o.kind}${i === active ? ' on' : ''}`}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setActive(i)}
            >
              {o.kind === 'cat' && (
                <>
                  <span className="suggest-icon">{o.item.emoji}</span>
                  <span>{o.item.name}{o.item.parent && <span className="muted"> · {o.item.parent}</span>}</span>
                  <span className="muted small">kategoria</span>
                </>
              )}
              {o.kind === 'brand' && (
                <>
                  <span className="suggest-icon">🏷️</span>
                  <span>{o.item.name}</span>
                  <span className="muted small">marka</span>
                </>
              )}
              {o.kind === 'product' && (
                <>
                  {o.item.image_url
                    ? <img src={o.item.image_url} alt="" className="suggest-img" loading="lazy" />
                    : <span className="suggest-icon">{o.item.emoji || '🐾'}</span>}
                  <span className="suggest-name">{o.item.name}</span>
                  <strong className="price">{o.item.variants > 1 ? 'od ' : ''}{price(o.item.price)}</strong>
                </>
              )}
              {o.kind === 'dym' && (
                <span>Może chodziło o: <strong>{o.item}</strong>?</span>
              )}
            </Link>
          ))}
          {options.length === 0 && <p className="suggest-empty muted">Brak podpowiedzi. Naciśnij Enter, żeby szukać.</p>}
          <Link
            href={searchHref}
            className={`suggest-row suggest-all${active === options.length ? ' on' : ''}`}
            onClick={() => setOpen(false)}
          >
            {data.total > 0 ? `Pokaż wszystkie wyniki (${data.total})` : `Szukaj „${term}”`} ›
          </Link>
        </div>
      )}
    </div>
  );
}
