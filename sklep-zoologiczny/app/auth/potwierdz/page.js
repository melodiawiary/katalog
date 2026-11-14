import ConfirmForm from './ConfirmForm';

export const metadata = { title: 'Logowanie', robots: { index: false } };

// Link z e-maila prowadzi tu, a logowanie dzieje się dopiero po kliknięciu przycisku
// (programy pocztowe czasem "otwierają" linki z wyprzedzeniem i zużyłyby jednorazowy link).
export default async function ConfirmPage({ searchParams }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <h1>Logowanie</h1>
      <ConfirmForm tokenHash={String(sp.token_hash || '')} next={String(sp.next || '/konto')} />
    </div>
  );
}
