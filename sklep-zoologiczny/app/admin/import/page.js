import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql, SQL_HINT } from '@/lib/admin';
import ImportWizard from './ImportWizard';

export const metadata = { title: 'Import z hurtowni' };
// zapis partii i pobieranie zdjęć może chwilę trwać
export const maxDuration = 60;

export default async function ImportPage() {
  const supabase = await createClient();
  const [{ data: suppliers, error }, { data: categories }] = await Promise.all([
    supabase.from('suppliers').select('id, name, active, import_settings').order('name'),
    supabase.from('categories').select('id, name, slug, parent_id, sort').order('sort'),
  ]);
  if (needsSql(error)) return (<><h1>Import z hurtowni</h1><p className="alert">{SQL_HINT}</p></>);

  return (
    <>
      <h1>Import z hurtowni</h1>
      {suppliers?.length ? (
        <ImportWizard suppliers={suppliers.filter((s) => s.active)} categories={categories || []} />
      ) : (
        <p className="alert">Najpierw dodaj hurtownię w zakładce <Link href="/admin/hurtownie">Hurtownie</Link>.</p>
      )}
    </>
  );
}
