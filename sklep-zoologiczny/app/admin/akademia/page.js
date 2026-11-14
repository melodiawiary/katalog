import { createClient } from '@/lib/supabase/server';
import { needsSql } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Akademia: lista chętnych' };

const INTEREST = { pies: 'Pielęgnacja psów', kot: 'Pielęgnacja kotów', zawodowo: 'Chce pracować jako groomer', inne: 'Inne' };

export default async function AcademyAdmin() {
  const supabase = await createClient();
  const { data, error, count } = await supabase.from('academy_waitlist')
    .select('id, email, interest, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(500);
  if (error) return <p className="alert">{needsSql(error) ? 'Lista czeka na aktualizację bazy (supabase/11_opinie_salonow.sql).' : 'Nie udało się wczytać listy.'}</p>;
  const by = {};
  for (const r of data) by[r.interest] = (by[r.interest] || 0) + 1;
  return (
    <div>
      <h1>Akademia: lista chętnych</h1>
      <p className="muted">Zapisanych: {count || 0}. Każdy zgodził się na kontakt e-mailem w sprawie Akademii (zgoda zapisana z datą). Kopiuj adresy do wiadomości w UDW.</p>
      <p className="small">{Object.entries(by).map(([k, n]) => `${INTEREST[k]}: ${n}`).join(' · ')}</p>
      {!data.length && <p className="box">Nikt jeszcze się nie zapisał.</p>}
      {data.length > 0 && (
        <table className="report-table">
          <thead><tr><th>E-mail</th><th>Zainteresowanie</th><th>Data</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}><td>{r.email}</td><td>{INTEREST[r.interest]}</td><td>{new Date(r.created_at).toLocaleDateString('pl-PL', { timeZone: 'Europe/Warsaw' })}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
