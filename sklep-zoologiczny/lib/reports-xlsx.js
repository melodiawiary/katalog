// Excel dla księgowego: sprzedaż za miesiąc (zamówienia, pozycje, podsumowanie)
import writeXlsxFile from 'write-excel-file/node';
import { PAYMENT, STATUS, shippingLabel } from '@/lib/shop';
import { VAT_RATES, SHIPPING_VAT, fmtDateTime, monthLabel } from '@/lib/reports';

const MONEY = '0.00';
const head = (value) => ({ value, fontWeight: 'bold', backgroundColor: '#EFE7DA', wrap: true });
const money = (value) => (value == null ? null : { value, type: Number, format: MONEY });
const bold = (cell) => (cell && typeof cell === 'object' ? { ...cell, fontWeight: 'bold' } : { value: cell, fontWeight: 'bold' });
const num = (value) => (value == null ? null : { value, type: Number });

export async function buildAccountantXlsx({ month, calcs, summary, settings }) {
  const czynny = settings.vat_status === 'czynny';
  const vatRates = czynny ? VAT_RATES.filter((r) => calcs.some((c) => c.vat[r].gross !== 0)) : [];

  // --- arkusz 1: zamówienia ---
  const orderHead = [
    'Nr zamówienia', 'Data zamówienia', 'Klient', 'Status', 'Płatność', 'Dostawa',
    'Towary brutto', 'Dostawa brutto', 'Razem brutto (zapłata klienta)',
    ...(czynny ? ['Razem netto', ...vatRates.map((r) => `VAT ${r}%`)] : []),
    'Koszt zakupu', 'Prowizja płatności', 'Koszt dostawy (rzeczywisty)', 'Zysk',
  ].map(head);
  const orderRows = calcs.map((c) => [
    num(c.number), c.created_at ? fmtDateTime(c.created_at) : '', c.customer, STATUS[c.status] || c.status,
    PAYMENT[c.payment_method]?.short || c.payment_method, shippingLabel(c.shipping_method),
    money(c.items_gross), money(c.ship_gross), money(c.total),
    ...(czynny ? [money(c.net_total), ...vatRates.map((r) => money(c.vat[r].vat))] : []),
    money(c.cost), money(c.fee), money(c.ship_real), money(c.profit),
  ]);
  const sumVat = (r) => summary.vat[r].vat;
  const totalRow = [
    bold('RAZEM'), null, bold(`${summary.orders} zam.`), null, null, null,
    bold(money(calcs.reduce((a, c) => a + c.items_gross, 0))),
    bold(money(calcs.reduce((a, c) => a + c.ship_gross, 0))),
    bold(money(summary.total)),
    ...(czynny ? [bold(money(summary.net_total)), ...vatRates.map((r) => bold(money(sumVat(r))))] : []),
    bold(money(summary.cost)), bold(money(summary.fee)),
    bold(money(calcs.reduce((a, c) => a + (c.ship_real || 0), 0))), bold(money(summary.profit)),
  ];
  const orderWidths = [12, 17, 24, 14, 18, 18, 13, 13, 17, ...(czynny ? [13, ...vatRates.map(() => 11)] : []), 13, 13, 17, 13].map((width) => ({ width }));

  // --- arkusz 2: pozycje ---
  const itemHead = [
    'Nr zamówienia', 'Data zamówienia', 'Produkt', 'Wariant', 'EAN', 'Ilość', 'Cena brutto', 'Wartość brutto',
    'Stawka VAT', ...(czynny ? ['Wartość netto', 'VAT'] : []), 'Cena zakupu netto', 'Koszt zakupu', 'Zysk',
  ].map(head);
  const itemRows = calcs.flatMap((c) => c.items.map((i) => [
    num(c.number), fmtDateTime(c.created_at), i.name, i.variant, i.ean, num(i.qty), money(i.price), money(i.gross),
    num(i.rate),
    ...(czynny ? [money(i.net), money(i.vat)] : []),
    money(i.purchase), money(i.cost), money(i.profit),
  ]));
  const itemWidths = [12, 17, 36, 16, 15, 7, 12, 13, 10, ...(czynny ? [13, 11] : []), 14, 13, 12].map((width) => ({ width }));

  // --- arkusz 3: podsumowanie ---
  const sum = [
    [bold(`Sprzedaż - ${monthLabel(month)}`), null],
    [settings.company_name || settings.shop_name || '', null],
    [settings.nip ? `NIP ${settings.nip}` : '', null],
    [`Status VAT: ${czynny ? 'czynny podatnik VAT' : 'zwolniony z VAT'}`, null],
    [null, null],
    ['Liczba zamówień', num(summary.orders)],
    ['Sprzedane sztuki', num(summary.qty)],
    ['Zapłata klientów brutto', money(summary.total)],
    [czynny ? 'Przychód netto' : 'Przychód (zwolnienie z VAT, brutto)', money(summary.revenue)],
    ['Koszt zakupu towaru', money(summary.cost)],
    ['Prowizje płatności', money(summary.fee)],
    ['Dostawa: koszt rzeczywisty minus pobrane od klientów (plus = dopłata)', money(summary.ship_surcharge)],
    [bold('Zysk'), bold(money(summary.profit))],
  ];
  if (czynny) {
    sum.push([null, null], [bold('VAT należny wg stawek'), null]);
    for (const r of vatRates) {
      sum.push([`Stawka ${r}%${r === SHIPPING_VAT ? ' (razem z dostawą)' : ''}: brutto / netto / VAT`, money(summary.vat[r].gross)]);
      sum.push(['   netto', money(summary.vat[r].net)]);
      sum.push(['   VAT', money(summary.vat[r].vat)]);
    }
  }
  sum.push([null, null], [bold('Uwagi do sprawdzenia'), null]);
  const notes = [];
  if (summary.missing_cost > 0) notes.push(`${summary.missing_cost} szt. bez ceny zakupu: ich koszt i zysk nie są uwzględnione.`);
  if (summary.unpaid > 0) notes.push(`${summary.unpaid} zam. jeszcze nieopłaconych (liczone w sprzedaży, ponieważ nie zostały anulowane).`);
  if (summary.ship_unknown > 0) notes.push(`${summary.ship_unknown} zam. bez wpisanego rzeczywistego kosztu dostawy: dostawa nie wpływa na zysk.`);
  notes.push('Zamówienia testowe i anulowane są pominięte. Data = dzień złożenia zamówienia (czas polski).');
  notes.push(czynny
    ? `Dostawa pobrana od klienta jest ujęta ze stawką ${SHIPPING_VAT}% (do potwierdzenia przez księgowego). VAT liczony od sumy brutto danej stawki w każdym zamówieniu.`
    : 'Zwolnienie z VAT: przychód = kwoty brutto; VAT z zakupu towaru zwiększa koszt zakupu.');
  notes.push('Prowizja płatności i koszt dostawy to kwoty wpisane w panelu przy zamówieniu, bez przeliczania VAT.');
  for (const n of notes) sum.push([n, null]);

  return writeXlsxFile([
    { data: [orderHead, ...orderRows, totalRow], sheet: 'Zamówienia', columns: orderWidths, stickyRowsCount: 1 },
    { data: [itemHead, ...itemRows], sheet: 'Pozycje', columns: itemWidths, stickyRowsCount: 1 },
    { data: sum, sheet: 'Podsumowanie', columns: [{ width: 70 }, { width: 16 }] },
  ]).toBuffer();
}
