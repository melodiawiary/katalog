import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { loadFormRefs } from '../loader';
import PlaceForm from '../PlaceForm';

export const metadata = { title: 'Nowe miejsce' };

export default async function NewPlacePage({ searchParams }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const refs = await loadFormRefs(supabase);

  // szkic z zgłoszenia "Poleć salon"
  let place = null;
  let priv = {};
  let requestId = null;
  const reqId = Number(sp.zgloszenie) || null;
  if (reqId) {
    const { data: r } = await supabase.from('place_requests').select('*').eq('id', reqId).maybeSingle();
    if (r) {
      requestId = r.id;
      place = { name: r.place_name, city: r.city, status: 'szkic' };
      priv = {
        notes: [r.details, `Zgłosił(a): ${[r.contact_name, r.contact_email, r.contact_phone].filter(Boolean).join(', ')}`].filter(Boolean).join('\n'),
        source_url: '',
      };
    }
  }

  return (
    <>
      <p className="muted"><Link href="/admin/miejsca">← Salony</Link></p>
      <h1>Nowe miejsce</h1>
      {requestId && <p className="box">Szkic z zgłoszenia nr {requestId}. Szczegóły zgłoszenia są w notatkach prywatnych.</p>}
      <PlaceForm place={place} priv={priv} services={refs.services} featureDefs={refs.featureDefs} requestId={requestId} />
    </>
  );
}
