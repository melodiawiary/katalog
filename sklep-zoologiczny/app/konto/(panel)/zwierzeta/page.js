import Link from 'next/link';
import { requireUser } from '@/lib/account';
import { ageText, shopLink, lifeStage, dogSize, SPECIES, SPECIES_ICON } from '@/lib/pets';
import PetForm from '@/components/account/PetForm';
import { deletePet } from '../../actions';
import ConfirmButton from '@/components/admin/ConfirmButton';

export const metadata = { title: 'Moje zwierzęta', robots: { index: false } };

const STAGE = { junior: 'szczenię / kocię', dorosly: 'dorosły', senior: 'senior' };

export default async function PetsPage() {
  const { supabase } = await requireUser('/konto/zwierzeta');
  const { data: pets } = await supabase.from('pets').select('*').order('created_at');
  return (
    <div>
      <h1>Moje zwierzęta</h1>
      <p className="muted">Na tej podstawie podpowiemy karmę dla wieku i wielkości zwierzaka oraz policzymy, kiedy skończy się opakowanie.
        Wszystkie pola poza imieniem są dobrowolne.</p>

      {(pets || []).map((p) => {
        const link = shopLink(p);
        const stage = lifeStage(p);
        return (
          <section key={p.id} className="box pet-card">
            <h2>{SPECIES_ICON[p.species]} {p.name}</h2>
            <p className="muted">
              {[SPECIES[p.species], p.breed, p.birth_date && ageText(p.birth_date), p.weight_kg && `${String(p.weight_kg).replace('.', ',')} kg`]
                .filter(Boolean).join(' · ')}
              {stage && <> · etap: {STAGE[stage]}</>}
              {p.species === 'pies' && dogSize(p.weight_kg) && <> · wielkość: {dogSize(p.weight_kg)}</>}
            </p>
            {link && <p><Link href={link} className="btn btn-small">Karma dla: {p.name}</Link></p>}
            <details>
              <summary>Edytuj</summary>
              <PetForm pet={p} />
            </details>
            <form action={deletePet}>
              <input type="hidden" name="id" value={p.id} />
              <ConfirmButton message={`Usunąć ${p.name}?`}>Usuń zwierzaka</ConfirmButton>
            </form>
          </section>
        );
      })}

      <section className="box">
        <h2>Dodaj zwierzaka</h2>
        <PetForm />
      </section>
    </div>
  );
}
