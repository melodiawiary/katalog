// "Wyślemy dziś / jutro" - liczone w strefie Europe/Warsaw, z polskimi świętami.
// Ustawienia (panel /admin/ustawienia): ship_cutoff (np. "13:00") i ship_handling_days (0 = tego samego dnia).

const TZ = 'Europe/Warsaw';
const DAY = 86400000;

function warsawNow(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    day: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// Wielkanoc (algorytm Meeusa / Jonesa / Butchera)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}

const holidayCache = {};
function holidays(y) {
  if (!holidayCache[y]) {
    const e = easter(y);
    const fixed = ['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-25', '12-26'];
    if (y >= 2025) fixed.push('12-24'); // Wigilia wolna od 2025 r.
    holidayCache[y] = new Set([
      ...fixed.map((md) => Date.UTC(y, Number(md.slice(0, 2)) - 1, Number(md.slice(3)))),
      e + DAY,      // Poniedziałek Wielkanocny
      e + 60 * DAY, // Boże Ciało
    ]);
  }
  return holidayCache[y];
}

export function isWorkday(day) {
  const wd = new Date(day).getUTCDay();
  return wd !== 0 && wd !== 6 && !holidays(new Date(day).getUTCFullYear()).has(day);
}

function nextWorkday(day) {
  let d = day + DAY;
  while (!isWorkday(d)) d += DAY;
  return d;
}

const WEEKDAY = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];

function dayLabel(day, today) {
  const diff = Math.round((day - today) / DAY);
  if (diff === 0) return 'dziś';
  if (diff === 1) return 'jutro';
  const d = new Date(day);
  const date = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  if (diff < 7) return `${WEEKDAY[d.getUTCDay()]} (${date})`;
  return date;
}

function parseCutoff(cutoff) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(cutoff || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 13 * 60;
}

// { ship: 'dziś', delivery: 'jutro', minutesLeft: 135 | null }
export function shippingInfo(now = new Date(), cutoff = '13:00', handlingDays = 0) {
  const { day: today, minutes } = warsawNow(now);
  const limit = parseCutoff(cutoff);
  let ship = isWorkday(today) && minutes < limit ? today : nextWorkday(today);
  for (let i = 0; i < Math.min(Math.max(Number(handlingDays) || 0, 0), 14); i++) ship = nextWorkday(ship);
  const delivery = nextWorkday(ship);
  return {
    ship: dayLabel(ship, today),
    delivery: dayLabel(delivery, today),
    minutesLeft: ship === today ? limit - minutes : null,
  };
}

export function formatLeft(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} godz.` : `${h} godz. ${m} min`;
}
