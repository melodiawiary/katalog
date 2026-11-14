import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';
import { REVIEW_STATUS } from '@/lib/places';
import Stars from '@/components/product/Stars';
import ActionForm from '@/components/admin/ActionForm';
import ConfirmButton from '@/components/admin/ConfirmButton';
import { moderatePlaceReview, setReviewsPremoderation } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Opinie o salonach' };

const TABS = { oczekuje: 'Do zatwierdzenia', zgloszone: 'Zgłoszone', opublikowana: 'Opublikowane', ukryta: 'Ukryte' };

export default async function PlaceReviewsAdmin({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS[sp?.status] ? sp.status : 'oczekuje';
  const supabase = await createClient();

  const cfg = await supabase.from('places_config').select('reviews_premoderation').maybeSingle();
  if (needsSql(cfg.error) || cfg.error) {
    return <p className="alert">Opinie o salonach czekają na aktualizację bazy (plik supabase/11_opinie_salonow.sql).</p>;
  }

  let q = supabase.from('place_reviews')
    .select('id, rating, r_quality, r_care, r_clean, r_price, body, author, status, hidden_note, reports_count, paid_amount, created_at, updated_at, places(name, slug, city)')
    .order('created_at', { ascending: false }).limit(100);
  if (tab === 'zgloszone') q = q.gt('reports_count', 0).neq('status', 'ukryta');
  else q = q.eq('status', tab);
  const [{ data: reviews }, counts] = await Promise.all([
    q,
    Promise.all(['oczekuje', 'opublikowana', 'ukryta'].map((s) => supabase.from('place_reviews').select('id', { count: 'exact', head: true }).eq('status', s))),
  ]);
  const reportsRes = await supabase.from('place_review_reports').select('review_id, reason, contact_email, created_at').eq('status', 'nowe').order('created_at', { ascending: false }).limit(300);
  const reports = {};
  for (const r of reportsRes.data || []) (reports[r.review_id] ||= []).push(r);

  return (
    <div>
      <h1>Opinie o salonach</h1>
      <div className="box">
        <ActionForm action={setReviewsPremoderation} submitLabel="Zapisz">
          <label className="radio">
            <input type="checkbox" name="premoderation" defaultChecked={cfg.data?.reviews_premoderation !== false} />
            Nowe opinie czekają na moje zatwierdzenie (odznacz, żeby publikowały się od razu)
          </label>
        </ActionForm>
        <p className="small muted">Ukrywaj wyłącznie wpisy łamiące <Link href="/salony/zasady-opinii">zasady opinii</Link> (wulgaryzmy, dane osobowe, spam, nie o usługach salonu), nie dlatego, że są negatywne. Ranking przelicza się sam po każdej zmianie.</p>
      </div>
      <nav className="chips">
        {Object.entries(TABS).map(([k, l]) => (
          <Link key={k} href={`/admin/opinie-salonow?status=${k}`} className={tab === k ? 'chip active' : 'chip'}>
            {l}{k === 'oczekuje' ? ` (${counts[0].count || 0})` : k === 'opublikowana' ? ` (${counts[1].count || 0})` : k === 'ukryta' ? ` (${counts[2].count || 0})` : ''}
          </Link>
        ))}
      </nav>
      {!reviews?.length && <p className="box">Brak opinii w tej zakładce.</p>}
      <ul className="plain">
        {(reviews || []).map((r) => (
          <li key={r.id} className={`box${r.status === 'ukryta' ? ' row-off' : ''}`}>
            <p><Stars value={r.rating} /> <strong>{Number(r.rating).toFixed(1).replace('.', ',')}</strong>{' '}
              <span className="small muted">jakość {r.r_quality}{r.r_care ? `, podejście ${r.r_care}` : ''}{r.r_clean ? `, czystość ${r.r_clean}` : ''}{r.r_price ? `, cena ${r.r_price}` : ''}</span>
              <span className="status"> {REVIEW_STATUS[r.status]}</span></p>
            {r.body && <p>{r.body}</p>}
            {r.paid_amount != null && <p className="small muted">Zapłacono: {r.paid_amount} zł</p>}
            <p className="small muted">{r.author} · {new Date(r.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })} ·{' '}
              {r.places?.slug ? <Link href={`/salony/${r.places.slug}#opinie`}>{r.places.name}, {r.places.city}</Link> : 'salon usunięty'}
              {r.hidden_note && <> · powód ukrycia: {r.hidden_note}</>}</p>
            {(reports[r.id] || []).map((x, i) => (
              <p key={i} className="alert small">Zgłoszenie ({x.contact_email}): {x.reason}</p>
            ))}
            <div className="row-actions">
              {r.status === 'oczekuje' && (
                <form action={moderatePlaceReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="show" /><button className="btn btn-small">Zatwierdź</button></form>
              )}
              {r.status === 'ukryta' && (
                <form action={moderatePlaceReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="show" /><button className="btn btn-small btn-light">Przywróć</button></form>
              )}
              {r.status !== 'ukryta' && (
                <form action={moderatePlaceReview} className="inline-form">
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="hide" />
                  <input name="note" placeholder="Powód ukrycia" maxLength={300} />
                  <button className="btn btn-small btn-light">Ukryj</button>
                </form>
              )}
              {(reports[r.id] || []).length > 0 && (
                <form action={moderatePlaceReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="keep" /><button className="btn btn-small btn-light">Zgłoszenie bezzasadne</button></form>
              )}
              <form action={moderatePlaceReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Usunąć opinię na stałe?">Usuń</ConfirmButton></form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
