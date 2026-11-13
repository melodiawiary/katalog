// Codzienny automat (Vercel Cron, plik vercel.json): "Produkt znów dostępny" + sprawdzenie nieopłaconych płatności.
// Jeśli na Vercelu jest zmienna CRON_SECRET, wywołanie musi mieć nagłówek "Authorization: Bearer <CRON_SECRET>"
// (Vercel dodaje go sam). Bez CRON_SECRET adres działa dla każdego - to bezpieczne, bo każda wiadomość idzie tylko raz.
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { runStockAlerts } from '@/lib/order-mail';
import { checkRecentUnpaid } from '@/lib/payments';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Brak uprawnień', { status: 401 });
  }
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'Brak SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  const { data: settings } = await db.from('settings').select('domain').eq('id', 1).maybeSingle();
  const site = await siteUrl(settings);
  const alerts = await runStockAlerts(site);
  const payments = await checkRecentUnpaid(site);
  return NextResponse.json({ alerts, payments });
}
