// Import cennika z hurtowni: czytanie pliku, dopasowanie kolumn, reguła ceny.
// Zwykłe funkcje (bez 'use server'), używane w przeglądarce i na serwerze.
import { slugify } from './shop';
import { validEan } from './admin';

// ---------- POLA, KTÓRE MOŻNA WCZYTAĆ ----------
// aliases: nagłówki kolumn spotykane w plikach hurtowni (porównywane bez polskich znaków i wielkości liter)
export const FIELDS = [
  { key: 'ean', label: 'EAN (kod kreskowy)', aliases: ['ean', 'ean13', 'kod ean', 'kod kreskowy', 'barcode', 'gtin'] },
  { key: 'sku', label: 'Kod produktu w hurtowni', aliases: ['kod hurtowni', 'kod', 'kod produktu', 'indeks', 'index', 'symbol', 'sku', 'kod towaru', 'nr katalogowy', 'id produktu', 'id'] },
  { key: 'name', label: 'Nazwa', aliases: ['nazwa', 'nazwa produktu', 'nazwa towaru', 'name', 'produkt', 'towar'] },
  { key: 'brand', label: 'Marka / producent', aliases: ['marka', 'producent', 'brand', 'manufacturer'] },
  { key: 'category', label: 'Kategoria w hurtowni', aliases: ['kategoria', 'grupa towarowa', 'category', 'kategorie', 'dzial'] },
  { key: 'purchase', label: 'Cena zakupu netto', aliases: ['cena zakupu netto', 'cena netto', 'cena zakupu', 'netto', 'cena hurtowa', 'cena hurtowa netto', 'cena'] },
  { key: 'suggested', label: 'Cena sugerowana brutto (detaliczna)', aliases: ['cena sugerowana brutto', 'cena sugerowana', 'cena detaliczna', 'srp', 'cena katalogowa brutto', 'cena brutto detal'] },
  { key: 'vat', label: 'Stawka VAT', aliases: ['vat', 'stawka vat', 'vat %', 'podatek'] },
  { key: 'stock', label: 'Stan w hurtowni', aliases: ['stan', 'ilosc', 'stan magazynowy', 'dostepnosc', 'magazyn', 'stock', 'qty'] },
  { key: 'quantity', label: 'Waga / pojemność (np. 2 kg, 400 g, 1,5 l)', aliases: ['waga / pojemnosc', 'waga', 'pojemnosc', 'gramatura', 'opakowanie', 'waga netto'] },
  { key: 'variant', label: 'Nazwa wariantu (np. 2 kg, M)', aliases: ['wariant', 'nazwa wariantu', 'rozmiar'] },
  { key: 'group', label: 'Kod grupy wariantów', aliases: ['grupa wariantow', 'kod grupy', 'grupa', 'produkt nadrzedny', 'parent'] },
  { key: 'description', label: 'Opis', aliases: ['opis', 'description', 'opis produktu'] },
  { key: 'images', label: 'Zdjęcia (linki)', aliases: ['zdjecia', 'zdjecie', 'zdjecia linki', 'foto', 'image', 'images', 'url zdjecia', 'link do zdjecia'] },
];

export const TEMPLATE_HEADERS = [
  'EAN', 'Kod hurtowni', 'Nazwa', 'Marka', 'Kategoria', 'Cena zakupu netto', 'Cena sugerowana brutto',
  'VAT', 'Stan', 'Waga / pojemność', 'Wariant', 'Grupa wariantów', 'Opis', 'Zdjęcia',
];

export const TEMPLATE_ROWS = [
  ['5901234123457', 'BR-AD-2', 'Brit Care Adult Jagnięcina z ryżem', 'Brit', 'Karma sucha pies', '38,50', '', '8', '12', '2 kg', '2 kg', 'BR-AD', 'Karma dla dorosłych psów...', 'https://przyklad.pl/brit-2kg.jpg'],
  ['5901234123464', 'BR-AD-7', 'Brit Care Adult Jagnięcina z ryżem', 'Brit', 'Karma sucha pies', '112,00', '', '8', '5', '7 kg', '7 kg', 'BR-AD', '', ''],
  ['5900000000008', 'ZB-01', 'Piłka gumowa z dzwonkiem', 'Kong', 'Zabawki pies', '9,80', '24,99', '23', '30', '', '', '', '', ''],
];

