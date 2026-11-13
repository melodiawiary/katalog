import { createClient } from '@/lib/supabase/server';
import ProductForm from '../../ProductForm';

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from('categories').select('*').order('sort');
  return (
    <>
      <h1>Nowy produkt</h1>
      <ProductForm categories={categories || []} />
    </>
  );
}
