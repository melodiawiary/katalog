import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';
import Stars from '@/components/product/Stars';
import ConfirmButton from '@/components/admin/ConfirmButton';
import { moderateReview } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminReviews({ searchParams }) {
  const sp = await searchParams;
  const only = sp?.status === 'ukryta' ? 'ukryta' : null;
  const supabase = await createClient();
  let q = supabase.from('product_reviews')
    .select('id, rating, title, body, author, status, hidden_note, created_at, products(name, slug)')
    .order('created_at', { ascending: false }).limit(100);
  if (only) q = q.eq('status', only);
  const { data: reviews, error } = await q;

  if (error) {
    return <p className="alert">{needsSql(error) ? 'Opinie czekają na aktualizację bazy (plik supabase/08_konto.sql).' : 'Nie udało się wczytać opinii.'}</p>;
  }

  return (
    <div>
      <h1>Opinie o produktach</h1>
      <p className="muted">Opinie publikują się od razu (dodają je tylko klienci po zakupie). Ukrywaj wyłącznie wpisy łamiące zasady (wulgaryzmy, dane osobowe, spam) -
        nie ukrywaj opinii tylko dlatego, że są negatywne.</p>
      <p className="small">
        <Link href="/admin/opinie">Wszystkie</Link> · <Link href="/admin/opinie?status=ukryta">Ukryte</Link>
      </p>
      {!reviews?.length && <p className="box">Brak opinii.</p>}
      <ul className="plain">
        {(reviews || []).map((r) => (
          <li key={r.id} className={`box${r.status === 'ukryta' ? ' row-off' : ''}`}>
            <p>
              <Stars value={r.rating} /> <strong>{r.title}</strong>
              {r.status === 'ukryta' && <span className="status status-anulowane"> ukryta</span>}
            </p>
            {r.body && <p>{r.body}</p>}
            <p className="small muted">
              {r.author} · {new Date(r.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })} ·{' '}
              {r.products?.slug ? <Link href={`/produkt/${r.products.slug}#opinie`}>{r.products.name}</Link> : 'produkt usunięty'}
              {r.hidden_note && <> · powód ukrycia: {r.hidden_note}</>}
            </p>
            <div className="row-actions">
              {r.status === 'ukryta' ? (
                <form action={moderateReview}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="show" />
                  <button className="btn btn-small btn-light">Przywróć</button>
                </form>
              ) : (
                <form action={moderateReview} className="inline-form">
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="hide" />
                  <input name="note" placeholder="Powód ukrycia" maxLength={300} />
                  <button className="btn btn-small btn-light">Ukryj</button>
                </form>
              )}
              <form action={moderateReview}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="delete" />
                <ConfirmButton message="Usunąć opinię na stałe?">Usuń</ConfirmButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