export const DEFAULT_RULE = {
  markup: 35,          // narzut w % na cenę zakupu z VAT
  rounding: '99',      // '99' | '90' | '00' | 'none'
  use_suggested: false, // użyj ceny sugerowanej z pliku, jeśli jest
  vat_mode: 'auto',    // 'auto' (karma i przysmaki 8%, reszta 23%) | '8' | '23' - gdy brak VAT w pliku
  update_price: true,  // aktualizuj ceny produktów, które już są w sklepie
  update_stock: true,  // stan w sklepie = stan w hurtowni
  zero_missing: false, // pozycje tej hurtowni, których nie ma w pliku: stan 0
};

// ---------- CZYTANIE PLIKU ----------

// Bajty -> tekst: UTF-8, a gdy się nie da, Windows-1250 (polskie programy księgowe i hurtownie)
export function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1250').decode(bytes), encoding: 'Windows-1250' };
  }
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || '';
  let best = ';';
  let bestCount = -1;
  for (const d of [';', '\t', ',', '|']) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count += 1;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

// CSV (RFC 4180): cudzysłowy, nowe linie w polach, separator ; , tab lub |
export function parseCsv(text) {
  const d = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === d) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Tablica wierszy (pierwszy = nagłówki) -> { headers, rows }; puste wiersze i kolumny bez nazwy pomijane
export function toTable(matrix) {
  const clean = matrix
    .map((r) => r.map((c) => (c == null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())))
    .filter((r) => r.some((c) => c !== ''));
  if (clean.length === 0) return { headers: [], rows: [] };
  const headers = clean[0].map((h, i) => h || `Kolumna ${i + 1}`);
  const seen = {};
  const unique = headers.map((h) => {
    seen[h] = (seen[h] || 0) + 1;
    return seen[h] > 1 ? `${h} (${seen[h]})` : h;
  });
  return { headers: unique, rows: clean.slice(1).map((r) => unique.map((_, i) => r[i] ?? '')) };
}

// ---------- DOPASOWANIE KOLUMN ----------

export function normalize(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9%]+/g, ' ').trim();
}

// Zgadywanie: { pole: nagłówek }. Zapamiętane dopasowanie hurtowni ma pierwszeństwo.
export function guessColumns(headers, saved = {}) {
  const result = {};
  const used = new Set();
  for (const f of FIELDS) {
    if (saved[f.key] !== undefined && (saved[f.key] === '' || headers.includes(saved[f.key]))) {
      result[f.key] = saved[f.key];
      if (saved[f.key]) used.add(saved[f.key]);
    }
  }
  const norm = headers.map(normalize);
  for (const f of FIELDS) {
    if (result[f.key] !== undefined) continue;
    let found = '';
    for (const alias of f.aliases.map(normalize)) {
      const i = norm.findIndex((h, idx) => h === alias && !used.has(headers[idx]));
      if (i !== -1) { found = headers[i]; break; }
    }
    result[f.key] = found;
    if (found) used.add(found);
  }
  return result;
}

// ---------- LICZBY ----------

// "1 234,56 zł" -> 1234.56; "12.5" -> 12.5; puste -> null; śmieci -> NaN
export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let s = String(value ?? '').replace(/\s| |zł|pln/gi, '');
  if (s === '') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else s = s.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// "12", "12,000", ">10", "brak" -> liczba sztuk; nieczytelne -> null
export function parseStock(value) {
  const s = normalize(value);
  if (s === '') return null;
  if (/^(brak|nie|niedostepny|niedostepne)$/.test(s)) return 0;
  const m = /\d+(?:[.,]\d+)?/.exec(String(value).replace(/\s/g, ''));
  if (!m) return null;
  return Math.max(0, Math.floor(parseMoney(m[0])));
}

// "8", "8%", "0.08", "VAT 8" -> 8; "zw" -> 0
export function parseVat(value) {
  const s = normalize(value);
  if (s === '') return null;
  if (/^zw|^np|^oo/.test(s)) return 0;
  const n = parseMoney(s.replace(/[^\d,.]/g, ''));
  if (n === null || Number.isNaN(n)) return NaN;
  const rate = n < 1 ? Math.round(n * 100) : Math.round(n);
  return [0, 5, 8, 23].includes(rate) ? rate : NaN;
}

