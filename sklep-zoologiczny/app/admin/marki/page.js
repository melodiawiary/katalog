import { createClient } from '@/lib/supabase/server';
import { needsSql, SQL_HINT } from '@/lib/admin';
import ActionForm from '@/components/admin/ActionForm';
import { saveBrand, deleteBrand } from '../katalog-actions';

export const metadata = { title: 'Marki' };

function Fields({ b = {} }) {
  return (
    <>
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <label>Nazwa *<input name="name" defaultValue={b.name} required maxLength={100} /></label>
      <label>Adres (slug)<input name="slug" defaultValue={b.slug} placeholder="z nazwy" /></label>
      <label>Link do logo (opcjonalnie)<input name="logo_url" defaultValue={b.logo_url || ''} inputMode="url" /></label>
      <label>Opis (opcjonalnie)<textarea name="description" rows={2} defaultValue={b.description} /></label>
      <label className="radio"><input type="checkbox" name="active" defaultChecked={b.active ?? true} /> Widoczna w sklepie</label>
    </>
  );
}

export default async function BrandsPage() {
  const supabase = await createClient();
  const [{ data: brands, error }, { data: products }] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('products').select('brand_id'),
  ]);
  const counts = {};
  for (const p of products || []) counts[p.brand_id] = (counts[p.brand_id] || 0) + 1;

  if (needsSql(error)) return (<><h1>Marki</h1><p className="alert">{SQL_HINT}</p></>);

  return (
    <>
      <h1>Marki <span className="muted">({brands?.length || 0})</span></h1>
      <details className="panel">
        <summary className="btn btn-small">+ Dodaj markę</summary>
        <ActionForm action={saveBrand} submitLabel="Dodaj markę" resetOnOk><Fields /></ActionForm>
      </details>
      {brands?.length === 0 && <p className="muted">Brak marek. Możesz je dodawać tutaj albo od razu w formularzu produktu („+ nowa”).</p>}
      <ul className="tree">
        {brands?.map((b) => (
          <li key={b.id}>
            <details className={`order${b.active ? '' : ' row-off'}`}>
              <summary>
                <strong>{b.name}</strong>
                <a href={`/admin/produkty?marka=${b.id}`} className="muted">{counts[b.id] || 0} prod.</a>
                {!b.active && <span className="status status-anulowane">ukryta</span>}
              </summary>
              <div className="order-details">
                <ActionForm action={saveBrand}><Fields b={b} /></ActionForm>
                <ActionForm action={deleteBrand} submitLabel="Usuń markę" danger confirm={`Usunąć markę „${b.name}”?`} className="delete-form">
                  <input type="hidden" name="id" value={b.id} />
                </ActionForm>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
