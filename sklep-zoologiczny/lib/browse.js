// Przeglądanie i wyszukiwanie: filtry w adresie strony (da się wysłać link), sortowanie, stronicowanie.
// Adres: /kategoria/psy-karma?marka=brit,josera&wiek=senior&waga=1-3-kg&cena_od=20&cena_do=100&dostepne=1&sort=cena-rosnaco&strona=2
// Cechy (wiek, wielkosc, dieta, bialko, gatunek) mają w adresie swój kod z tabeli attributes.
// Całe liczenie robi baza: funkcja search_products w supabase/04_szukanie.sql.

export const PER_PAGE = 24;

export const SORTS = [
  ['trafnosc', 'Najtrafniejsze'],
  ['popularne', 'Najpopularniejsze'],
  ['nowosci', 'Nowości'],
  ['cena-rosnaco', 'Cena: od najniższej'],
  ['cena-malejaco', 'Cena: od najwyższej'],
  ['nazwa', 'Nazwa: A-Z'],
];

export const WEIGHTS = [
  ['do-1-kg', 'do 1 kg'],
  ['1-3-kg', '1-3 kg'],
  ['3-7-kg', '3-7 kg'],
  ['7-12-kg', '7-12 kg'],
  ['ponad-12-kg', 'ponad 12 kg'],
];

// Parametry, które nie są cechami produktu
const RESERVED = new Set(['q', 'sort', 'strona', 'marka', 'waga', 'cena_od', 'cena_do', 'dostepne', 'promocje', 'kategoria']);
const SLUG = /^[a-z0-9-]{1,60}$/;

// "brit,josera" albo ["brit", "josera"] -> ["brit", "josera"]
export function list(value) {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const out = [];
  for (const part of raw.flatMap((v) => String(v).split(','))) {
    const s = part.trim().toLowerCase();
    if (SLUG.test(s) && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 20);
}

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

function price(value) {
  const s = String(one(value) ?? '').trim().replace(',', '.');
  return /^\d{1,6}(\.\d{1,2})?$/.test(s) ? Number(s) : null;
}

// searchParams strony -> stan filtrów
export function parseBrowse(sp = {}) {
  const q = String(one(sp.q) ?? '').trim().slice(0, 100);
  const attr = {};
  for (const [key, value] of Object.entries(sp)) {
    if (RESERVED.has(key) || !/^[a-z0-9_]{1,30}$/.test(key)) continue;
    const values = list(value);
    if (values.length) attr[key] = values;
  }
  const filters = {
    marka: list(sp.marka),
    waga: list(sp.waga).filter((w) => WEIGHTS.some(([k]) => k === w)),
    cena_od: price(sp.cena_od),
    cena_do: price(sp.cena_do),
    dostepne: one(sp.dostepne) === '1',
    promocje: one(sp.promocje) === '1',
    attr,
  };
  const sortParam = String(one(sp.sort) ?? '');
  const sort = SORTS.some(([k]) => k === sortParam) ? sortParam : null;
  const page = Math.min(Math.max(parseInt(one(sp.strona), 10) || 1, 1), 1000);
  const kategoria = list(sp.kategoria)[0] || null;

  const active =
    filters.marka.length + filters.waga.length + Object.values(attr).reduce((n, v) => n + v.length, 0)
    + (filters.cena_od != null || filters.cena_do != null ? 1 : 0) + (filters.dostepne ? 1 : 0) + (filters.promocje ? 1 : 0);

  return { q, sort, page, kategoria, filters, active };
}

// Filtry w formacie funkcji search_products
export function rpcFilters(filters) {
  const f = { attr: filters.attr };
  if (filters.marka.length) f.marka = filters.marka;
  if (filters.waga.length) f.waga = filters.waga;
  if (filters.cena_od != null) f.cena_od = filters.cena_od;
  if (filters.cena_do != null) f.cena_do = filters.cena_do;
  if (filters.dostepne) f.dostepne = true;
  if (filters.promocje) f.promocje = true;
  return f;
}

// searchParams -> zwykły obiekt { klucz: "a,b" } (bez pustych)
export function flatParams(sp = {}) {
  const out = {};
  for (const [key, value] of Object.entries(sp)) {
    const v = Array.isArray(value) ? value.join(',') : String(value ?? '');
    if (v !== '') out[key] = v;
  }
  return out;
}

// Link z innymi filtrami: changes = { marka: 'brit,josera', strona: null (usuń) }
// Każda zmiana poza samą stroną wraca na stronę 1.
export function browseHref(path, params, changes = {}) {
  const next = { ...params };
  if (!('strona' in changes)) delete next.strona;
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === '' || value === false || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = Array.isArray(value) ? value.join(',') : String(value);
  }
  if (next.strona === '1') delete next.strona;
  const qs = new URLSearchParams(next).toString().replace(/%2C/gi, ',');
  return qs ? `${path}?${qs}` : path;
}

// Dodaj / usuń jedną wartość z listy w adresie
export function toggleHref(path, params, key, value) {
  const current = list(params[key]);
  const nextValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return browseHref(path, params, { [key]: nextValues });
}

// 1 produkt, 2 produkty, 5 produktów, 22 produkty
export function plural(n, one, few, many) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n === 1) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export function productsCount(n) {
  return `${n} ${plural(n, 'produkt', 'produkty', 'produktów')}`;
}

// Liczniki kategorii z bazy (tylko kategorie z produktami) zsumowane w górę drzewa:
// children = dzieci podanej kategorii (albo kategorie główne) z liczbą produktów > 0
export function categoryCounts(categories, counts = {}, parentId = null) {
  const byParent = new Map();
  for (const c of categories) {
    const key = c.parent_id || 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }
  const total = (id) => {
    let n = Number(counts[id] || 0);
    for (const child of byParent.get(id) || []) n += total(child.id);
    return n;
  };
  return (byParent.get(parentId || 0) || [])
    .map((c) => ({ ...c, count: total(c.id) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'pl'));
}
