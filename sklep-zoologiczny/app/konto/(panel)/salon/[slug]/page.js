import { placeHref, placeBase } from '@/lib/place-categories';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/account';
import { PLACE_BADGES, opinionsWord, SIZE_CLASS } from '@/lib/places';
import PhotoManager from '@/components/places/PhotoManager';
import Stars from '@/components/product/Stars';
import { DataForm, ReplyBox, NotifyToggle, PlusDoor, ReleaseBox } from './OwnerPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel salonu', robots: { index: false } };

function tips(d) {
  const p = d.place;
  const out = [];
  if (!p.description) out.push('Dodaj opis salonu - to pierwsze, co czytają klienci.');
  if (!p.phone) out.push('Dodaj numer telefonu.');
  if (!d.hours.length) out.push('Uzupełnij godziny otwarcia (od nich zależy filtr „otwarte teraz”).');
  if (!d.prices.length) out.push('Dodaj cennik. Salony z cennikiem są wyżej i częściej wybierane.');
  if (!d.photos.length) out.push('Dodaj zdjęcia salonu.');
  if (!p.website && !p.booking_url) out.push('Dodaj stronę www albo link do rezerwacji.');
  if (p.rating_count < 3) out.push('Odznaki „Polecany” i „Top w mieście” wymagają co najmniej 3 opinii. Poproś zadowolonych klientów o opinię (link do salonu możesz wysłać w wiadomości).');
  if (!p.verified) out.push('Odznaki „Polecany” i „Top w mieście” wymagają statusu „Sprawdzony”. Dostaje go salon przejęty kodem wysłanym na adres e-mail z naszego katalogu. Jeśli przejęcie poszło inną drogą (adres w domenie strony albo ręczna weryfikacja), napisz do nas, a sprawdzimy salon.');
  if (p.rating_count >= 3 && Number(p.rating_avg) < 4.3) out.push('Odznaka „Polecany” wymaga średniej oceny co najmniej 4,3. Odpowiadanie na opinie pomaga budować zaufanie.');
  return out;
}

export default async function OwnerSalonPage({ params }) {
  const { slug } = await params;
  const { supabase } = await requireUser(`/konto/salon`);
  const { data: d } = await supabase.rpc('owner_dashboard', { p_slug: slug });
  if (!d) notFound();
  const cat = d.place.category || 'groomer';
  const [{ data: services }, { data: featureDefs }] = await Promise.all([
    supabase.from('service_defs').select('code, label').contains('categories', [cat]).order('sort'),
    supabase.from('feature_defs').select('code, label').contains('categories', [cat]).order('sort'),
  ]);
  const p = d.place;
  const advice = tips(d);
  const date = (x) => new Date(x).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', year: 'numeric' });
  const pending = (d.reviews || []).filter((r) => !r.reply).length;
  const copy = { place: p, hours: d.hours, prices: d.prices };

  return (
    <div>
      <p className="muted"><Link href="/konto/salon">← Moje salony</Link></p>
      <div className="title-row">
        <h1>{p.name}</h1>
        <Link href={placeHref(cat, p.slug)} className="muted" target="_blank">Zobacz stronę salonu ↗</Link>
      </div>
      {d.is_admin && <p className="box small">Widok administratora.</p>}
      {d.hold_until && (
        <p className="box small">
          <strong>Pierwsze 48 godzin po przejęciu.</strong> Do {new Date(d.hold_until).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'long', timeStyle: 'short' })} zmiany telefonu, e-maila i linków (strona, rezerwacje, social media) czekają, a dotychczasowi opiekunowie dostali o przejęciu wiadomość. Opis, godziny, cennik i zdjęcia możesz zmieniać od razu.
          {d.pending_changes && <> Czekają: {d.pending_changes.fields.map((f) => ({ phone: 'telefon', email: 'e-mail', website: 'strona WWW', booking_url: 'rezerwacje', instagram: 'Instagram', facebook: 'Facebook' }[f] || f)).join(', ')}.</>}
        </p>
      )}

      <section className="box">
        <h2>Sprawdź swój ranking</h2>
        <p>
          {p.city_rank
            ? <>Jesteś na miejscu <strong>{p.city_rank}</strong> z {d.city_ranked} w mieście {p.city}.</>
            : <>Salon nie jest jeszcze w rankingu miasta {p.city}. Ranking obejmuje salony z co najmniej jedną opinią.</>}
          {' '}Ocena: {p.rating_count > 0 ? <strong>{Number(p.rating_avg).toFixed(1).replace('.', ',')} ({p.rating_count} {opinionsWord(p.rating_count)})</strong> : 'brak opinii'}.
          {(p.badges || []).length > 0 && <> Odznaki: {p.badges.map((b) => PLACE_BADGES[b]).join(', ')}.</>}
        </p>
        {advice.length > 0 ? (
          <>
            <strong className="small">Co możesz poprawić:</strong>
            <ul>{advice.map((t) => <li key={t} className="small">{t}</li>)}</ul>
          </>
        ) : <p className="ok small">Profil jest kompletny. Najlepsze, co możesz teraz zrobić, to zbierać opinie i na nie odpowiadać.</p>}
        <p className="small muted">Ranking liczymy z opinii (im więcej i lepsze, tym wyżej), kompletności profilu i statusu „Sprawdzony”. Nie pokazujemy danych innych salonów.</p>
        {d.city_slug && <Link className="small" href={`${placeBase(cat)}/miasto/${d.city_slug}`}>Zobacz ranking miasta ↗</Link>}
      </section>

      <section id="opinie">
        <h2>Opinie{pending > 0 ? ` (${pending} bez odpowiedzi)` : ''}</h2>
        {(d.reviews || []).length === 0 && <p className="muted">Brak opinii.</p>}
        <ul className="plain review-list">
          {(d.reviews || []).map((r) => (
            <li key={r.id} className="review">
              <div className="review-head"><Stars value={r.rating} /><strong>{Number(r.rating).toFixed(1).replace('.', ',')}</strong></div>
              {r.body && <p>{r.body}</p>}
              {r.service && <p className="review-paid">Usługa: {r.service}{r.size_class && <>, {SIZE_CLASS[r.size_class]}</>}</p>}
              <p className="small muted">{r.author} · {date(r.created_at)}</p>
              <ReplyBox review={r} slug={slug} />
            </li>
          ))}
        </ul>
        <NotifyToggle placeId={p.id} slug={slug} on={d.my_notify} />
      </section>

      <section>
        <h2>Zdjęcia</h2>
        <PhotoManager placeId={p.id} slug={slug} photos={d.photos} />
      </section>

      <section>
        <h2>Dane salonu</h2>
        <DataForm place={p} hours={d.hours} prices={d.prices} services={services || []} featureDefs={featureDefs || []} slug={slug} />
      </section>

      <section className="box">
        <h2>Wizytówka Plus</h2>
        <PlusDoor placeId={p.id} slug={slug} interested={d.plus_interest} note={d.plus_note} />
      </section>

      <section>
        <h2>Opiekunowie profilu</h2>
        <ul className="plain">
          {(d.owners || []).map((o, i) => <li key={i} className="small">{o.name || 'opiekun'} ({o.role === 'zarzadzajacy' ? 'zarządza' : 'właściciel'}){o.me ? ' - to Ty' : ''}, od {date(o.since)}</li>)}
        </ul>
        {!d.is_admin && <ReleaseBox placeId={p.id} slug={slug} name={p.name} copy={copy} />}
      </section>
    </div>
  );
}