// "2 kg" -> {2, kg}; "400 g" -> {0.4, kg}; "12 x 85 g" -> {1.02, kg}; "1,5 l" -> {1.5, l}; "500 ml" -> {0.5, l}
export function parseQuantity(value) {
  const s = String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const m = /(?:(\d+)\s*(?:x|×|\*)\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/.exec(s);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  let amount = Number(m[2].replace(',', '.')) * count;
  let unit = m[3];
  if (unit === 'g') { amount /= 1000; unit = 'kg'; }
  if (unit === 'ml') { amount /= 1000; unit = 'l'; }
  if (!(amount > 0)) return null;
  return { net_quantity: Math.round(amount * 1000) / 1000, unit };
}

// EAN z pliku: spacje precz; liczba z Excela w notacji naukowej = błąd; zgubione zero z przodu dokładamy
export function cleanEan(value) {
  let s = String(value ?? '').replace(/[\s-]/g, '');
  if (s === '') return { ean: null };
  if (/^\d+(\.\d+)?e\+\d+$/i.test(s)) {
    return { ean: null, error: 'EAN zapisany w Excelu jako liczba (np. 5,9E+12) - ustaw w Excelu format kolumny „Tekst” i wyeksportuj ponownie' };
  }
  s = s.replace(/\.0+$/, '');
  if (!/^\d{8,14}$/.test(s)) return { ean: null, error: `Nieprawidłowy EAN „${value}” (8-14 cyfr)` };
  if (!validEan(s) && s.length === 12 && validEan(`0${s}`)) s = `0${s}`;
  return { ean: s, warning: validEan(s) ? undefined : `EAN ${s} ma złą cyfrę kontrolną` };
}

export function splitImages(value) {
  return String(value ?? '').split(/[\s,;|]+/).filter((u) => /^https?:\/\/\S+$/i.test(u)).slice(0, 8);
}

// ---------- CENA ----------

export function roundPrice(x, rounding) {
  if (!(x > 0)) return x;
  const cents = Math.round(x * 100) / 100;
  if (rounding === 'none') return cents;
  if (rounding === '00') return Math.ceil(cents - 0.001);
  const ending = rounding === '90' ? 0.9 : 0.99;
  let r = Math.floor(cents) + ending;
  if (r + 0.0001 < cents) r += 1;
  return Math.round(r * 100) / 100;
}

// Cena sprzedaży brutto = zakup netto + VAT + narzut, zaokrąglona (dla firmy zwolnionej i czynnej wychodzi tak samo:
// u zwolnionej VAT z faktury zakupu jest kosztem, u czynnej VAT dolicza się do ceny sprzedaży)
export function sellingPrice({ purchase, suggested, vat }, rule) {
  if (rule.use_suggested && suggested > 0) return { price: Math.round(suggested * 100) / 100, source: 'sugerowana' };
  if (purchase > 0) {
    const raw = purchase * (1 + (vat ?? 23) / 100) * (1 + (Number(rule.markup) || 0) / 100);
    return { price: roundPrice(raw, rule.rounding), source: 'narzut' };
  }
  if (suggested > 0) return { price: Math.round(suggested * 100) / 100, source: 'sugerowana' };
  return { price: null, source: null };
}

// Karma, przysmaki, pokarm = 8%, reszta 23% (na podstawie nazw kategorii w drzewie)
export function vatForCategory(categoryId, categories = []) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let c = byId.get(Number(categoryId));
  let guard = 0;
  while (c && guard < 10) {
    if (/karm|przysmak|pokarm/.test(normalize(`${c.name} ${c.slug}`))) return 8;
    c = c.parent_id ? byId.get(c.parent_id) : null;
    guard += 1;
  }
  return 23;
}

// Kategorie z hurtowni -> nasze: zapamiętane albo zgadnięte po nazwie
export function guessCategory(value, categories = [], saved = {}) {
  if (saved[value] !== undefined) return saved[value];
  const n = normalize(value);
  if (!n) return '';
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path = (c) => {
    const parts = [];
    let x = c;
    while (x && parts.length < 10) { parts.unshift(x.name); x = x.parent_id ? byId.get(x.parent_id) : null; }
    return normalize(parts.join(' '));
  };
  const exact = categories.find((c) => path(c) === n || normalize(c.name) === n);
  return exact ? String(exact.id) : '';
}

// ---------- WIERSZE DO BAZY ----------

