import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadProductFormData } from '@/lib/admin-products';
import ProductForm from '../../ProductForm';
import ConfirmButton from '@/components/admin/ConfirmButton';
import { deleteProduct, duplicateProduct } from '../actions';

export const metadata = { title: 'Edycja produktu' };

export default async function EditProductPage({ params, searchParams }) {
  const { id } = await params;
  const { zapisano, kopia } = await searchParams;
  const supabase = await createClient();
  const data = await loadProductFormData(supabase, id);
  if (!data.product) notFound();
  const p = data.product;

  return (
    <>
      <p className="muted"><Link href="/admin/produkty">← Produkty</Link></p>
      <div className="title-row">
        <h1>{p.name}</h1>
        {p.active && <Link href={`/produkt/${p.slug}`} className="muted" target="_blank">Zobacz w sklepie ↗</Link>}
      </div>
      {zapisano && <p className="ok">Zapisano.</p>}
      {kopia && <p className="box">To jest kopia (ukryta, bez EAN, stan 0). Popraw nazwę, warianty i zapisz.</p>}
      {/* key: po zapisie formularz wczytuje świeże dane z bazy */}
      <ProductForm key={p.updated_at || p.id} {...data} />
      <div className="danger-zone">
        <form action={duplicateProduct}>
          <input type="hidden" name="id" value={p.id} />
          <button className="link-btn">Zrób kopię produktu</button>
        </form>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={p.id} />
          <ConfirmButton message={`Usunąć na stałe „${p.name}” razem z wariantami i zdjęciami?`}>Usuń produkt na stałe</ConfirmButton>
          <p className="muted">Zamiast usuwać, możesz odznaczyć „Widoczny w sklepie”. Zamówienia z tym produktem zostają.</p>
        </form>
      </div>
    </>
  );
}
