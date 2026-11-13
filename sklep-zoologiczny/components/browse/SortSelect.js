'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { SORTS, browseHref } from '@/lib/browse';

// Sortowanie: zmiana od razu przeładowuje listę (bez JavaScriptu: przycisk "Sortuj")
export default function SortSelect({ path, params, sort, hasQuery }) {
  const router = useRouter();
  const id = useId();
  const options = SORTS.filter(([k]) => hasQuery || k !== 'trafnosc');

  return (
    <form action={path} method="get" className="sort-form">
      {Object.entries(params).filter(([k]) => k !== 'sort' && k !== 'strona').map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="sr-only" htmlFor={id}>Sortuj</label>
      <select
        id={id}
        name="sort"
        value={sort}
        onChange={(e) => router.push(browseHref(path, params, { sort: e.target.value }), { scroll: false })}
      >
        {options.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <noscript><button className="btn btn-small">Sortuj</button></noscript>
    </form>
  );
}
