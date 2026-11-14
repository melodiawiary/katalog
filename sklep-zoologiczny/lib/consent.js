// Zgody na cookies / pamięć przeglądarki. Zapis w localStorage pod kluczem 'zgoda-cookies'.
// Dziś sklep używa TYLKO rzeczy niezbędnych (koszyk, dane do zamówienia, paczkomat), więc lista OPTIONAL_CATEGORIES jest pusta
// i baner tylko informuje. Gdy kiedyś dojdą statystyki albo reklamy: dopisz kategorię poniżej, np.
//   { key: 'statystyki', label: 'Statystyki', desc: 'Anonimowe statystyki odwiedzin.' }
// i uruchamiaj skrypt tylko gdy hasConsent('statystyki') jest prawdą. Baner sam pokaże wybór.
export const CONSENT_KEY = 'zgoda-cookies';
export const CONSENT_VERSION = 1;
export const OPTIONAL_CATEGORIES = [];

export function readConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    if (c && c.v === CONSENT_VERSION) return c;
  } catch { /* brak zapisu */ }
  return null;
}

export function saveConsent(choices = {}) {
  const c = { v: CONSENT_VERSION, at: new Date().toISOString(), ...choices };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(c)); } catch { /* bez pamięci */ }
  window.dispatchEvent(new CustomEvent('consent-changed', { detail: c }));
  return c;
}

export function hasConsent(key) {
  const c = typeof window === 'undefined' ? null : readConsent();
  return Boolean(c && c[key]);
}

export const OPEN_EVENT = 'open-cookie-settings';
