import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export { SETTINGS_FIELDS, missingSettings, formatAccount } from './settings-fields';

const DEFAULTS = {
  shop_name: process.env.NEXT_PUBLIC_SHOP_NAME || 'Sklep Zoologiczny',
  sales_enabled: false,
  vat_status: 'zwolniony',
};

// Ustawienia sklepu (jeden wiersz). Gdy tabeli jeszcze nie ma, sklep działa w trybie "przed startem".
export const getSettings = cache(async () => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    return { ...DEFAULTS, ...(data || {}), shop_name: data?.shop_name || DEFAULTS.shop_name };
  } catch {
    return DEFAULTS;
  }
});
