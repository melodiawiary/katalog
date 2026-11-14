'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { submitReview } from '@/app/produkt/actions';

// Pokazuje formularz tylko klientowi, który kupił produkt (sprawdza funkcja can_review w bazie)
export default function ReviewForm({ productId }) {
  const [info, setInfo] = useState(null);
  const [state, action, pending] = useActionState(submitReview, null);
  const [rating, setRating] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    try {
      createClient().rpc('can_review', { p_product: productId }).then(({ data }) => {
        if (!alive) return;
        setInfo(data || { logged_in: false });
        if (data?.mine?.rating) setRating(data.mine.rating);
      });
    } catch { /* bez formularza */ }
    return () => { alive = false; };
  }, [productId]);

  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  if (!info) return null;
  if (!info.logged_in) {
    return (
      <p className="box small">Kupiłeś ten produkt? <Link href={`/konto/logowanie?next=${encodeURIComponent(pathname)}`}>Zaloguj się</Link>, żeby dodać opinię.</p>
    );
  }
  if (!info.purchased) {
    return <p className="small muted">Opinię możesz dodać po zakupie tego produktu (gdy zamówienie zostanie wysłane).</p>;
  }

  const mine = info.mine;
  return (
    <form action={action} className="review-form box">
      <h3>{mine ? 'Twoja opinia (możesz ją zmienić)' : 'Dodaj opinię'}</h3>
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="rating-pick" role="radiogroup" aria-label="Ocena">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} z 5`}
            className={`star-btn${n <= rating ? ' on' : ''}`} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <label>Tytuł (nieobowiązkowo)<input name="title" maxLength={100} defaultValue={mine?.title || ''} /></label>
      <label>Twoja opinia (np. czy zwierzak chętnie zjada, jakość opakowania)
        <textarea name="body" rows={4} maxLength={2000} defaultValue={mine?.body || ''} />
      </label>
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="ok-box">{state.ok}</p>}
      <button className="btn btn-small" disabled={pending || rating < 1}>{pending ? 'Zapisywanie…' : mine ? 'Zapisz zmiany' : 'Opublikuj opinię'}</button>
      {mine?.status === 'ukryta' && <p className="small muted">Ta opinia została ukryta przez sklep (niezgodna z zasadami).</p>}
    </form>
  );
}
