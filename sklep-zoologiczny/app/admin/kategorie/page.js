import { createClient } from '@/lib/supabase/server';
import { categoryTree } from '@/lib/categories';
import { needsSql, SQL_HINT } from '@/lib/admin';
import ActionForm from '@/components/admin/ActionForm';
import { saveCategory, deleteCategory } from '../katalog-actions';

export const metadata = { title: 'Kategorie' };

function ParentSelect({ tree, value, excludeId }) {
  // nie da się wybrać samej siebie ani własnej podkategorii
  const blocked = new Set();
  if (excludeId) {
    blocked.add(excludeId);
    for (const c of tree) if (c.parent_id && blocked.has(c.parent_id)) blocked.add(c.id);
  }
  return (
    <label>Kategoria nadrzędna
      <select name="parent_id" defaultValue={value || ''}>
        <option value="">- główna (bez nadrzędnej) -</option>
        {tree.filter((c) => !blocked.has(c.id)).map((c) => (
          <option key={c.id} value={c.id}>{'   '.repeat(c.depth)}{c.depth ? '' : `${c.emoji} `}{c.name}</option>
        ))}
      </select>
    </label>
  );
}

function Fields({ c = {}, tree }) {
  return (
    <>
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <label>Nazwa *<input name="name" defaultValue={c.name} required maxLength={100} /></label>
      <ParentSelect tree={tree} value={c.parent_id} excludeId={c.id} />
      <div className="grid-3">
        <label>Emoji<input name="emoji" defaultValue={c.emoji || '🐾'} maxLength={8} /></label>
        <label>Kolejność<input name="sort" type="number" defaultValue={c.sort ?? 0} /></label>
        <label>Adres (slug)<input name="slug" defaultValue={c.slug} placeholder="z nazwy" /></label>
      </div>
      <label>Opis (opcjonalnie, nad listą produktów)<textarea name="description" rows={2} defaultValue={c.description} /></label>
      <label className="radio"><input type="checkbox" name="active" defaultChecked={c.active ?? true} /> Widoczna w menu sklepu</label>
    </>
  );
}

export default async function CategoriesPage() {
  const supabase = await createClient();
  const [{ data: categories, error }, { data: products }] = await Promise.all([
    supabase.from('categories').select('*').order('sort'),
    supabase.from('products').select('category_id'),
  ]);
  const tree = categoryTree(categories || []);
  const counts = {};
  for (const p of products || []) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  const hasTree = (categories || []).some((c) => 'parent_id' in c);

  return (
    <>
      <h1>Kategorie</h1>
      {((categories?.length && !hasTree) || needsSql(error)) && <p className="alert">{SQL_HINT}</p>}
      <details className="panel">
        <summary className="btn btn-small">+ Dodaj kategorię</summary>
        <ActionForm action={saveCategory} submitLabel="Dodaj kategorię" resetOnOk>
          <Fields tree={tree} />
        </ActionForm>
      </details>

      <ul className="tree">
        {tree.map((c) => (
          <li key={c.id} style={{ marginLeft: `${c.depth * 18}px` }}>
            <details className={`order${c.active === false ? ' row-off' : ''}`}>
              <summary>
                <span>{c.depth === 0 ? c.emoji : '└'}</span>
                <strong>{c.name}</strong>
                <span className="muted">{counts[c.id] || 0} prod.</span>
                {c.active === false && <span className="status status-anulowane">ukryta</span>}
              </summary>
              <div className="order-details">
                <ActionForm action={saveCategory}><Fields c={c} tree={tree} /></ActionForm>
                <ActionForm action={deleteCategory} submitLabel="Usuń kategorię" danger
                  confirm={`Usunąć kategorię „${c.name}”?`} className="delete-form">
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
