import { getSettings } from '@/lib/settings';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zamówienie' };

export default async function CheckoutPage() {
  const s = await getSettings();
  return <CheckoutForm salesEnabled={s.sales_enabled} />;
}
