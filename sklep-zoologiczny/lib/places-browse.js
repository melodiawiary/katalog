// Adres strony /salony <-> parametry funkcji search_places (zgodne z 09_miejsca.sql)
import { PLACE_KIND, SPECIES, SIZE_CLASS } from '@/lib/places';

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const one = (v) => (Array.isArray(v) ? v[0] : v);

export function parsePlaces(sp = {}) {
  const lat = num(one(sp.lat));
  const lng = num(one(sp.lng));
  const hasPos = lat != null && lng != null && lat >= 48 && lat <= 56 && lng >= 13 && lng <= 25;
  const radius = num(one(sp.promien));
  const maxPrice = num(one(sp.cena_max));
  const sort = ['najlepsze', 'opinie', 'odleglosc', 'cena', 'nazwa'].includes(one(sp.sort)) ? one(sp.sort) : '';
  return {
    q: String(one(sp.q) || '').trim().slice(0, 80),
    city: String(one(sp.miasto) || '').trim().slice(0, 80),
    kind: PLACE_KIND[one(sp.rodzaj)] ? one(sp.rodzaj) : '',
    species: SPECIES[one(sp.gatunek)] ? one(sp.gatunek) : '',
    service: /^[a-z0-9_]+$/.test(one(sp.usluga) || '') ? one(sp.usluga) : '',
    size: SIZE_CLASS[one(sp.wielkosc)] ? one(sp.wielkosc) : '',
    maxPrice: maxPrice != null && maxPrice > 0 ? maxPrice : null,
    openNow: one(sp.otwarte) === '1',
    features: String(one(sp.udogodnienia) || '').split(',').filter((f) => /^[a-z0-9-]+$/.test(f)).slice(0, 10),
    lat: hasPos ? lat : null,
    lng: hasPos ? lng : null,
    where: String(one(sp.gdzie) || '').trim().slice(0, 100),
    radius: radius != null && radius > 0 && radius <= 200 ? radius : null,
    sort,
  };
}

export function rpcArgs(f, perPage = 200) {
  return {
    p_lat: f.lat,
    p_lng: f.lng,
    p_radius_km: f.lat != null ? f.radius : null,
    p_q: f.q,
    p_city: f.city || null,
    p_kind: f.kind || null,
    p_species: f.species || null,
    p_features: f.features,
    p_service: f.service || null,
    p_size: f.size || null,
    p_max_price: f.maxPrice,
    p_open_now: f.openNow,
    p_sort: f.sort || null,
    p_page: 1,
    p_per_page: perPage,
  };
}

export const money = (n) => `${Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;

export function priceText(p) {
  return p.price_to != null && Number(p.price_to) > Number(p.price_from)
    ? `${money(p.price_from)} - ${money(p.price_to)}`
    : `od ${money(p.price_from)}`;
}

// Godziny z place_page (tablica po 1 wierszu na przedział) -> { 1: '09:00-17:00, 18:00-20:00', ... }
export function hoursByDay(hours = []) {
  const out = {};
  for (const h of hours) out[h.weekday] = [out[h.weekday], `${h.opens}-${h.closes}`].filter(Boolean).join(', ');
  return out;
}
