import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadProductFormData } from '@/lib/admin-products';
import ProductForm from '../../ProductForm';

export const metadata = { title: 'Nowy produkt' };

export default async function NewProductPage() {
  const supabase = await createClient();
  const data = await loadProductFormData(supabase);
  return (
    <>
      <p className="muted"><Link href="/admin/produkty">← Produkty</Link></p>
      <h1>Nowy produkt</h1>
      <ProductForm {...data} />
    </>
  );
}
