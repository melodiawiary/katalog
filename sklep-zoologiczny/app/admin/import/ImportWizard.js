'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { categoryTree } from '@/lib/categories';
import { price as formatPrice } from '@/lib/shop';
import {
  FIELDS, DEFAULT_RULE, decodeText, parseCsv, toTable, guessColumns, guessCategory,
  buildRows, makeBatches, sellingPrice, parseMoney, parseVat, vatForCategory,
} from '@/lib/import';
import {
  saveImportSettings, importBatch, importZeroMissing, importImages, importFinished,
} from './actions';

const STEPS = ['Plik', 'Kolumny', 'Kategorie', 'Cena', 'Podgląd', 'Zapis'];
const PREVIEW_BATCH = 300;
const APPLY_BATCH = 100;
const IMAGE_BATCH = 3;
const MAX_ROWS = 20000;
const LIST_LIMIT = 100;

const TABS = {
  new: 'Nowe',
  update: 'Zmienione',
  same: 'Bez zmian',
  error: 'Błędy',
};

function money(v) {
  return v == null ? '-' : formatPrice(v);
}

function describeChanges(c = {}) {
  const parts = [];
  if (c.price) parts.push(`cena ${money(c.price[0])} → ${money(c.price[1])}`);
  if (c.stock) parts.push(`stan ${c.stock[0]} → ${c.stock[1]}`);
  if (c.purchase) parts.push(`zakup netto ${money(c.purchase[0])} → ${money(c.purchase[1])}`);
  if (c.supplier_stock && !c.stock) parts.push(`stan w hurtowni ${c.supplier_stock[0] ?? '-'} → ${c.supplier_stock[1]}`);
  if (c.sku) parts.push(`kod hurtowni ${c.sku[0] || '-'} → ${c.sku[1]}`);
  return parts.join(' · ');
}

