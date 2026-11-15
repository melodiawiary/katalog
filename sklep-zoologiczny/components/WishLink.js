'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, getServerSnapshot } from '@/lib/wishlist';

// Serduszko w nagłówku z liczbą ulubionych
export default function WishLink() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <Link href="/ulubione" className="wish-link" aria-label={`Ulubione${ids.length ? ` (${ids.length})` : ''}`}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 5 6.2 5c2 0 3.3 1.1 3.8 2 .5-.9 1.8-2 3.8-2 3.4 0 5.3 3.4 3.800 6.8C19.500 16.400 12 21 12 21z" /></svg>
      {ids.length > 0 && <span className="wish-count">{ids.length}</span>}
    </Link>
  );
}
