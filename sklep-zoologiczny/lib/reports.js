// Raporty sprzedaży dla właściciela i księgowego (tylko na serwerze, dane czyta zalogowany administrator).
//
// Zasady liczenia (te same co w formularzu produktu, app/admin/ProductForm.js):
// - liczą się zamówienia prawdziwe (bez testowych) i nieanulowane, wg daty złożenia zamówienia (strefa Europe/Warsaw)
// - ceny w zamówieniu są brutto; cena zakupu w zamówieniu jest netto
// - czynny VAT: przychód i zysk netto (cena sprzedaży bez VAT minus cena zakupu netto)
// - zwolniony z VAT: przychód = brutto, a VAT z faktury zakupu jest kosztem (zakup netto + VAT produktu)
// - dostawa pobierana od klienta: VAT 23% przy czynnym VAT (do potwierdzenia z księgowym)
// - prowizja płatności (payment_fee) i rzeczywisty koszt dostawy (shipping_real_cost) są odejmowane w kwotach
//   wpisanych w panelu, bez przeliczania VAT; brak kosztu dostawy = dostawa nie wpływa na zysk
import { warsawDayStart } from '@/lib/admin';

const TZ = 'Europe/Warsaw';
export const SHIPPING_VAT = 23;
export const VAT_RATES = [0, 5, 8, 23];

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// --- miesiące ---

export function currentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
}

export function validMonth(ym) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym || ''));
}

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthStart(ym) {
  return warsawDayStart(`${ym}-01`);
}

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthOf(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7);
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16);
}

// --- pobieranie zamówień ---

const SELECT = 'id, number, created_at, status, customer_name, shipping_method, payment_method, payment_status, '
  + 'shipping_cost, total, payment_fee, shipping_real_cost, '
  + 'order_items(product_id, product_name, variant_name, ean, price, quantity, purchase_price, vat_rate)';

// Zamówienia od początku miesiąca `fromMonth` do końca miesiąca `toMonth` (włącznie)
export async function fetchOrders(supabase, fromMonth, toMonth) {
  const from = monthStart(fromMonth);
  const to = monthStart(shiftMonth(toMonth, 1));
  const all = [];
  const page = 500;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await supabase
      .from('orders')
      .select(SELECT)
      .eq('is_test', false)
      .neq('status', 'anulowane')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: true })
      .order('number', { ascending: true })
      .range(offset, offset + page - 1);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < page) break;
  }
  return all;
}

// --- liczenie ---

function emptyVat() {
  return Object.fromEntries(VAT_RATES.map((r) => [r, { gross: 0, net: 0, vat: 0 }]));
}

export function calcOrder(order, vatStatus) {
  const czynny = vatStatus === 'czynny';
  const items = [];
  let itemsGross = 0;
  let itemsRevenue = 0;
  let cost = 0;
  let profit = 0;
  let missingCost = 0;
  const grossByRate = Object.fromEntries(VAT_RATES.map((r) => [r, 0]));

  for (const it of order.order_items || []) {
    const qty = Number(it.quantity) || 0;
    const rate = it.vat_rate == null ? 23 : Number(it.vat_rate);
    const gross = Number(it.price) * qty;
    const net = czynny ? gross / (1 + rate / 100) : gross;
    const buy = it.purchase_price == null ? null : Number(it.purchase_price);
    const itemCost = buy == null ? null : czynny ? buy * qty : buy * (1 + rate / 100) * qty;
    itemsGross += gross;
    itemsRevenue += net;
    grossByRate[rate] = (grossByRate[rate] || 0) + gross;
    if (itemCost == null) missingCost += qty;
    else {
      cost += itemCost;
      profit += net - itemCost;
    }
    items.push({
      product_id: it.product_id,
      name: it.product_name,
      variant: it.variant_name || '',
      ean: it.ean || '',
      qty,
      price: Number(it.price),
      rate,
      gross: r2(gross),
      net: r2(net),
      vat: r2(gross - net),
      purchase: buy,
      cost: itemCost == null ? null : r2(itemCost),
      profit: itemCost == null ? null : r2(net - itemCost),
    });
  }

  const shipGross = Number(order.shipping_cost) || 0;
  grossByRate[SHIPPING_VAT] = (grossByRate[SHIPPING_VAT] || 0) + shipGross;
  const shipRevenue = czynny ? shipGross / (1 + SHIPPING_VAT / 100) : shipGross;
  const fee = Number(order.payment_fee) || 0;
  const shipReal = order.shipping_real_cost == null ? null : Number(order.shipping_real_cost);
  const shipResult = shipReal == null ? 0 : shipRevenue - shipReal;
  profit += shipResult - fee;

  // VAT liczony od sumy brutto danej stawki w zamówieniu (jak na paragonie / fakturze)
  const vat = emptyVat();
  let netTotal = 0;
  let vatTotal = 0;
  for (const rate of VAT_RATES) {
    const gross = r2(grossByRate[rate] || 0);
    const net = czynny ? r2(gross / (1 + rate / 100)) : gross;
    vat[rate] = { gross, net, vat: r2(gross - net) };
    netTotal += net;
    vatTotal += gross - net;
  }

  return {
    id: order.id,
    number: order.number,
    created_at: order.created_at,
    customer: order.customer_name,
    status: order.status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    shipping_method: order.shipping_method,
    items,
    items_gross: r2(itemsGross),
    ship_gross: r2(shipGross),
    total: r2(order.total),
    net_total: r2(netTotal),
    vat_total: r2(vatTotal),
    vat,
    revenue: r2(itemsRevenue + shipRevenue),
    cost: r2(cost),
    fee: r2(fee),
    ship_real: shipReal == null ? null : r2(shipReal),
    ship_diff: shipReal == null ? null : r2(shipReal - shipRevenue), // > 0: dopłacamy do dostawy
    profit: r2(profit),
    missing_cost: missingCost,
  };
}

