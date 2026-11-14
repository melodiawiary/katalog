import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { needsSql, cleanSearch } from '@/lib/admin';
import { PLACE_KIND, PLACE_STATUS, PLACE_STATUS_CLASS } from '@/lib/places';
import ActionForm from '@/components/admin/ActionForm';
import { setPlaceStatus, setCatalogPublic } from './actions';

export const metadata = { title: 'Salony i groomerzy' };

const PER_PAGE = 40;

export default async function PlacesAdminPage({ searchParams }) {
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const status = PLACE_STATUS[sp.status] ? sp.status : '';
  const kind = PLACE_KIND[sp.kind] ? sp.kind : '';
  const page = Math.max(Number(sp.strona) || 1, 1);

  const supabase = await createClient();
  const cfgRes = await supabase.from('places_config').select('public_enabled, min_published').maybeSingle();
  if (needsSql(cfgRes.error)) {
    return (<><h1>Salony i groomerzy</h1><p className="alert">Baza nie ma tabel katalogu. Uruchom supabase/09_miejsca.sql.</p></>);
  }
  const cfg = cfgRes.data || { public_enabled: false, min_published: 20 };

  let query = supabase.from('places')
    .select('id, slug, name, kind, status, city, district, address, species, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status) query = query.eq('status', status);
  if (kind) query = query.eq('kind', kind);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,district.ilike.%${q}%,address.ilike.%${q}%`);

  const [list, pub, drafts, hidden, news] = await Promise.all([
    query,
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'opublikowany'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'szkic'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'ukryty'),
    supabase.from('place_requests').select('id', { count: 'exact', head: true }).eq('status', 'nowe'),
  ]);
  const rows = list.data || [];
  const total = list.count || 0;
  const pages = Math.max(Math.ceil(total / PER_PAGE), 1);
  const published = pub.count || 0;
  const enough = published >= cfg.min_published;

  const link = (patch) => {
    const p = new URLSearchParams();
    const m = { q, status, kind, strona: page > 1 ? String(page) : '', ...patch };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/miejsca${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <div className="title-row">
        <h1>Salony i groomerzy</h1>
        <Link href="/admin/miejsca/nowe" className="btn btn-small">+ Dodaj miejsce</Link>
      </div>

      <div className="box catalog-switch">
        <strong>Katalog dla klientów: {cfg.public_enabled ? 'WŁĄCZONY' : 'wyłączony'}</strong>
        <p className="small">
          Opublikowane miejsca: <strong>{published}</strong> z wymaganych {cfg.min_published}.
          {!cfg.public_enabled && !enough && <> Katalog da się włączyć dopiero po opublikowaniu {cfg.min_published - published} kolejnych.</>}
          {' '}Dopóki jest wyłączony, strony /salony widzisz tylko Ty (jako podgląd).
        </p>
        <ActionForm action={setCatalogPublic} submitLabel="Zapisz">
          <label className="radio">
            <input type="checkbox" name="public_enabled" defaultChecked={cfg.public_enabled} disabled={!cfg.public_enabled && !enough} />
            Katalog publiczny (klienci widzą /salony)
          </label>
        </ActionForm>
      </div>

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
              {PLACE_KIND[p.kind]} · {[p.district, p.city].filter(Boolean).join(', ') || 'brak miasta'}
              {p.address && <> · {p.address}</>} · {p.species.map((s) => (s === 'kot' ? 'koty' : 'psy')).join(' i ')}
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
