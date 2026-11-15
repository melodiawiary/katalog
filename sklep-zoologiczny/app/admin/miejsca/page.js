import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql, cleanSearch } from '@/lib/admin';
import { PLACE_KIND, PLACE_STATUS, PLACE_STATUS_CLASS } from '@/lib/places';
import { PLACE_CATEGORIES, kindLabel } from '@/lib/place-categories';
import ActionForm from '@/components/admin/ActionForm';
import { setPlaceStatus, setCatalogPublic } from './actions';

export const metadata = { title: 'Miejsca w katalogu' };

const PER_PAGE = 40;

export default async function PlacesAdminPage({ searchParams }) {
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const status = PLACE_STATUS[sp.status] ? sp.status : '';
  const kind = PLACE_KIND[sp.kind] ? sp.kind : '';
  const category = PLACE_CATEGORIES[sp.kategoria] ? sp.kategoria : '';
  const page = Math.max(Number(sp.strona) || 1, 1);

  const supabase = await createClient();
  const cfgRes = await supabase.from('places_config').select('public_enabled, min_published').maybeSingle();
  if (needsSql(cfgRes.error)) {
    return (<><h1>Miejsca w katalogu</h1><p className="alert">Baza nie ma tabel katalogu. Uruchom supabase/09_miejsca.sql.</p></>);
  }
  const cfg = cfgRes.data || { public_enabled: false, min_published: 5 };

  let query = supabase.from('places')
    .select('id, slug, name, kind, category, status, city, district, address, species, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status) query = query.eq('status', status);
  if (kind) query = query.eq('kind', kind);
  if (category) query = query.eq('category', category);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,district.ilike.%${q}%,address.ilike.%${q}%`);

  const [list, pub, drafts, hidden, news, pubCities] = await Promise.all([
    query,
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'opublikowany'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'szkic'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'ukryty'),
    supabase.from('place_requests').select('id', { count: 'exact', head: true }).eq('status', 'nowe'),
    supabase.from('places').select('city').eq('status', 'opublikowany').not('city', 'is', null).limit(5000),
  ]);
  const rows = list.data || [];
  const total = list.count || 0;
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const published = pub.count || 0;
  const perCity = {};
  for (const r of pubCities.data || []) {
    const c = String(r.city || '').trim();
    if (c) perCity[c] = (perCity[c] || 0) + 1;
  }
  const best = Object.entries(perCity).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const enough = best[1] >= cfg.min_published;

  const link = (patch) => {
    const p = new URLSearchParams();
    const m = { q, status, kind, kategoria: category, strona: page > 1 ? String(page) : '', ...patch };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/miejsca${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <div className="title-row">
        <h1>Miejsca w katalogu</h1>
        <span className="inline-form">
          <Link href="/admin/miejsca/nowe?kategoria=groomer" className="btn btn-small">+ Groomer</Link>{' '}
          <Link href="/admin/miejsca/nowe?kategoria=weterynarz" className="btn btn-small">+ Weterynarz</Link>{' '}
          <Link href="/admin/miejsca/nowe?kategoria=hotel" className="btn btn-small">+ Hotel</Link>
        </span>
      </div>

      <div className="box catalog-switch">
        <strong>Katalog dla klientów: {cfg.public_enabled ? 'WŁĄCZONY' : 'wyłączony'}</strong>
        <p className="small">
          Opublikowane miejsca: <strong>{published}</strong>. Próg włączenia: {cfg.min_published} w jednym mieście
          {best[1] > 0 && <> (najwięcej: {best[0]}, {best[1]})</>}.
          {!cfg.public_enabled && !enough && <> Katalog da się włączyć po opublikowaniu jeszcze {cfg.min_published - best[1]} w jednym mieście.</>}
          {' '}Dopóki jest wyłączony, strony /salony, /weterynarze i /hotele widzisz tylko Ty (jako podgląd).
        </p>
        <ActionForm action={setCatalogPublic} submitLabel="Zapisz">
          <label className="radio">
            <input type="checkbox" name="public_enabled" defaultChecked={cfg.public_enabled} disabled={!cfg.public_enabled && !enough} />
            Katalog publiczny (klienci widzą /salony, /weterynarze, /hotele)
          </label>
        </ActionForm>
      </div>

      <nav className="chips">
        {Object.values(PLACE_CATEGORIES).map((c) => (
          <Link key={c.key} href={link({ kategoria: category === c.key ? '' : c.key, kind: '', strona: '' })} className={category === c.key ? 'chip active' : 'chip'}>{c.chip}</Link>
        ))}
      </nav>
      <nav className="chips">
        <Link href={link({ status: '', strona: '' })} className={!status ? 'chip active' : 'chip'}>Wszystkie</Link>
        <Link href={link({ status: 'opublikowany', strona: '' })} className={status === 'opublikowany' ? 'chip active' : 'chip'}>Opublikowane ({published})</Link>
        <Link href={link({ status: 'szkic', strona: '' })} className={status === 'szkic' ? 'chip active' : 'chip'}>Szkice ({drafts.count || 0})</Link>
        <Link href={link({ status: 'ukryty', strona: '' })} className={status === 'ukryty' ? 'chip active' : 'chip'}>Ukryte ({hidden.count || 0})</Link>
        <Link href="/admin/miejsca/zgloszenia" className="chip">Zgłoszenia{news.count > 0 ? ` (${news.count} nowych)` : ''}</Link>
      </nav>

      <form className="search" action="/admin/miejsca">
        <input type="search" name="q" defaultValue={q} placeholder="Szukaj: nazwa, miasto, dzielnica, ulica" />
        {status && <input type="hidden" name="status" value={status} />}
        {category && <input type="hidden" name="kategoria" value={category} />}
        <select name="kind" defaultValue={kind} aria-label="Rodzaj">
          <option value="">Każdy rodzaj</option>
          {Object.entries(PLACE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn btn-small">Szukaj</button>
      </form>

      {rows.length === 0 && (
        <p className="muted">{total === 0 && !q && !status && !kind ? 'Nie ma jeszcze żadnego miejsca. Dodaj pierwsze przyciskiem u góry.' : 'Nic nie pasuje do filtrów.'}</p>
      )}

      {rows.map((p) => (
        <div key={p.id} className="order place-row">
          <div className="place-row-main">
            <Link href={`/admin/miejsca/${p.id}`}><strong>{p.name}</strong></Link>
            <span className="small muted">
              {PLACE_CATEGORIES[p.category]?.chip} · {kindLabel(p.kind, p.category)} · {[p.district, p.city].filter(Boolean).join(', ') || 'brak miasta'}
              {p.address && <> · {p.address}</>} · {p.category === 'weterynarz' ? 'wszystkie zwierzęta' : p.species.map((s) => (s === 'kot' ? 'koty' : 'psy')).join(' i ')}
            </span>
          </div>
          <div className="place-row-end">
            <span className={`status ${PLACE_STATUS_CLASS[p.status]}`}>{PLACE_STATUS[p.status]}</span>
            {p.status !== 'opublikowany' && (
              <ActionForm action={setPlaceStatus} submitLabel="Publikuj" className="inline-form">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="opublikowany" />
              </ActionForm>
            )}
            {p.status === 'opublikowany' && (
              <ActionForm action={setPlaceStatus} submitLabel="Ukryj" className="inline-form">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="ukryty" />
              </ActionForm>
            )}
            <Link href={`/admin/miejsca/${p.id}`} className="small">Edytuj</Link>
          </div>
        </div>
      ))}

      {pages > 1 && (
        <div className="pager">
          {page > 1 ? <Link href={link({ strona: page > 2 ? String(page - 1) : '' })}>← Nowsze</Link> : <span />}
          <span className="muted">Strona {page} z {pages} ({total})</span>
          {page < pages ? <Link href={link({ strona: String(page + 1) })}>Starsze →</Link> : <span />}
        </div>
      )}
    </>
  );
}