export function summarize(calcs) {
  const s = {
    orders: calcs.length,
    qty: 0,
    total: 0,
    revenue: 0,
    cost: 0,
    fee: 0,
    ship_surcharge: 0, // suma dopłat do dostawy (tylko zamówienia z wpisanym kosztem)
    ship_unknown: 0, // zamówienia bez wpisanego kosztu dostawy
    profit: 0,
    missing_cost: 0,
    unpaid: 0,
    vat: emptyVat(),
    net_total: 0,
    vat_total: 0,
  };
  for (const c of calcs) {
    s.qty += c.items.reduce((a, i) => a + i.qty, 0);
    s.total += c.total;
    s.revenue += c.revenue;
    s.cost += c.cost;
    s.fee += c.fee;
    s.profit += c.profit;
    s.missing_cost += c.missing_cost;
    s.net_total += c.net_total;
    s.vat_total += c.vat_total;
    if (c.ship_diff == null) s.ship_unknown += 1;
    else s.ship_surcharge += c.ship_diff;
    if (c.payment_status === 'nieoplacone') s.unpaid += 1;
    for (const rate of VAT_RATES) {
      s.vat[rate].gross += c.vat[rate].gross;
      s.vat[rate].net += c.vat[rate].net;
      s.vat[rate].vat += c.vat[rate].vat;
    }
  }
  for (const k of ['total', 'revenue', 'cost', 'fee', 'ship_surcharge', 'profit', 'net_total', 'vat_total']) s[k] = r2(s[k]);
  for (const rate of VAT_RATES) for (const k of ['gross', 'net', 'vat']) s.vat[rate][k] = r2(s.vat[rate][k]);
  s.margin = s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0;
  return s;
}

export function topProducts(calcs, limit = 10) {
  const map = new Map();
  for (const c of calcs) {
    for (const i of c.items) {
      const key = `${i.product_id ?? i.name}|${i.variant}`;
      const row = map.get(key) || { name: i.name, variant: i.variant, qty: 0, revenue: 0, profit: 0, missing: false };
      row.qty += i.qty;
      row.revenue += i.net;
      if (i.profit == null) row.missing = true;
      else row.profit += i.profit;
      map.set(key, row);
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: r2(r.revenue), profit: r2(r.profit) }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, limit);
}

// 12 miesięcy kończących się na `toMonth` (od najnowszego)
export function monthlyTable(calcs, toMonth) {
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const ym = shiftMonth(toMonth, -i);
    const list = calcs.filter((c) => monthOf(c.created_at) === ym);
    rows.push({ month: ym, ...summarize(list) });
  }
  return rows;
}
