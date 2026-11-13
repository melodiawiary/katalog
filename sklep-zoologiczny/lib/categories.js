// Kategorie drzewem (kolumna parent_id z supabase/02_produkty.sql).
// Działa też przed uruchomieniem tego pliku SQL: wtedy wszystkie kategorie są główne.

export function topCategories(categories = []) {
  return categories.filter((c) => !c.parent_id);
}

// Id kategorii i wszystkich jej podkategorii (do filtrowania produktów)
export function categoryWithDescendants(categories = [], id) {
  const ids = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return [...ids];
}

// Lista do <select>: kolejność drzewa i poziom zagłębienia
export function categoryTree(categories = []) {
  const children = new Map();
  for (const c of categories) {
    const key = c.parent_id || 0;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(c);
  }
  for (const list of children.values()) {
    list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'pl'));
  }
  const result = [];
  const seen = new Set();
  function walk(parentKey, depth) {
    for (const c of children.get(parentKey) || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      result.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(0, 0);
  // kategorie z nieistniejącym rodzicem (na wszelki wypadek) na końcu
  for (const c of categories) if (!seen.has(c.id)) result.push({ ...c, depth: 0 });
  return result;
}

// Ścieżka od kategorii głównej do podanej (okruszki na stronie produktu)
export function categoryPath(categories = [], id) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path = [];
  let current = byId.get(id);
  while (current && path.length < 10) {
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return path;
}

// Kategorie widoczne w sklepie: bez ukrytych w panelu (i ich podkategorii)
export function visibleCategories(categories = []) {
  const hidden = new Set(
    categories.filter((c) => c.active === false).flatMap((c) => categoryWithDescendants(categories, c.id))
  );
  return categories.filter((c) => !hidden.has(c.id));
}
