import Stars from './Stars';
import ReviewForm from './ReviewForm';

const date = (d) => new Date(d).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'long', year: 'numeric' });

// Opinie o produkcie (dane z funkcji product_extras). Dodać opinię mogą tylko klienci, którzy kupili produkt.
export default function Reviews({ productId, extras }) {
  const { rating_count: count = 0, rating_avg: avg, reviews = [] } = extras || {};
  return (
    <section id="opinie" className="reviews">
      <h2>Opinie klientów</h2>
      {count > 0 ? (
        <p className="reviews-sum">
          <strong className="reviews-avg">{Number(avg).toFixed(1).replace('.', ',')}</strong>
          <Stars value={avg} size="1.3em" />
          <span className="muted">{count} {count === 1 ? 'opinia' : count < 5 ? 'opinie' : 'opinii'}</span>
        </p>
      ) : (
        <p className="muted">Ten produkt nie ma jeszcze opinii.</p>
      )}
      <p className="small muted">Opinie dodają wyłącznie zalogowani klienci, którzy kupili ten produkt w naszym sklepie. Nie płacimy za opinie i nie usuwamy negatywnych; ukrywamy tylko wpisy łamiące zasady (np. wulgaryzmy).</p>

      <ul className="plain review-list">
        {reviews.map((r) => (
          <li key={r.id} className="review">
            <div className="review-head">
              <Stars value={r.rating} />
              {r.title && <strong>{r.title}</strong>}
            </div>
            {r.body && <p>{r.body}</p>}
            <p className="small muted">{r.author} · {date(r.created_at)} · potwierdzony zakup</p>
          </li>
        ))}
      </ul>

      <ReviewForm productId={productId} />
    </section>
  );
}
