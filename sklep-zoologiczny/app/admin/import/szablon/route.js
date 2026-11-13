// Szablon CSV do importu (Excel otwiera go poprawnie: UTF-8 z BOM, średniki)
import { TEMPLATE_HEADERS, TEMPLATE_ROWS } from '@/lib/import';

const quote = (v) => (/[;"\n\r]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);

export async function GET() {
  const lines = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS].map((row) => row.map(quote).join(';'));
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="szablon-importu.csv"',
    },
  });
}
