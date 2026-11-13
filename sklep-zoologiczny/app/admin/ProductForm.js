'use client';

import { useActionState, useMemo, useState, startTransition } from 'react';
import { saveProduct } from './produkty/actions';
import { categoryTree } from '@/lib/categories';
import { createClient } from '@/lib/supabase/client';
import { price as formatPrice, slugify } from '@/lib/shop';
import { validEan, parseDecimal } from '@/lib/admin';

const VAT_RATES = [
  { value: 8, label: '8% (karma, przysmaki)' },
  { value: 23, label: '23% (akcesoria, zabawki, żwirki)' },
  { value: 5, label: '5%' },
  { value: 0, label: '0%' },
];

const emptyVariant = () => ({
  key: Math.random().toString(36).slice(2),
  id: null, name: '', sku: '', ean: '', price: '', stock: '0', net_quantity: '', unit: 'kg',
  promo_price: '', promo_from: '', promo_to: '', promo_from_orig: '', promo_to_orig: '',
  supplier_id: '', supplier_sku: '', purchase_price: '', active: true, open: true,
});

// Zmniejsza zdjęcie w przeglądarce (max 1600 px, JPEG), żeby szybko się wysyłało i ładowało
async function shrinkImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // np. format, którego przeglądarka nie umie odczytać - wysyłamy oryginał
  }
}

function profit(variant, vatRate, vatStatus) {
  const sell = parseDecimal(variant.promo_price) ?? parseDecimal(variant.price);
  const buy = parseDecimal(variant.purchase_price);
  if (sell == null || buy == null || Number.isNaN(sell) || Number.isNaN(buy) || sell === 0) return null;
  const rate = Number(vatRate) / 100;
  // czynny VAT: liczymy netto od obu cen; zwolniony: VAT z faktury zakupu jest kosztem
  const value = vatStatus === 'czynny' ? sell / (1 + rate) - buy : sell - buy * (1 + rate);
  const base = vatStatus === 'czynny' ? sell / (1 + rate) : sell;
  return { value, percent: (value / base) * 100 };
}

