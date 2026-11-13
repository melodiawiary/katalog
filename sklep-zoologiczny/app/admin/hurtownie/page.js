import { createClient } from '@/lib/supabase/server';
import { needsSql, SQL_HINT } from '@/lib/admin';
import ActionForm from '@/components/admin/ActionForm';
import { saveSupplier, deleteSupplier } from '../katalog-actions';

export const metadata = { title: 'Hurtownie' };

function Fields({ s = {} }) {
  return (
    <>
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <label>Nazwa *<input name="name" defaultValue={s.name} required maxLength={120} /></label>
      <div className="grid-2">
        <label>NIP<input name="nip" defaultValue={s.nip} inputMode="numeric" /></label>
        <label>Telefon<input name="phone" type="tel" defaultValue={s.phone} /></label>
      </div>
      <label>E-mail<input name="email" type="email" defaultValue={s.email} /></label>
      <label>Strona / panel B2B<input name="website" defaultValue={s.website} inputMode="url" /></label>
      <label>Notatki (warunki, minimum zamówienia, opiekun…)<textarea name="notes" rows={3} defaultValue={s.notes} /></label>
      <label className="radio"><input type="checkbox" name="active" defaultChecked={s.active ?? true} /> Aktywna</label>
    </>
  );
}

export default async function SuppliersPage() {
  const supabase = await createClient();
  const [{ data: suppliers, error }, { data: links }] = await Promise.all([
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('variant_suppliers').select('supplier_id'),
  ]);
  if (needsSql(error)) return (<><h1>Hurtownie</h1><p className="alert">{SQL_HINT}</p></>);
  const counts = {};
  for (const l of links || []) counts[l.supplier_id] = (counts[l.supplier_id] || 0) + 1;

  return (
    <>
      <h1>Hurtownie</h1>
      <p className="muted">Widzisz je tylko Ty. Ceny zakupu wpisujesz w produkcie (sekcja „Hurtownia i cena zakupu”),
        a w kolejnym kroku będzie import cennika z pliku.</p>
      <details className="panel">
        <summary className="btn btn-small">+ Dodaj hurtownię</summary>
        <ActionForm action={saveSupplier} submitLabel="Dodaj hurtownię" resetOnOk><Fields /></ActionForm>
      </details>
      {suppliers?.length === 0 && <p className="muted">Brak hurtowni.</p>}
      <ul className="tree">
        {suppliers?.map((s) => (
          <li key={s.id}>
            <details className={`order${s.active ? '' : ' row-off'}`}>
              <summary>
                <strong>{s.name}</strong>
                <span className="muted">{counts[s.id] || 0} poz.</span>
                {!s.active && <span className="status status-anulowane">nieaktywna</span>}
              </summary>
              <div className="order-details">
                {(s.phone || s.email) && (
                  <p>
                    {s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}
                    {s.phone && s.email && ' · '}
                    {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
                  </p>
                )}
                <ActionForm action={saveSupplier}><Fields s={s} /></ActionForm>
                <ActionForm action={deleteSupplier} submitLabel="Usuń hurtownię" danger confirm={`Usunąć hurtownię „${s.name}”?`} className="delete-form">
                  <input type="hidden" name="id" value={s.id} />
                </ActionForm>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
