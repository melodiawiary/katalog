// Codzienny automat (Vercel Cron, plik vercel.json): "Produkt znów dostępny", sprawdzenie nieopłaconych płatności, przypomnienia o karmie.
// Jeśli na Vercelu jest zmienna CRON_SECRET, wywołanie musi mieć nagłówek "Authorization: Bearer <CRON_SECRET>"
// (Vercel dodaje go sam). Bez CRON_SECRET adres działa dla każdego - to bezpieczne, bo każda wiadomość idzie tylko raz.
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { runStockAlerts, runFoodReminders } from '@/lib/order-mail';
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
  const reminders = await runFoodReminders(site);
  // ranking salonów: starsze opinie liczą się mniej, więc przeliczamy raz dziennie (przed 11_opinie_salonow.sql: błąd, pomijamy)
  const { error: rankError } = await db.rpc('refresh_place_ranking', { p_city: null });
  return NextResponse.json({ alerts, payments, reminders, ranking: rankError ? 'błąd' : 'ok' });
}