const cell = (row, headers, header) => (header ? row[headers.indexOf(header)] ?? '' : '');

// Plik + ustawienia -> wiersze gotowe dla funkcji import_batch (+ błędy i ostrzeżenia na wiersz)
export function buildRows({ headers, rows }, columns, categoryMap, defaultCategory, rule, categories) {
  const out = [];
  const eans = new Map();
  const skus = new Map();
  rows.forEach((r, idx) => {
    const i = idx + 2; // numer wiersza jak w Excelu (1 = nagłówki)
    const get = (key) => cell(r, headers, columns[key]);
    const errors = [];
    const warnings = [];

    const { ean, error: eanErr, warning: eanWarn } = cleanEan(get('ean'));
    if (eanErr) errors.push(eanErr);
    if (eanWarn) warnings.push(eanWarn);
    const sku = String(get('sku')).trim().slice(0, 60);
    if (!ean && !sku && !eanErr) errors.push('Brak EAN i kodu hurtowni - nie da się rozpoznać produktu');
    if (ean) {
      if (eans.has(ean)) errors.push(`Ten sam EAN co w wierszu ${eans.get(ean)}`);
      else eans.set(ean, i);
    }
    if (sku) {
      if (skus.has(sku)) errors.push(`Ten sam kod hurtowni co w wierszu ${skus.get(sku)}`);
      else skus.set(sku, i);
    }

    const purchase = parseMoney(get('purchase'));
    if (Number.isNaN(purchase)) errors.push(`Nieczytelna cena zakupu „${get('purchase')}”`);
    const suggested = parseMoney(get('suggested'));
    if (Number.isNaN(suggested)) warnings.push(`Nieczytelna cena sugerowana „${get('suggested')}” - pominięta`);

    const supplierCategory = String(get('category')).trim();
    const categoryId = (columns.category && categoryMap[supplierCategory]) || defaultCategory || '';

    let vat = parseVat(get('vat'));
    if (Number.isNaN(vat)) { warnings.push(`Nieznana stawka VAT „${get('vat')}” - przyjęto domyślną`); vat = null; }
    if (vat === null) vat = rule.vat_mode === 'auto' ? vatForCategory(categoryId, categories) : Number(rule.vat_mode);

    const stock = parseStock(get('stock'));
    const qty = parseQuantity(get('quantity')) || parseQuantity(get('variant')) || parseQuantity(get('name'));
    const name = String(get('name')).trim().slice(0, 200);
    const brand = String(get('brand')).trim().slice(0, 100);
    const { price, source } = sellingPrice({
      purchase: Number.isNaN(purchase) ? null : purchase,
      suggested: Number.isNaN(suggested) ? null : suggested,
      vat,
    }, rule);
    if (price && purchase > 0 && price < purchase * (1 + vat / 100)) {
      warnings.push(`Cena ${price.toFixed(2)} zł jest niższa niż zakup z VAT`);
    }
    const group = String(get('group')).trim().slice(0, 100);
    const variantName = (String(get('variant')).trim() || (group ? String(get('quantity')).trim() : '')).slice(0, 60);

    out.push({
      i,
      errors,
      warnings,
      supplierCategory,
      images: splitImages(get('images')),
      priceSource: source,
      data: {
        i,
        ean,
        sku,
        name,
        slug: slugify(name) || `produkt-${i}`,
        brand,
        brand_slug: slugify(brand),
        category_id: categoryId ? Number(categoryId) : null,
        vat,
        description: String(get('description')).trim().slice(0, 20000),
        price,
        purchase: Number.isNaN(purchase) ? null : purchase,
        stock,
        net_quantity: qty?.net_quantity ?? null,
        unit: qty?.unit ?? 'szt',
        variant_name: variantName,
        grp: group,
      },
    });
  });
  return out;
}

// Partie do wysłania: wiersze jednej grupy wariantów zawsze w tej samej partii
export function makeBatches(rows, size) {
  const groups = new Map();
  const order = [];
  for (const r of rows) {
    const key = r.data.grp ? `g:${r.data.grp}` : `r:${r.i}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(r);
  }
  const batches = [];
  let current = [];
  for (const key of order) {
    const g = groups.get(key);
    if (current.length && current.length + g.length > size) { batches.push(current); current = []; }
    current.push(...g);
  }
  if (current.length) batches.push(current);
  return batches;
}
