import { getSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zamówienie' };

const NO_FEATURES = { p24: false, p24_sandbox: true, geowidget_token: '', email: false };

export default async function CheckoutPage() {
  const s = await getSettings();
  const supabase = await createClient();
  // przed wklejeniem 06_zamowienie.sql funkcji nie ma - wtedy bez płatności online
  const { data: features } = await supabase.rpc('shop_features');
  let testMode = false;
  if (!s.sales_enabled) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: isAdmin } = await supabase.rpc('is_admin');
      testMode = Boolean(isAdmin) && Boolean(features); // zamówienia testowe działają od 06_zamowienie.sql
    }
  }
  return (
    <CheckoutForm
      salesEnabled={s.sales_enabled}
      testMode={testMode}
      features={{ ...NO_FEATURES, ...(features || {}) }}
      ship={{ cutoff: s.ship_cutoff || '13:00', handlingDays: s.ship_handling_days || 0 }}
    />
  );
}
