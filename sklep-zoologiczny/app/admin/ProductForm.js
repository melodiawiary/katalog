'use client';

import { useActionState } from 'react';
import { saveProduct } from './actions';
import { categoryTree } from '@/lib/categories';

export default function ProductForm({ product, categories }) {
  const [state, formAction, pending] = useActionState(saveProduct, null);
  const p = product || { active: true, stock: 0 };

  return (
    <form action={formAction} className="checkout">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <fieldset>
        <label>Nazwa<input name="name" defaultValue={p.name} required /></label>
        <label>Adres w sklepie (slug, puste = z nazwy)<input name="slug" defaultValue={p.slug} /></label>
        <label>
          Kategoria
          <select name="category_id" defaultValue={p.category_id || ''}>
            <option value="">- brak -</option>
            {categoryTree(categories).map((c) => (
              <option key={c.id} value={c.id}>{'\u00a0\u00a0\u00a0'.repeat(c.depth)}{c.depth ? '' : `${c.emoji} `}{c.name}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <label>Cena (zł)<input name="price" inputMode="decimal" defaultValue={p.price} required /></label>
          <label>Stan (szt.)<input name="stock" type="number" min="0" defaultValue={p.stock} required /></label>
        </div>
        <label>Opis<textarea name="description" rows={5} defaultValue={p.description} /></label>
        <label>Zdjęcie<input name="image" type="file" accept="image/*" /></label>
        {p.image_url && (
          <div className="thumb-row">
            <img src={p.image_url} alt="" className="thumb" />
            <label className="radio"><input type="checkbox" name="remove_image" /> Usuń zdjęcie</label>
          </div>
        )}
        <label className="radio"><input type="checkbox" name="active" defaultChecked={p.active} /> Widoczny w sklepie</label>
      </fieldset>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn btn-big" disabled={pending}>{pending ? 'Zapisywanie…' : 'Zapisz produkt'}</button>
    </form>
  );
}