export default function ProductForm({
  product, categories = [], brands = [], attributes = [], suppliers = [], vatStatus = 'zwolniony', missingSql,
}) {
  const [state, formAction, pending] = useActionState(saveProduct, null);
  const p = product || {};

  const [fields, setFields] = useState({
    name: p.name || '',
    slug: p.slug || '',
    category_id: p.category_id ? String(p.category_id) : '',
    brand_id: p.brand_id ? String(p.brand_id) : '',
    new_brand: '',
    vat_rate: String(p.vat_rate ?? 23),
    active: p.active ?? true,
    description: p.description || '',
    composition: p.composition || '',
    analysis: p.analysis || '',
    additives: p.additives || '',
    dosage: p.dosage || '',
  });
  const [variants, setVariants] = useState(() => {
    const list = p.variants?.length ? p.variants : [emptyVariant()];
    return list.map((v) => ({ ...emptyVariant(), ...v, open: !p.id }));
  });
  const [images, setImages] = useState(p.images || []);
  const [valueIds, setValueIds] = useState(new Set(p.value_ids || []));
  const [addingBrand, setAddingBrand] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setVariant = (i, key, value) => setVariants((list) => list.map((v, j) => (j === i ? { ...v, [key]: value } : v)));
  const moveImage = (i, dir) => setImages((list) => {
    const next = [...list];
    const j = i + dir;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  async function uploadFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setUploadError('');
    const supabase = createClient();
    const base = slugify(fields.name || 'produkt') || 'produkt';
    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) throw new Error(`${file.name}: to nie jest zdjęcie`);
        const blob = await shrinkImage(file);
        const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}.${ext}`;
        const { error } = await supabase.storage.from('produkty').upload(path, blob, { contentType: blob.type || file.type });
        if (error) throw new Error(`${file.name}: ${error.message}`);
        const url = supabase.storage.from('produkty').getPublicUrl(path).data.publicUrl;
        setImages((list) => [...list, { id: null, url, alt: '' }]);
      } catch (err) {
        setUploadError(String(err.message || err));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!/^https?:\/\/\S+$/.test(url)) {
      setUploadError('Wklej pełny link do zdjęcia (zaczyna się od https://).');
      return;
    }
    setImages((list) => [...list, { id: null, url, alt: '' }]);
    setImageUrl('');
    setUploadError('');
  }

  const tree = useMemo(() => categoryTree(categories), [categories]);
  const payload = JSON.stringify({
    id: p.id || null,
    ...fields,
    brand_id: addingBrand ? '' : fields.brand_id,
    new_brand: addingBrand ? fields.new_brand : '',
    variants: variants.map(({ key, open, ...v }) => v),
    images: images.map(({ id, url, alt }) => ({ id, url, alt })),
    value_ids: [...valueIds],
  });
  const multi = variants.length > 1;

  return (
    <form
      className="checkout product-form"
      onSubmit={(e) => {
        // bez automatycznego czyszczenia formularza przez Reacta (przy błędzie wpisane dane zostają)
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="payload" value={payload} />
      {missingSql && <p className="alert">{missingSql}</p>}

      <fieldset>
        <legend>Podstawowe</legend>
        <label>Nazwa *<input value={fields.name} onChange={set('name')} required maxLength={200} /></label>
        <label>Adres w sklepie (slug, puste = z nazwy)
          <input value={fields.slug} onChange={set('slug')} placeholder={slugify(fields.name)} />
        </label>
        <label>
          Kategoria
          <select value={fields.category_id} onChange={set('category_id')}>
            <option value="">- brak -</option>
            {tree.map((c) => (
              <option key={c.id} value={c.id}>
                {'   '.repeat(c.depth)}{c.depth ? '' : `${c.emoji} `}{c.name}{c.active === false ? ' (ukryta)' : ''}
              </option>
            ))}
          </select>
        </label>
        {addingBrand ? (
          <label>
            Nowa marka
            <span className="input-with-btn">
              <input value={fields.new_brand} onChange={set('new_brand')} placeholder="np. Brit" maxLength={100} />
              <button type="button" className="link-btn" onClick={() => setAddingBrand(false)}>wybierz z listy</button>
            </span>
          </label>
        ) : (
          <label>
            Marka
            <span className="input-with-btn">
              <select value={fields.brand_id} onChange={set('brand_id')}>
                <option value="">- brak -</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.active ? '' : ' (ukryta)'}</option>)}
              </select>
              <button type="button" className="link-btn" onClick={() => setAddingBrand(true)}>+ nowa</button>
            </span>
          </label>
        )}
        <label>
          Stawka VAT
          <select value={fields.vat_rate} onChange={set('vat_rate')}>
            {VAT_RATES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="radio"><input type="checkbox" checked={fields.active} onChange={set('active')} /> Widoczny w sklepie</label>
      </fieldset>

      <fieldset>
        <legend>Warianty i ceny</legend>
        <p className="muted small">
          Jeden wariant = zwykły produkt. Kilka wariantów = np. 2 kg / 7 kg / 12 kg albo S / M / L,
          każdy z własną ceną i stanem.
        </p>
        {variants.map((v, i) => {
          const net = parseDecimal(v.net_quantity);
          const sell = parseDecimal(v.promo_price) ?? parseDecimal(v.price);
          const perUnit = v.unit !== 'szt' && net > 0 && sell > 0 ? sell / net : null;
          const gain = profit(v, fields.vat_rate, vatStatus);
          const eanWarn = v.ean && /^\d+$/.test(v.ean) && !validEan(v.ean);
          return (
            <div key={v.key} className={`variant${v.active ? '' : ' variant-off'}`}>
              <button type="button" className="variant-head" onClick={() => setVariant(i, 'open', !v.open)}>
                <strong>{v.name || (multi ? `Wariant ${i + 1}` : 'Cena i stan')}</strong>
                <span className="muted">
                  {v.price ? formatPrice(parseDecimal(v.price)) : 'brak ceny'}
                  {v.promo_price ? ` → ${formatPrice(parseDecimal(v.promo_price))}` : ''}
                  {' · '}{v.stock || 0} szt.{v.active ? '' : ' · wyłączony'}
                </span>
                <span aria-hidden="true">{v.open ? '▲' : '▼'}</span>
              </button>
              {v.open && (
                <div className="variant-body">
                  {multi && (
                    <label>Nazwa wariantu (widzi klient)
                      <input value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} placeholder="np. 2 kg albo M" maxLength={60} />
                    </label>
                  )}
                  <div className="grid-2">
                    <label>Cena (zł) *<input inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, 'price', e.target.value)} required /></label>
                    <label>Stan (szt.)<input inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} /></label>
                  </div>
                  <div className="grid-2">
                    <label>Ilość netto<input inputMode="decimal" value={v.net_quantity} onChange={(e) => setVariant(i, 'net_quantity', e.target.value)} placeholder="np. 2 albo 0,4" /></label>
                    <label>Jednostka
                      <select value={v.unit} onChange={(e) => setVariant(i, 'unit', e.target.value)}>
                        <option value="kg">kg</option><option value="l">litr</option><option value="szt">szt.</option>
                      </select>
                    </label>
                  </div>
                  {perUnit && <p className="muted small">Cena za {v.unit === 'kg' ? 'kg' : 'litr'}: {formatPrice(perUnit)}</p>}
                  <div className="grid-2">
                    <label>EAN (kod kreskowy)<input inputMode="numeric" value={v.ean} onChange={(e) => setVariant(i, 'ean', e.target.value.replace(/\s/g, ''))} maxLength={14} /></label>
                    <label>Własny kod (SKU)<input value={v.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} maxLength={60} /></label>
                  </div>
                  {eanWarn && <p className="warn small">Ostatnia cyfra EAN się nie zgadza - sprawdź, czy nie ma literówki.</p>}

                  <details className="sub" open={!!v.promo_price}>
                    <summary>Promocja</summary>
                    <label>Cena promocyjna (zł, puste = bez promocji)
                      <input inputMode="decimal" value={v.promo_price} onChange={(e) => setVariant(i, 'promo_price', e.target.value)} />
                    </label>
                    <div className="grid-2">
                      <label>Od dnia (puste = od teraz)<input type="date" value={v.promo_from} onChange={(e) => setVariant(i, 'promo_from', e.target.value)} /></label>
                      <label>Do dnia (włącznie)<input type="date" value={v.promo_to} onChange={(e) => setVariant(i, 'promo_to', e.target.value)} /></label>
                    </div>
                    <p className="muted small">Przy promocji sklep pokaże najniższą cenę z 30 dni przed nią (wymóg Omnibus).</p>
                  </details>

                  <details className="sub" open={!!v.supplier_id}>
                    <summary>Hurtownia i cena zakupu (widzisz tylko Ty)</summary>
                    <label>Hurtownia
                      <select value={v.supplier_id} onChange={(e) => setVariant(i, 'supplier_id', e.target.value)}>
                        <option value="">- brak -</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                    {suppliers.length === 0 && <p className="muted small">Najpierw dodaj hurtownię w zakładce Hurtownie.</p>}
                    {v.supplier_id && (
                      <div className="grid-2">
                        <label>Kod w hurtowni<input value={v.supplier_sku} onChange={(e) => setVariant(i, 'supplier_sku', e.target.value)} maxLength={60} /></label>
                        <label>Cena zakupu netto (zł)<input inputMode="decimal" value={v.purchase_price} onChange={(e) => setVariant(i, 'purchase_price', e.target.value)} /></label>
                      </div>
                    )}
                    {gain && (
                      <p className={gain.value > 0 ? 'ok small' : 'warn small'}>
                        Zysk na sztuce: {formatPrice(gain.value)} ({gain.percent.toFixed(0)}%)
                        {vatStatus === 'czynny' ? ', netto' : ', przy zwolnieniu z VAT'}
                      </p>
                    )}
                  </details>

                  <div className="variant-actions">
                    <label className="radio"><input type="checkbox" checked={v.active} onChange={(e) => setVariant(i, 'active', e.target.checked)} /> Wariant w sprzedaży</label>
                    {multi && (
                      <button type="button" className="link-btn danger"
                        onClick={() => setVariants((list) => list.filter((_, j) => j !== i))}>
                        Usuń wariant
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="btn btn-small btn-light"
          onClick={() => setVariants((list) => [...list.map((v) => ({ ...v, open: false })), { ...emptyVariant(), unit: list[list.length - 1]?.unit || 'kg' }])}>
          + Dodaj wariant (inna waga / rozmiar)
        </button>
      </fieldset>

      <fieldset>
        <legend>Zdjęcia</legend>
        {images.length > 0 && (
          <ul className="gallery-edit">
            {images.map((im, i) => (
              <li key={im.url + i}>
                <img src={im.url} alt="" />
                {i === 0 && <span className="badge">główne</span>}
                <div className="gallery-btns">
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="W lewo">←</button>
                  <button type="button" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} aria-label="W prawo">→</button>
                  <button type="button" className="danger" onClick={() => setImages((list) => list.filter((_, j) => j !== i))} aria-label="Usuń">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label>Dodaj zdjęcia (można kilka naraz)
          <input type="file" accept="image/*" multiple onChange={uploadFiles} />
        </label>
        <label>albo link do zdjęcia (np. z hurtowni)
          <span className="input-with-btn">
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." inputMode="url" />
            <button type="button" className="btn btn-small" onClick={addImageUrl}>Dodaj</button>
          </span>
        </label>
        {uploading > 0 && <p className="muted">Wysyłanie zdjęć… ({uploading})</p>}
        {uploadError && <p className="alert">{uploadError}</p>}
        <p className="muted small">Pierwsze zdjęcie jest główne. Strzałkami zmieniasz kolejność. Zdjęcia zapiszą się po kliknięciu „Zapisz produkt”.</p>
      </fieldset>

      {attributes.length > 0 && (
        <fieldset>
          <legend>Cechy (do filtrów w sklepie)</legend>
          {attributes.map((a) => (
            <div key={a.id} className="attr-group">
              <span className="attr-name">{a.name}</span>
              <div className="attr-values">
                {a.values.map((val) => (
                  <label key={val.id} className={`pill${valueIds.has(val.id) ? ' on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={valueIds.has(val.id)}
                      onChange={(e) => setValueIds((s) => {
                        const next = new Set(s);
                        if (e.target.checked) next.add(val.id); else next.delete(val.id);
                        return next;
                      })}
                    />
                    {val.value}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend>Opis</legend>
        <label>Opis produktu<textarea rows={6} value={fields.description} onChange={set('description')} /></label>
        <details className="sub" open={!!(fields.composition || fields.analysis || fields.additives || fields.dosage)}>
          <summary>Skład, analiza, dawkowanie (karmy i przysmaki)</summary>
          <label>Skład<textarea rows={4} value={fields.composition} onChange={set('composition')} /></label>
          <label>Składniki analityczne<textarea rows={3} value={fields.analysis} onChange={set('analysis')} placeholder="np. białko 26%, tłuszcz 15%..." /></label>
          <label>Dodatki<textarea rows={3} value={fields.additives} onChange={set('additives')} /></label>
          <label>Dawkowanie<textarea rows={4} value={fields.dosage} onChange={set('dosage')} /></label>
        </details>
      </fieldset>

      {state?.error && <p className="alert">{state.error}</p>}
      <div className="sticky-save">
        <button className="btn btn-big" disabled={pending || uploading > 0}>
          {pending ? 'Zapisywanie…' : uploading > 0 ? 'Czekam na zdjęcia…' : 'Zapisz produkt'}
        </button>
      </div>
    </form>
  );
}
