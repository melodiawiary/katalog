// Powiadomienie z Przelewy24 o wpłacie (adres podawany przy każdej transakcji jako urlStatus).
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';
import { getIntegrations } from '@/lib/integrations';
import { notificationValid } from '@/lib/p24';
import { handleNotification } from '@/lib/payments';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json();
  const text = await request.text();
  try { return JSON.parse(text); } catch { return Object.fromEntries(new URLSearchParams(text)); }
}

export async function POST(request) {
  const db = serviceClient();
  if (!db) return new NextResponse('Brak klucza serwisowego', { status: 500 });
  let n;
  try { n = await readBody(request); } catch { return new NextResponse('Zła treść', { status: 400 }); }

  const integ = await getIntegrations(db);
  if (!integ.p24_crc || !notificationValid(integ, n)) {
    return new NextResponse('Zły podpis', { status: 400 });
  }
  const { data: settings } = await db.from('settings').select('domain').eq('id', 1).maybeSingle();
  const r = await handleNotification(db, integ, n, await siteUrl(settings));
  if (!r.ok) return new NextResponse(r.error || 'Błąd', { status: 400 });
  return new NextResponse('OK');
}
