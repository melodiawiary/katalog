import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClaimForm from './ClaimForm';
import WithdrawButton from './WithdrawButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'To mój salon', robots: { index: false } };

export default async function ClaimPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: info } = await supabase.rpc('place_claim_info', { p_slug: slug });
  if (!info) notFound();
  const p = info.place;
  const c = info.claim;

  return (
    <div className="container narrow">
      <nav className="breadcrumbs"><Link href={`/salony/${slug}`}>{p.name}</Link> / To mój salon</nav>
      <h1>To mój salon</h1>
      <p className="muted">{p.name}, {p.city}</p>

      {!info.logged_in ? (
        <div className="box">
          <p>Żeby zgłosić salon, zaloguj się. Zajmie to chwilę i nie wymaga hasła.</p>
          <Link className="btn" href={`/konto/logowanie?next=${encodeURIComponent(`/salony/${slug}/przejmij`)}`}>Zaloguj się</Link>
        </div>
      ) : info.is_owner ? (
        <div className="ok-box">
          <p>Ten salon jest już na Twoim koncie.</p>
          <Link className="btn" href={`/konto/salon/${slug}`}>Panel salonu</Link>
        </div>
      ) : c?.status === 'oczekuje_admina' ? (
        <div className="box stack-form">
          <p><strong>Twoje zgłoszenie czeka na sprawdzenie.</strong> Odpiszemy na adres z Twojego konta.</p>
          <WithdrawButton slug={slug} claimId={c.id} />
        </div>
      ) : (
        <>
          {c?.status === 'odrzucone' && (
            <p className="alert">Poprzednie zgłoszenie zostało odrzucone{c.admin_note ? `: ${c.admin_note}` : '.'} Możesz spróbować jeszcze raz z lepszym potwierdzeniem.</p>
          )}
          {info.owners_count > 0 && (
            <p className="warn">Ten salon ma już opiekuna w katalogu. Twoje zgłoszenie sprawdzimy ręcznie, a obecny opiekun dostanie o nim informację.</p>
          )}
          <p>Dzięki profilowi możesz poprawiać dane, godziny i ceny, dodawać zdjęcia i odpowiadać na opinie. Wystarczy potwierdzić, że salon jest Twój.</p>
          <ClaimForm info={info} slug={slug} />
        </>
      )}
    </div>
  );
}
