import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductForm from '../../ProductForm';
import { deleteProduct } from '../../actions';

export default async function EditProductPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('*').order('sort'),
  ]);
  if (!product) notFound();

  return (
    <>
      <h1>Edycja: {product.name}</h1>
      <ProductForm product={product} categories={categories || []} />
      <form action={deleteProduct} className="danger-zone">
        <input type="hidden" name="id" value={product.id} />
        <button className="link-btn danger">Usuń produkt na stałe</button>
        <p className="muted">Zamiast usuwać, możesz odznaczyć „Widoczny w sklepie”.</p>
      </form>
    </>
  );
}
