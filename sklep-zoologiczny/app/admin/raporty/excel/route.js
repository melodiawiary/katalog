// Pobranie Excela dla księgowego: /admin/raporty/excel?miesiac=2026-11
import { adminClient } from '@/lib/admin-server';
import { getSettings } from '@/lib/settings';
import { currentMonth, validMonth, fetchOrders, calcOrder, summarize } from '@/lib/reports';
import { buildAccountantXlsx } from '@/lib/reports-xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let supabase;
  try {
    supabase = await adminClient();
  } catch {
    return new Response('Brak uprawnień', { status: 403 });
  }
  const param = new URL(request.url).searchParams.get('miesiac');
  const month = validMonth(param) ? param : currentMonth();
  try {
    const settings = await getSettings();
    const orders = await fetchOrders(supabase, month, month);
    const calcs = orders.map((o) => calcOrder(o, settings.vat_status));
    const buffer = await buildAccountantXlsx({ month, calcs, summary: summarize(calcs), settings });
    return new Response(buffer, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="sprzedaz-${month}.xlsx"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(`Nie udało się przygotować pliku: ${e.message}`, { status: 500 });
  }
}
