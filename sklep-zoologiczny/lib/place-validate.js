// Wspólna walidacja godzin i cennika (panel admina i panel właściciela). Zwraca { error } albo { hours } / { prices }.
import { SIZE_CLASS, isTime, money } from '@/lib/places';

export function parseJsonList(raw) {
  try {
    const v = JSON.parse(String(raw || '[]'));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function validateHours(list) {
  const hours = [];
  for (const h of list) {
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
  return { hours };
}

export function validatePrices(list) {
  const prices = [];
  let sort = 0;
  for (const p of list) {
    if (!p.service && p.price_from === '') continue;
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
  return { prices };
}
