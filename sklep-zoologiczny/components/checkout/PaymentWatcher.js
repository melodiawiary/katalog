'use client';

// Po powrocie z Przelewy24: odświeża stronę co 3 s (do 10 razy), aż płatność zostanie zaksięgowana.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentWatcher() {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= 10) return;
    const t = setTimeout(() => { router.refresh(); setTries((n) => n + 1); }, 3000);
    return () => clearTimeout(t);
  }, [tries, router]);

  return tries < 10
    ? <p>⏳ Sprawdzamy płatność… To zwykle trwa kilka sekund.</p>
    : <p>Nie widzimy jeszcze płatności. Jeśli zapłaciłeś, odśwież stronę za minutę. Jeśli płatność się nie udała, zapłać ponownie.</p>;
}
