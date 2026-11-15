'use client';
import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, getServerSnapshot, toggleWish } from '@/lib/wishlist';

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 5 6.2 5c2 0 3.3 1.1 3.8 2 .5-.9 1.8-2 3.8-2 3.4 0 5.3 3.400 3.800 6.800C19.500 16.400 12 21 12 21z';

// Serduszko "do ulubionych" na zdjęciu produktu
export default function WishHeart({ id, name }) {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const on = ids.includes(id);
  return (
    <button
      type="button"
      className={`wish-heart${on ? ' is-on' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Usuń z ulubionych: ${name}` : `Dodaj do ulubionych: ${name}`}
      onClick={() => toggleWish(id)}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d={HEART} /></svg>
    </button>
  );
}
