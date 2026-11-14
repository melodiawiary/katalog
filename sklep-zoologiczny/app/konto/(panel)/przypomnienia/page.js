import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { SPECIES_ICON } from '@/lib/pets';
import ReminderForm from '@/components/account/ReminderForm';
import ConfirmButton from '@/components/admin/ConfirmButton';
import { setRemindersEnabled, updateReminder } from '../../actions';

export const metadata = { title: 'Przypomnienia o karmie', robots: { index: false } };

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
const addDays = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

export default async function RemindersPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser('/konto/przypomnienia');

  const [{ data: profile }, { data: reminders }, { data: pets }, { data: bought }] = await Promise.all([
    supabase.from('customer_profiles').select('reminders_enabled').eq('user_id', user.id).maybeSingle(),
    supabase.from('reminders')
      .select('id, interval_days, lead_days, anchor_date, active, pet_id, variant_id, pets(name, species), product_variants(id, name, stock, products(name, slug))')
      .order('anchor_date'),
    supabase.from('pets').select('id, name, species').order('created_at'),
    supabase.from('order_items')
      .select('variant_id, product_name, variant_name, orders!inner(status)')
      .not('variant_id', 'is', null).neq('orders.status', 'anulowane').limit(200),
  ]);
  const enabled = profile?.reminders_enabled !== false;
  const taken = new Set((reminders || []).map((r) => r.variant_id));
  const options = [...new Map((bought || []).filter((b) => !taken.has(b.variant_id))
    .map((b) => [b.variant_id, { id: b.variant_id, label: `${b.product_name}${b.variant_name ? ` (${b.variant_name})` : ''}` }])).values()];
  const preset = Number(sp.dodaj) || null;

  return (
    <div>
      <h1>Przypomnienia o karmie</h1>
      <p className="muted">Podaj, na ile dni starcza Ci opakowanie, a napiszemy kilka dni przed końcem, z linkiem do ponownego zamówienia.
        Dni liczymy od ostatniego zakupu tego produktu u nas.</p>

      {!enabled && (
        <form action={setRemindersEnabled} className="box">
          <input type="hidden" name="enabled" value="1" />
          <p>Wszystkie przypomnienia są wyłączone. Nie wyślemy żadnej wiadomości.</p>
          <button className="btn btn-small">Włącz przypomnienia</button>
        </form>
      )}

      {(reminders || []).length === 0 && <p className="box">Nie masz jeszcze przypomnień.</p>}

      {(reminders || []).map((r) => {
        const v = r.product_variants;
        const name = v ? `${v.products?.name}${v.name ? ` (${v.name})` : ''}` : 'Produkt wycofany ze sklepu';
        const ends = addDays(r.anchor_date, r.interval_days);
        const remindOn = addDays(ends, -r.lead_days);
        return (
          <section key={r.id} className={`box reminder-card${r.active ? '' : ' row-off'}`}>
            <h2>{v?.products?.slug ? <Link href={`/produkt/${v.products.slug}?wariant=${v.id}`}>{name}</Link> : name}</h2>
            <p className="muted">
              {r.pets && <>{SPECIES_ICON[r.pets.species]} {r.pets.name} · </>}
              starcza na {r.interval_days} dni (od {fmt(r.anchor_date)}) ·
              {r.active ? <> przypomnimy około {fmt(remindOn)}</> : ' wstrzymane'}
            </p>
            <div className="row-actions">
              <form action={updateReminder} className="inline-form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="op" value="days" />
                <label className="small">Dni <input name="interval_days" type="number" min="7" max="365" defaultValue={r.interval_days} className="narrow" /></label>
                <button className="btn btn-small btn-light">Zmień</button>
              </form>
              <form action={updateReminder}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="op" value="bought" />
                <button className="link-btn" title="Liczymy od dziś">Mam nowe opakowanie (liczymy od dziś)</button>
              </form>
              <form action={updateReminder}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="op" value={r.active ? 'pause' : 'resume'} />
                <button className="link-btn">{r.active ? 'Wstrzymaj' : 'Wznów'}</button>
              </form>
              <form action={updateReminder}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="op" value="delete" />
                <ConfirmButton message="Usunąć to przypomnienie?">Usuń</ConfirmButton>
              </form>
            </div>
          </section>
        );
      })}

      <section className="box">
        <h2>Dodaj przypomnienie</h2>
        {options.length === 0 ? (
          <p className="muted">Przypomnienie można ustawić dla produktu, który kupiłeś na tym koncie. Po pierwszym zamówieniu pojawi się tu lista.</p>
        ) : (
          <ReminderForm options={options} pets={pets || []} preset={preset} />
        )}
      </section>
    </div>
  );
}
