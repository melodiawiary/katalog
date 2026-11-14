import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { price } from '@/lib/shop';
import {
  currentMonth, validMonth, shiftMonth, monthLabel, monthOf, fetchOrders, calcOrder, summarize,
  topProducts, monthlyTable, fmtDateTime, VAT_RATES, SHIPPING_VAT,
} from '@/lib/reports';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }) {
  const { miesiac } = await searchParams;
  const month = validMonth(miesiac) ? miesiac : currentMonth();
  const supabase = await createClient();
  const settings = await getSettings();
  const czynny = settings.vat_status === 'czynny';

  let all = [];
  let error = null;
  try {
    all = (await fetchOrders(supabase, shiftMonth(month, -11), month)).map((o) => calcOrder(o, settings.vat_status));
  } catch (e) {
    error = e.message;
  }
  const calcs = all.filter((c) => monthOf(c.created_at) === month);
  const s = summarize(calcs);
  const top = topProducts(calcs, 10);
  const months = monthlyTable(all, month);
  const vatRows = VAT_RATES.filter((r) => s.vat[r].gross !== 0);
  const isCurrent = month === currentMonth();

  return (
    <>
      <div className="title-row">
        <h1>Raporty</h1>
        <a className="btn" href={`/admin/raporty/excel?miesiac=${month}`}>Pobierz dla księgowego (Excel)</a>
      </div>

      <nav className="chips">
        <Link href={`/admin/raporty?miesiac=${shiftMonth(month, -1)}`} className="chip">← {monthLabel(shiftMonth(month, -1))}</Link>
        <span className="chip active">{monthLabel(month)}</span>
        {!isCurrent && <Link href={`/admin/raporty?miesiac=${shiftMonth(month, 1)}`} className="chip">{monthLabel(shiftMonth(month, 1))} →</Link>}
      </nav>

      <p className="muted small">
        Liczone: zamówienia prawdziwe (bez testowych i anulowanych), wg daty złożenia.
        Status VAT: <strong>{czynny ? 'czynny - kwoty netto' : 'zwolniony - kwoty brutto'}</strong> (zmiana w Ustawieniach).
      </p>

      {error && <p className="alert">{error}</p>}

      {s.orders === 0 && !error && <p className="muted">W tym miesiącu nie ma jeszcze zamówień.</p>}

      {s.orders > 0 && (
        <>
          <div className="report-tiles">
            <div><span>Zamówienia</span><strong>{s.orders}</strong><small>{s.qty} szt.</small></div>
            <div><span>Zapłata klientów</span><strong>{price(s.total)}</strong><small>brutto</small></div>
            <div><span>Przychód</span><strong>{price(s.revenue)}</strong><small>{czynny ? 'netto' : 'brutto'}</small></div>
            <div><span>Koszt zakupu</span><strong>{price(s.cost)}</strong></div>
            <div><span>Prowizje płatności</span><strong>{price(s.fee)}</strong></div>
            <div><span>Dopłata do dostawy</span><strong>{price(s.ship_surcharge)}</strong><small>koszt minus od klienta</small></div>
            <div className="tile-main"><span>Zysk</span><strong>{price(s.profit)}</strong><small>{s.margin.toFixed(1)}% przychodu</small></div>
          </div>

          {s.missing_cost > 0 && (
            <p className="alert">{s.missing_cost} szt. sprzedano bez ceny zakupu - ich koszt nie jest wliczony, więc zysk jest zawyżony. Uzupełnij ceny zakupu w produktach.</p>
          )}
          {s.ship_unknown > 0 && (
            <p className="muted small">{s.ship_unknown} zam. bez wpisanego rzeczywistego kosztu dostawy (wpisz go w zamówieniu), na razie dostawa nie wpływa na zysk.</p>
          )}
          {s.unpaid > 0 && <p className="muted small">{s.unpaid} zam. jest jeszcze nieopłaconych (liczą się, dopóki ich nie anulujesz).</p>}

          {czynny && (
            <>
              <h2>VAT należny</h2>
              <div className="table-wrap">
                <table className="report-table">
                  <thead><tr><th>Stawka</th><th>Brutto</th><th>Netto</th><th>VAT</th></tr></thead>
                  <tbody>
                    {vatRows.map((r) => (
                      <tr key={r}>
                        <td>{r}%{r === SHIPPING_VAT ? ' (z dostawą)' : ''}</td>
                        <td>{price(s.vat[r].gross)}</td><td>{price(s.vat[r].net)}</td><td>{price(s.vat[r].vat)}</td>
                      </tr>
                    ))}
                    <tr className="sum"><td>Razem</td><td>{price(s.total)}</td><td>{price(s.net_total)}</td><td>{price(s.vat_total)}</td></tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2>Najlepsze produkty</h2>
          <div className="table-wrap">
            <table className="report-table">
              <thead><tr><th>Produkt</th><th>Szt.</th><th>Przychód</th><th>Zysk</th></tr></thead>
              <tbody>
                {top.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}{p.variant ? ` - ${p.variant}` : ''}</td>
                    <td>{p.qty}</td><td>{price(p.revenue)}</td>
                    <td>{p.missing ? <span className="muted">brak ceny zakupu</span> : price(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Zamówienia w miesiącu</h2>
          <div className="table-wrap">
            <table className="report-table">
              <thead><tr><th>Nr</th><th>Data</th><th>Klient</th><th>Brutto</th><th>Zakup</th><th>Zysk</th></tr></thead>
              <tbody>
                {calcs.map((c) => (
                  <tr key={c.id}>
                    <td>#{c.number}</td><td>{fmtDateTime(c.created_at)}</td><td>{c.customer}</td>
                    <td>{price(c.total)}</td><td>{price(c.cost)}</td>
                    <td>{price(c.profit)}{c.missing_cost > 0 && <span className="muted" title="brak ceny zakupu"> *</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Ostatnie 12 miesięcy</h2>
      <div className="table-wrap">
        <table className="report-table">
          <thead><tr><th>Miesiąc</th><th>Zam.</th><th>Zapłata brutto</th><th>Zysk</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className={m.month === month ? 'sum' : ''}>
                <td><Link href={`/admin/raporty?miesiac=${m.month}`}>{monthLabel(m.month)}</Link></td>
                <td>{m.orders}</td><td>{price(m.total)}</td><td>{price(m.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
