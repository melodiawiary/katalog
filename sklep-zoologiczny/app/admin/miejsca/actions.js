'use server';

// Panel katalogu groomerów (tabele z 09_miejsca.sql)
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminClient } from '@/lib/admin-server';
import {
  PLACE_KIND, PLACE_STATUS, SPECIES, SIZE_CLASS, PLACE_REQUEST_STATUS,
  LAT_RANGE, LNG_RANGE, isTime, money,
} from '@/lib/places';

const UA = 'sklep-zoologiczny/1.0 (panel katalogu groomerow)';

const str = (fd, key, max) => String(fd.get(key) || '').trim().slice(0, max);

// Komunikaty bazy po polsku (check-i tabeli places i trigger przełącznika)
function friendly(error) {
  const m = error?.message || '';
  if (/places_publish_ck/.test(m)) {
    return 'Do publikacji potrzebne jest miasto i adres (groomer mobilny: wystarczy miasto). Zapisz jako szkic albo uzupełnij dane.';
  }
  if (/places_slug_key/.test(m)) return 'Taki adres strony już istnieje.';
  if (/places_lat_check|places_lng_check/.test(m)) return 'Współrzędne poza Polską. Sprawdź pinezkę na mapie.';
  if (/places_email_check/.test(m)) return 'Niepoprawny adres e-mail salonu.';
  if (/places_(website|booking_url|instagram|facebook)_check/.test(m)) return 'Linki muszą zaczynać się od http:// lub https://.';
  if (/place_hours_check|closes/.test(m)) return 'Godzina zamknięcia musi być późniejsza niż otwarcia.';
  return m || 'Nie udało się zapisać.';
}