function Progress({ label, done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="import-progress">
      <div className="muted">{label}: {done} / {total}</div>
      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function ImportWizard({ suppliers, categories }) {
  const [step, setStep] = useState(0);
  const [supplierId, setSupplierId] = useState(suppliers[0] ? String(suppliers[0].id) : '');
  const [file, setFile] = useState(null); // { name, encoding, table }
  const [columns, setColumns] = useState({});
  const [categoryMap, setCategoryMap] = useState({});
  const [defaultCategory, setDefaultCategory] = useState('');
  const [rule, setRule] = useState(DEFAULT_RULE);
  const [rows, setRows] = useState([]); // wynik buildRows
  const [results, setResults] = useState({}); // i -> wynik z bazy (podgląd)
  const [missingCount, setMissingCount] = useState(null);
  const [tab, setTab] = useState('new');
  const [busy, setBusy] = useState(null); // { label, done, total }
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const stopRef = useRef(false);

  const supplier = suppliers.find((s) => String(s.id) === supplierId);
  const saved = supplier?.import_settings || {};
  const tree = useMemo(() => categoryTree(categories), [categories]);

  // ---------- 1. plik ----------
  async function onFile(e) {
    const f = e.target.files?.[0];
    setError('');
    if (!f) return;
    try {
      let matrix;
      let encoding = '';
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.xls')) {
        setError('Stary format .xls nie jest obsługiwany. Otwórz plik w Excelu i zapisz jako .xlsx albo CSV.');
        return;
      }
      if (lower.endsWith('.xlsx')) {
        const { readSheet } = await import('read-excel-file/browser');
        matrix = await readSheet(f);
        encoding = 'Excel';
      } else {
        const decoded = decodeText(await f.arrayBuffer());
        matrix = parseCsv(decoded.text);
        encoding = decoded.encoding;
      }
      const table = toTable(matrix);
      if (!table.rows.length) { setError('Plik nie ma wierszy z danymi (pierwszy wiersz to nagłówki kolumn).'); return; }
      if (table.rows.length > MAX_ROWS) { setError(`Plik ma ${table.rows.length} wierszy - maksymalnie ${MAX_ROWS}. Podziel go na części.`); return; }
      setFile({ name: f.name, encoding, table });
      setColumns(guessColumns(table.headers, saved.columns || {}));
      setRule({ ...DEFAULT_RULE, ...(saved.rule || {}) });
      setDefaultCategory(saved.default_category || '');
      setSummary(null);
      setStep(1);
    } catch (err) {
      setError(`Nie udało się odczytać pliku: ${err.message || err}`);
    }
  }

  // ---------- 2. kolumny ----------
  const samples = useMemo(() => {
    if (!file) return {};
    const out = {};
    file.table.headers.forEach((h, i) => {
      const v = file.table.rows.find((r) => r[i])?.[i] || '';
      out[h] = v.length > 30 ? `${v.slice(0, 30)}…` : v;
    });
    return out;
  }, [file]);

  const columnProblems = [];
  if (!columns.ean && !columns.sku) columnProblems.push('Wskaż kolumnę z EAN albo z kodem hurtowni - po nich rozpoznaję produkty.');
  if (!columns.purchase && !columns.suggested) columnProblems.push('Wskaż kolumnę z ceną zakupu albo ceną sugerowaną.');
  const noName = !columns.name;

  // ---------- 3. kategorie ----------
  const supplierCategories = useMemo(() => {
    if (!file || !columns.category) return [];
    const i = file.table.headers.indexOf(columns.category);
    const counts = new Map();
    for (const r of file.table.rows) {
      const v = (r[i] || '').trim();
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [file, columns.category]);

  function goToCategories() {
    const map = {};
    for (const [value] of supplierCategories) map[value] = guessCategory(value, categories, saved.categories || {});
    setCategoryMap(map);
    setStep(2);
  }

  // ---------- 4. cena: przykład ----------
  const example = useMemo(() => {
    if (!file) return null;
    const { headers, rows: data } = file.table;
    const col = (key, r) => (columns[key] ? r[headers.indexOf(columns[key])] : '');
    const r = data.find((x) => parseMoney(col('purchase', x)) > 0) || data[0];
    const purchase = parseMoney(col('purchase', r));
    const suggested = parseMoney(col('suggested', r));
    let vat = parseVat(col('vat', r));
    if (vat == null || Number.isNaN(vat)) {
      const cat = (columns.category && categoryMap[(col('category', r) || '').trim()]) || defaultCategory;
      vat = rule.vat_mode === 'auto' ? vatForCategory(cat, categories) : Number(rule.vat_mode);
    }
    const { price, source } = sellingPrice({ purchase: purchase > 0 ? purchase : null, suggested: suggested > 0 ? suggested : null, vat }, rule);
    return { name: col('name', r), purchase, suggested, vat, price, source };
  }, [file, columns, rule, categoryMap, defaultCategory, categories]);

  function setRuleField(key, value) {
    setRule((r) => ({ ...r, [key]: value }));
  }

  // ---------- 5. podgląd ----------
  async function runPreview() {
    setError('');
    const built = buildRows(file.table, columns, categoryMap, defaultCategory, rule, categories);
    setRows(built);
    setResults({});
    setMissingCount(null);
    setStep(4);

    const saveRes = await saveImportSettings(supplierId, {
      columns, categories: categoryMap, default_category: defaultCategory, rule,
    });
    if (saveRes.error) { setError(saveRes.error); return; }

    const valid = built.filter((r) => !r.errors.length);
    const batches = makeBatches(valid, PREVIEW_BATCH);
    const all = {};
    stopRef.current = false;
    setBusy({ label: 'Porównuję z bazą', done: 0, total: valid.length });
    let done = 0;
    for (const batch of batches) {
      if (stopRef.current) break;
      const res = await importBatch(supplierId, batch.map((r) => r.data), rule, false);
      if (res.error) { setError(res.error); setBusy(null); return; }
      for (const x of res.results) all[x.i] = x;
      done += batch.length;
      setBusy({ label: 'Porównuję z bazą', done, total: valid.length });
    }
    setResults(all);
    if (rule.zero_missing) {
      const seen = Object.values(all).map((x) => x.variant_id).filter(Boolean);
      const res = await importZeroMissing(supplierId, seen, rule.update_stock, false);
      if (res.error) setError(res.error); else setMissingCount(res.count);
    }
    setBusy(null);
    const counts = countBy(built, all);
    setTab(counts.new ? 'new' : counts.update ? 'update' : counts.error ? 'error' : 'same');
  }

  function statusOf(row, map) {
    if (row.errors.length) return 'error';
    return map[row.i]?.status || 'error';
  }

  function countBy(list, map) {
    const c = { new: 0, update: 0, same: 0, error: 0 };
    for (const r of list) c[statusOf(r, map)] += 1;
    return c;
  }

  const counts = useMemo(() => countBy(rows, results), [rows, results]);
  const newProducts = useMemo(() => {
    const groups = new Set();
    let n = 0;
    for (const r of rows) {
      if (statusOf(r, results) !== 'new') continue;
      if (results[r.i]?.as_variant || results[r.i]?.product_id) continue;
      if (r.data.grp) { if (groups.has(r.data.grp)) continue; groups.add(r.data.grp); }
      n += 1;
    }
    return n;
  }, [rows, results]);

  // ---------- 6. zapis ----------
  async function runApply() {
    const msg = `Zapisać import?\n\nNowe szkice: ${counts.new} poz.\nZmienione: ${counts.update}${rule.zero_missing && missingCount ? `\nStan 0 dla pozycji spoza pliku: ${missingCount}` : ''}`;
    if (!window.confirm(msg)) return;
    setError('');
    setStep(5);
    stopRef.current = false;
    const toSend = rows.filter((r) => !r.errors.length && ['new', 'update', 'same'].includes(results[r.i]?.status));
    const batches = makeBatches(toSend, APPLY_BATCH);
    const applied = {};
    const rowByI = new Map(rows.map((r) => [r.i, r]));
    let done = 0;
    setBusy({ label: 'Zapisuję produkty', done: 0, total: toSend.length });
    for (const batch of batches) {
      if (stopRef.current) break;
      const res = await importBatch(supplierId, batch.map((r) => r.data), rule, true);
      if (res.error) { setError(`${res.error} (zapisano ${done} z ${toSend.length} - możesz uruchomić import ponownie, zapisane pozycje zostaną rozpoznane)`); break; }
      for (const x of res.results) applied[x.i] = x;
      done += batch.length;
      setBusy({ label: 'Zapisuję produkty', done, total: toSend.length });
    }

    // zdjęcia: produkty bez zdjęcia, dla których plik ma linki
    const imageMap = new Map();
    for (const x of Object.values(applied)) {
      const row = rowByI.get(x.i);
      if (!x.no_image || !x.product_id || !row?.images.length) continue;
      const list = imageMap.get(x.product_id) || [];
      imageMap.set(x.product_id, [...new Set([...list, ...row.images])].slice(0, 8));
    }
    const imageItems = [...imageMap.entries()].map(([product_id, urls]) => ({ product_id, urls }));
    let imagesAdded = 0;
    const imageErrors = [];
    for (let k = 0; k < imageItems.length && !stopRef.current; k += IMAGE_BATCH) {
      setBusy({ label: 'Pobieram zdjęcia', done: k, total: imageItems.length });
      try {
        const res = await importImages(imageItems.slice(k, k + IMAGE_BATCH));
        for (const r of res.report || []) {
          imagesAdded += r.added;
          if (r.errors?.length) imageErrors.push(...r.errors);
        }
      } catch (err) {
        imageErrors.push(String(err.message || err));
      }
    }

    let zeroed = 0;
    // tylko po pełnym zapisie: inaczej wyzerowałbym pozycje, do których import nie doszedł
    if (rule.zero_missing && !stopRef.current && done === toSend.length) {
      const seen = Object.values(applied).map((x) => x.variant_id).filter(Boolean);
      const res = await importZeroMissing(supplierId, seen, rule.update_stock, true);
      if (res.error) setError(res.error); else zeroed = res.count;
    }

    const final = { new: 0, update: 0, same: 0, error: counts.error };
    for (const x of Object.values(applied)) final[x.status] = (final[x.status] || 0) + 1;
    const result = {
      at: new Date().toISOString(),
      file: file.name,
      ...final,
      images: imagesAdded,
      zeroed,
      stopped: stopRef.current || done < toSend.length,
    };
    await saveImportSettings(supplierId, { last_import: result });
    await importFinished();
    setSummary({
      ...result,
      imageErrors,
      applyErrors: Object.values(applied).filter((x) => x.status === 'error').map((x) => ({ i: x.i, error: x.error })),
    });
    setBusy(null);
  }

  function reset() {
    setStep(0); setFile(null); setRows([]); setResults({}); setSummary(null); setError(''); setMissingCount(null);
  }

  // ---------- widok ----------
  const categoryOptions = (
    <>
      <option value="">- bez kategorii -</option>
      {tree.map((c) => <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.depth ? '└ ' : ''}{c.name}</option>)}
    </>
  );

  return (
    <div className="import">
      <ol className="steps">
        {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</li>)}
      </ol>

      {error && <p className="alert">{error}</p>}

      {step === 0 && (
        <section className="stack-form">
          <label>Hurtownia
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {saved.last_import && (
            <p className="muted small">
              Ostatni import: {new Date(saved.last_import.at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}
              {' '}({saved.last_import.file}): nowe {saved.last_import.new}, zmienione {saved.last_import.update}, błędy {saved.last_import.error}.
              Ustawienia z tamtego importu zostaną użyte ponownie.
            </p>
          )}
          <label>Plik z hurtowni (CSV albo Excel .xlsx)
            <input type="file" accept=".csv,.txt,.xlsx,text/csv" onChange={onFile} />
          </label>
          <p className="muted small">
            Pierwszy wiersz pliku to nagłówki kolumn. Nie masz pliku? <a href="/admin/import/szablon">Pobierz szablon CSV</a> i
            uzupełnij go w Excelu. Produkty rozpoznaję po EAN (a bez EAN po kodzie hurtowni): istniejącym zmieniam cenę i stan,
            nowe dodaję jako ukryte szkice. Nazw, opisów i zdjęć istniejących produktów nie ruszam.
          </p>
        </section>
      )}

      {step === 1 && file && (
        <section className="stack-form">
          <p className="muted small">{file.name} · {file.table.rows.length} wierszy · {file.encoding}</p>
          <p>Która kolumna w pliku co zawiera? Wybór zapamiętam dla hurtowni {supplier?.name}.</p>
          {FIELDS.map((f) => (
            <label key={f.key}>{f.label}
              <select value={columns[f.key] || ''} onChange={(e) => setColumns((c) => ({ ...c, [f.key]: e.target.value }))}>
                <option value="">- brak w pliku -</option>
                {file.table.headers.map((h) => <option key={h} value={h}>{h}{samples[h] ? ` (np. ${samples[h]})` : ''}</option>)}
              </select>
            </label>
          ))}
          {columnProblems.map((p) => <p key={p} className="alert">{p}</p>)}
          {noName && !columnProblems.length && <p className="warn small">Bez kolumny z nazwą mogę tylko aktualizować produkty, które już są w sklepie.</p>}
          {columns.group && <p className="muted small">Wiersze z tym samym kodem grupy staną się wariantami jednego produktu (np. 2 kg i 7 kg).</p>}
          <div className="wizard-nav">
            <button type="button" className="link-btn" onClick={() => setStep(0)}>← Wstecz</button>
            <button type="button" className="btn" disabled={columnProblems.length > 0} onClick={goToCategories}>Dalej</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="stack-form">
          <p>Do której kategorii sklepu trafią <strong>nowe</strong> produkty? (Istniejącym nie zmieniam kategorii.)</p>
          {supplierCategories.length > 0 && (
            <ul className="map-list">
              {supplierCategories.map(([value, n]) => (
                <li key={value}>
                  <span>{value} <span className="muted">({n})</span></span>
                  <select value={categoryMap[value] || ''} onChange={(e) => setCategoryMap((m) => ({ ...m, [value]: e.target.value }))}>
                    {categoryOptions}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <label>{supplierCategories.length ? 'Pozostałe (bez dopasowania lub bez kategorii w pliku)' : 'Kategoria dla wszystkich nowych produktów'}
            <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>{categoryOptions}</select>
          </label>
          <p className="muted small">Kategorię każdego szkicu możesz potem zmienić w produkcie. Nowej kategorii brakuje? Dodaj ją w zakładce <Link href="/admin/kategorie">Kategorie</Link> i wczytaj plik ponownie.</p>
          <div className="wizard-nav">
            <button type="button" className="link-btn" onClick={() => setStep(1)}>← Wstecz</button>
            <button type="button" className="btn" onClick={() => setStep(3)}>Dalej</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="stack-form">
          <div className="grid-2">
            <label>Narzut (%)
              <input type="number" inputMode="decimal" min="0" max="1000" step="1" value={rule.markup}
                onChange={(e) => setRuleField('markup', e.target.value)} />
            </label>
            <label>Końcówka ceny
              <select value={rule.rounding} onChange={(e) => setRuleField('rounding', e.target.value)}>
                <option value="99">w górę do ,99</option>
                <option value="90">w górę do ,90</option>
                <option value="00">w górę do pełnych złotych</option>
                <option value="none">bez zaokrąglania</option>
              </select>
            </label>
          </div>
          <p className="muted small">Cena w sklepie = cena zakupu netto + VAT + narzut. Tak samo przy firmie zwolnionej z VAT
            (VAT z faktury jest kosztem) i przy czynnym VAT (VAT doliczasz klientowi).</p>
          {columns.suggested && (
            <label className="radio">
              <input type="checkbox" checked={rule.use_suggested} onChange={(e) => setRuleField('use_suggested', e.target.checked)} />
              Gdy plik ma cenę sugerowaną, użyj jej zamiast narzutu
            </label>
          )}
          <label>Stawka VAT, gdy brak jej w pliku
            <select value={rule.vat_mode} onChange={(e) => setRuleField('vat_mode', e.target.value)}>
              <option value="auto">automatycznie: karma i przysmaki 8%, reszta 23%</option>
              <option value="8">8% dla wszystkich</option>
              <option value="23">23% dla wszystkich</option>
            </select>
          </label>
          {example && (
            <p className="box small">
              Przykład: {example.name || 'pierwszy produkt'}<br />
              {example.source === 'sugerowana'
                ? <>cena sugerowana {money(example.suggested)} → <strong>{money(example.price)}</strong></>
                : example.price
                  ? <>zakup {money(example.purchase)} netto + VAT {example.vat}% + {rule.markup || 0}% → <strong>{money(example.price)}</strong></>
                  : 'brak ceny w pierwszym wierszu'}
            </p>
          )}
          <fieldset>
            <legend>Produkty, które już są w sklepie</legend>
            <label className="radio">
              <input type="checkbox" checked={rule.update_price} onChange={(e) => setRuleField('update_price', e.target.checked)} />
              Aktualizuj ceny sprzedaży według reguły
            </label>
            <label className="radio">
              <input type="checkbox" checked={rule.update_stock} onChange={(e) => setRuleField('update_stock', e.target.checked)} />
              Stan w sklepie = stan w hurtowni
            </label>
            <label className="radio">
              <input type="checkbox" checked={rule.zero_missing} onChange={(e) => setRuleField('zero_missing', e.target.checked)} />
              Produkty tej hurtowni, których nie ma w pliku: stan 0 (tylko gdy plik to pełna oferta)
            </label>
            <p className="muted small">Cena zakupu i stan w hurtowni aktualizują się zawsze. Zmiany cen trafiają do historii cen (Omnibus).
              Promocji nie zmieniam.</p>
          </fieldset>
          <div className="wizard-nav">
            <button type="button" className="link-btn" onClick={() => setStep(2)}>← Wstecz</button>
            <button type="button" className="btn" onClick={runPreview}>Pokaż podgląd</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          {busy ? (
            <>
              <Progress {...busy} />
              <button type="button" className="link-btn" onClick={() => { stopRef.current = true; }}>Przerwij</button>
            </>
          ) : (
            <>
              <div className="import-tabs">
                {Object.entries(TABS).map(([key, label]) => (
                  <button key={key} type="button" className={`chip${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
                    {label} <strong>{counts[key]}</strong>
                  </button>
                ))}
              </div>
              {counts.new > 0 && (
                <p className="muted small">Nowe: {counts.new} poz. = {newProducts} nowych produktów (ukryte szkice, pozostałe jako warianty).</p>
              )}
              {rule.zero_missing && missingCount != null && (
                <p className="warn small">Pozycje tej hurtowni spoza pliku, którym ustawię stan 0: {missingCount}.
                  {counts.error > 0 && ' Uwaga: produkty z wierszy z błędami też dostaną stan 0 - popraw plik albo wyłącz tę opcję.'}</p>
              )}
              <ul className="import-list">
                {rows.filter((r) => statusOf(r, results) === tab).slice(0, LIST_LIMIT).map((r) => {
                  const res = results[r.i];
                  return (
                    <li key={r.i}>
                      <div>
                        <span className="muted">w. {r.i}</span>{' '}
                        <strong>{res?.name || r.data.name || r.data.ean || r.data.sku}</strong>
                        {res?.as_variant && <span className="muted"> (wariant {r.data.variant_name})</span>}
                      </div>
                      {tab === 'new' && (
                        <div className="small">
                          {money(r.data.price)}{r.data.purchase ? ` (zakup ${money(r.data.purchase)} netto)` : ''} · VAT {r.data.vat}% ·
                          stan {r.data.stock ?? 0}{r.data.brand ? ` · ${r.data.brand}` : ''}
                          {' · '}{categories.find((c) => c.id === r.data.category_id)?.name || <span className="warn">bez kategorii</span>}
                          {r.images.length ? ` · zdjęcia: ${r.images.length}` : ''}
                        </div>
                      )}
                      {tab === 'update' && <div className="small">{describeChanges(res?.changes)}</div>}
                      {tab === 'error' && <div className="small alert-text">{[...r.errors, res?.error].filter(Boolean).join(' · ') || 'Brak odpowiedzi z bazy'}</div>}
                      {r.warnings.length > 0 && <div className="small warn">{r.warnings.join(' · ')}</div>}
                    </li>
                  );
                })}
              </ul>
              {counts[tab] > LIST_LIMIT && <p className="muted small">…i {counts[tab] - LIST_LIMIT} więcej.</p>}
              <div className="wizard-nav sticky-save">
                <button type="button" className="link-btn" onClick={() => setStep(3)}>← Zmień ustawienia</button>
                <button type="button" className="btn" disabled={!counts.new && !counts.update && !missingCount} onClick={runApply}>
                  Zapisz import
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 5 && (
        <section>
          {busy && (
            <>
              <Progress {...busy} />
              <p className="muted small">Nie zamykaj tej strony. Przerwany import można uruchomić ponownie - zapisane pozycje zostaną rozpoznane po EAN.</p>
              <button type="button" className="link-btn" onClick={() => { stopRef.current = true; }}>Przerwij</button>
            </>
          )}
          {summary && (
            <div className="stack-form">
              <p className="ok">{summary.stopped ? 'Import przerwany.' : 'Import zakończony.'}</p>
              <ul>
                <li>Nowe pozycje (szkice): {summary.new}</li>
                <li>Zaktualizowane: {summary.update}</li>
                <li>Bez zmian: {summary.same}</li>
                <li>Pominięte (błędy): {summary.error}</li>
                <li>Pobrane zdjęcia: {summary.images}</li>
                {rule.zero_missing && <li>Stan 0 dla pozycji spoza pliku: {summary.zeroed}</li>}
              </ul>
              {summary.applyErrors.length > 0 && (
                <details><summary>Błędy zapisu ({summary.applyErrors.length})</summary>
                  <ul className="small">{summary.applyErrors.map((e) => <li key={e.i}>w. {e.i}: {e.error}</li>)}</ul>
                </details>
              )}
              {summary.imageErrors.length > 0 && (
                <details><summary>Nie udało się pobrać zdjęć ({summary.imageErrors.length})</summary>
                  <ul className="small">{summary.imageErrors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul>
                </details>
              )}
              <p>Nowe produkty są ukryte. Sprawdź je, uzupełnij i kliknij „Pokaż”:{' '}
                <Link href="/admin/produkty?filtr=ukryte">Produkty → Ukryte / szkice</Link></p>
              <button type="button" className="btn btn-small" onClick={reset}>Nowy import</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