// "salon.pl" -> "https://salon.pl"; puste zostaje puste
function fixUrl(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

function parseJson(fd, key) {
  try {
    const v = JSON.parse(String(fd.get(key) || '[]'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseCoord(value) {
  const s = String(value ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

// ---------------- zapis miejsca ----------------

export async function savePlace(prev, fd) {
  const supabase = await adminClient();
  const id = Number(fd.get('id')) || null;

  const name = str(fd, 'name', 120);
  if (name.length < 2) return { error: 'Wpisz nazwę (min. 2 znaki).' };

  const kind = String(fd.get('kind') || 'salon');
  if (!PLACE_KIND[kind]) return { error: 'Nieznany rodzaj miejsca.' };
  const status = String(fd.get('status') || 'szkic');
  if (!PLACE_STATUS[status]) return { error: 'Nieznany status.' };

  const species = fd.getAll('species').map(String).filter((s) => SPECIES[s]);
  if (species.length === 0) return { error: 'Zaznacz, jakie zwierzęta przyjmuje (psy, koty).' };
  const features = fd.getAll('features').map(String).filter((f) => /^[a-z0-9-]+$/.test(f)).slice(0, 20);

  const lat = parseCoord(fd.get('lat'));
  const lng = parseCoord(fd.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Brak współrzędnych. Kliknij „Znajdź na mapie” albo ustaw pinezkę na mapie.' };
  }
  if (lat < LAT_RANGE[0] || lat > LAT_RANGE[1] || lng < LNG_RANGE[0] || lng > LNG_RANGE[1]) {
    return { error: 'Współrzędne poza Polską. Sprawdź pinezkę na mapie.' };
  }

  const radiusRaw = String(fd.get('service_radius_km') || '').trim();
  let radius = null;
  if (radiusRaw !== '') {
    radius = Number(radiusRaw);
    if (!Number.isInteger(radius) || radius < 1 || radius > 100) return { error: 'Zasięg dojazdu: liczba km od 1 do 100.' };
  }
  if (kind === 'mobilny' && radius == null) {
    return { error: 'Groomer mobilny: wpisz zasięg dojazdu w km (bez niego nie pokaże się w „blisko mnie”).' };
  }

  // godziny
  const hours = [];
  for (const h of parseJson(fd, 'hours')) {
    const weekday = Number(h.weekday);
    if (!(weekday >= 1 && weekday <= 7)) continue;
    if (!h.opens && !h.closes) continue; // pusty wiersz
    if (!isTime(h.opens) || !isTime(h.closes)) return { error: 'Godziny wpisz jako GG:MM (np. 09:00).' };
    if (h.closes <= h.opens) return { error: 'Godzina zamknięcia musi być późniejsza niż otwarcia.' };
    hours.push({ weekday, opens: h.opens, closes: h.closes });
  }
  hours.sort((a, b) => a.weekday - b.weekday || a.opens.localeCompare(b.opens));
  for (let i = 1; i < hours.length; i++) {
    if (hours[i].weekday === hours[i - 1].weekday && hours[i].opens < hours[i - 1].closes) {
      return { error: 'Przedziały godzin tego samego dnia nachodzą na siebie.' };
    }
  }

  // cennik
  const prices = [];
  let sort = 0;
  for (const p of parseJson(fd, 'prices')) {
    if (!p.service && p.price_from === '' ) continue;
    if (!p.service) return { error: 'W cenniku wybierz usługę przy każdej cenie.' };
    const from = money(p.price_from);
    const to = money(p.price_to);
    if (from == null || Number.isNaN(from)) return { error: 'W cenniku wpisz cenę „od” (np. 80 albo 79,50).' };
    if (Number.isNaN(to)) return { error: 'Cena „do” w cenniku jest niepoprawna.' };
    if (to != null && to < from) return { error: 'Cena „do” nie może być niższa niż „od”.' };
    const size = p.size_class ? String(p.size_class) : null;
    if (size && !SIZE_CLASS[size]) return { error: 'Nieznana wielkość w cenniku.' };
    let duration = null;
    if (String(p.duration_min ?? '').trim() !== '') {
      duration = Number(p.duration_min);
      if (!Number.isInteger(duration) || duration < 5 || duration > 600) return { error: 'Czas usługi: minuty od 5 do 600.' };
    }
    prices.push({
      service: String(p.service),
      size_class: size,
      breed: String(p.breed || '').trim().slice(0, 80) || null,
      price_from: from,
      price_to: to,
      duration_min: duration,
      note: String(p.note || '').trim().slice(0, 300),
      sort: sort++,
    });
  }

  const row = {
    name, kind, status, species, features, lat, lng,
    verified: fd.get('verified') === 'on',
    description: str(fd, 'description', 3000),
    address: str(fd, 'address', 200),
    postal_code: str(fd, 'postal_code', 10),
    city: str(fd, 'city', 80),
    district: str(fd, 'district', 80),
    service_radius_km: radius,
    phone: str(fd, 'phone', 30),
    email: str(fd, 'email', 200),
    website: fixUrl(str(fd, 'website', 300)),
    booking_url: fixUrl(str(fd, 'booking_url', 300)),
    instagram: fixUrl(str(fd, 'instagram', 300)),
    facebook: fixUrl(str(fd, 'facebook', 300)),
  };

  // zapis: miejsce, potem godziny, cennik i dane prywatne (kilka zapytań po kolei)
  let placeId = id;
  if (id) {
    const { error } = await supabase.from('places').update(row).eq('id', id);
    if (error) return { error: friendly(error) };
  } else {
    const { data, error } = await supabase.from('places').insert(row).select('id').single();
    if (error) return { error: friendly(error) };
    placeId = data.id;
  }

  const delH = await supabase.from('place_hours').delete().eq('place_id', placeId);
  if (delH.error) return { error: `Miejsce zapisane, ale godziny nie: ${friendly(delH.error)}` };
  if (hours.length) {
    const { error } = await supabase.from('place_hours').insert(hours.map((h) => ({ ...h, place_id: placeId })));
    if (error) return { error: `Miejsce zapisane, ale godziny nie: ${friendly(error)}` };
  }

  const delP = await supabase.from('place_prices').delete().eq('place_id', placeId);
  if (delP.error) return { error: `Miejsce zapisane, ale cennik nie: ${friendly(delP.error)}` };
  if (prices.length) {
    const { error } = await supabase.from('place_prices').insert(prices.map((p) => ({ ...p, place_id: placeId })));
    if (error) return { error: `Miejsce zapisane, ale cennik nie: ${friendly(error)}` };
  }

  const checked = str(fd, 'last_checked_at', 10);
  const priv = {
    place_id: placeId,
    notes: str(fd, 'notes', 3000),
    contact_person: str(fd, 'contact_person', 120),
    contact_phone: str(fd, 'contact_phone', 30),
    contact_email: str(fd, 'contact_email', 200),
    source_url: str(fd, 'source_url', 500),
    last_checked_at: /^\d{4}-\d{2}-\d{2}$/.test(checked) ? checked : null,
  };
  const { error: privError } = await supabase.from('place_private').upsert(priv, { onConflict: 'place_id' });
  if (privError) return { error: `Miejsce zapisane, ale notatki prywatne nie: ${friendly(privError)}` };

  // godziny i cennik wpływają na bonus za pełny profil: przeliczamy ranking miasta (przed 11_opinie_salonow.sql funkcji nie ma)
  await supabase.rpc('refresh_place_ranking', { p_city: row.city || null });

  // zamknięcie zgłoszenia, z którego powstał ten szkic
  const fromRequest = Number(fd.get('request_id')) || null;
  if (fromRequest && !id) {
    await supabase.from('place_requests').update({ status: 'w_toku', place_id: placeId }).eq('id', fromRequest);
  }

  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
  redirect(`/admin/miejsca/${placeId}?zapisano=1`);
}

// ---------------- status, usuwanie, przełącznik katalogu ----------------

export async function setPlaceStatus(prev, fd) {
  const supabase = await adminClient();
  const status = String(fd.get('status') || '');
  if (!PLACE_STATUS[status]) return { error: 'Nieznany status.' };
  const { error } = await supabase.from('places').update({ status }).eq('id', Number(fd.get('id')));
  if (error) return { error: friendly(error) };
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
  return { ok: true, message: 'Zmieniono.', at: Date.now() };
}

export async function deletePlace(fd) {
  const supabase = await adminClient();
  const { error } = await supabase.from('places').delete().eq('id', Number(fd.get('id')));
  if (error) throw new Error(friendly(error));
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
  redirect('/admin/miejsca');
}

export async function setCatalogPublic(prev, fd) {
  const supabase = await adminClient();
  const enabled = fd.get('public_enabled') === 'on';
  const { error } = await supabase.from('places_config').update({ public_enabled: enabled }).eq('id', true);
  if (error) return { error: friendly(error) };
  revalidatePath('/admin', 'layout');
  revalidatePath('/salony', 'layout');
  return { ok: true, message: enabled ? 'Katalog jest publiczny.' : 'Katalog jest wyłączony (klienci go nie widzą).', at: Date.now() };
}

// ---------------- zgłoszenia ----------------

export async function updatePlaceRequest(prev, fd) {
  const supabase = await adminClient();
  const status = String(fd.get('status') || '');
  if (!PLACE_REQUEST_STATUS[status]) return { error: 'Nieznany status.' };
  const { error } = await supabase
    .from('place_requests')
    .update({ status, admin_note: str(fd, 'admin_note', 1000) })
    .eq('id', Number(fd.get('id')));
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Zapisano.', at: Date.now() };
}

export async function deletePlaceRequest(prev, fd) {
  const supabase = await adminClient();
  const { error } = await supabase.from('place_requests').delete().eq('id', Number(fd.get('id')));
  if (error) return { error: error.message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Usunięto.', at: Date.now() };
}

// ---------------- adres <-> współrzędne (OpenStreetMap Nominatim) ----------------

function pickAddress(a = {}) {
  const road = a.road || a.pedestrian || a.footway || '';
  const street = road ? `${road}${a.house_number ? ` ${a.house_number}` : ''}` : '';
  return {
    street,
    city: a.city || a.town || a.village || a.municipality || '',
    postal_code: a.postcode || '',
    district: a.suburb || a.city_district || a.neighbourhood || a.quarter || '',
  };
}

async function nominatim(path, params) {
  const url = new URL(`https://nominatim.openstreetmap.org/${path}`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'pl');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Wywoływane z formularza: { address, postal_code, city } -> współrzędne i uzupełnienie miasta / kodu / dzielnicy
export async function geocodeAddress({ address = '', postal_code = '', city = '' } = {}) {
  await adminClient();
  const q = [address, [postal_code, city].filter(Boolean).join(' ')].map((s) => String(s || '').trim()).filter(Boolean).join(', ');
  if (q.length < 3) return { error: 'Wpisz adres albo miasto.' };
  try {
    let found = await nominatim('search', { q, countrycodes: 'pl', limit: '1' });
    if (!found?.[0] && address) {
      // czasem pomaga samo miasto, wtedy pinezkę trzeba dosunąć ręcznie
      const fallback = [postal_code, city].filter(Boolean).join(' ').trim();
      if (fallback) {
        found = await nominatim('search', { q: fallback, countrycodes: 'pl', limit: '1' });
        if (found?.[0]) {
          const a = pickAddress(found[0].address);
          return { ok: true, approximate: true, lat: Number(found[0].lat), lng: Number(found[0].lon), ...a };
        }
      }
    }
    if (!found?.[0]) return { error: 'Nie znaleziono tego adresu. Sprawdź pisownię albo ustaw pinezkę ręcznie na mapie.' };
    const a = pickAddress(found[0].address);
    return { ok: true, lat: Number(found[0].lat), lng: Number(found[0].lon), ...a };
  } catch (e) {
    return { error: `Mapa chwilowo nie odpowiada (${e.message}). Spróbuj za chwilę albo ustaw pinezkę ręcznie.` };
  }
}

// Po przeciągnięciu pinezki: adres z miejsca, w którym stoi
export async function reverseGeocode({ lat, lng } = {}) {
  await adminClient();
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { error: 'Zła pozycja.' };
  try {
    const found = await nominatim('reverse', { lat: String(la), lon: String(ln), zoom: '18' });
    if (!found?.address) return { error: 'Brak adresu w tym miejscu.' };
    return { ok: true, ...pickAddress(found.address) };
  } catch (e) {
    return { error: `Mapa chwilowo nie odpowiada (${e.message}).` };
  }
}
