-- Kategorie startowe: gryzonie, ptaki, akwarystyka (psy i koty mają swoje od 02_produkty.sql).
-- Adres kategorii ma postać zwierzę-rodzaj: po nim sklep dobiera ikonę (lib/category-icons.js).
-- Można zmieniać nazwy i kolejność w panelu; po imporcie z hurtowni część kategorii może się zmienić.
insert into public.categories (parent_id, slug, name, emoji, sort)
select p.id, v.slug, v.name, p.emoji, v.sort
from (values
  ('gryzonie', 'gryzonie-karma',        'Karma',                  1),
  ('gryzonie', 'gryzonie-przysmaki',    'Przysmaki i warzywa',    2),
  ('gryzonie', 'gryzonie-klatki',       'Klatki',                 3),
  ('gryzonie', 'gryzonie-domki',        'Domki i akcesoria',      4),
  ('gryzonie', 'gryzonie-sciolka',      'Ściółka i siano',        5),
  ('gryzonie', 'gryzonie-zabawki',      'Zabawki i kołowrotki',   6),
  ('gryzonie', 'gryzonie-miski',        'Miski i poidła',         7),
  ('gryzonie', 'gryzonie-pielegnacja',  'Pielęgnacja',            8),
  ('ptaki', 'ptaki-karma',              'Karma',                  1),
  ('ptaki', 'ptaki-proso',              'Proso i kolby',          2),
  ('ptaki', 'ptaki-klatki',             'Klatki i woliery',       3),
  ('ptaki', 'ptaki-zerdzie',            'Żerdki',                 4),
  ('ptaki', 'ptaki-zabawki',            'Zabawki',                5),
  ('ptaki', 'ptaki-higiena',            'Higiena i pielęgnacja',  6),
  ('ptaki', 'ptaki-zdrowie',            'Zdrowie i witaminy',     7),
  ('ptaki', 'ptaki-poidla',             'Poidła i karmniki',      8),
  ('akwarystyka', 'akwarystyka-karma',          'Karma dla ryb',            1),
  ('akwarystyka', 'akwarystyka-akwaria',        'Akwaria i szafki',         2),
  ('akwarystyka', 'akwarystyka-filtry',         'Filtry',                   3),
  ('akwarystyka', 'akwarystyka-grzalki',        'Grzałki i termometry',     4),
  ('akwarystyka', 'akwarystyka-oswietlenie',    'Oświetlenie',              5),
  ('akwarystyka', 'akwarystyka-napowietrzanie', 'Napowietrzanie',           6),
  ('akwarystyka', 'akwarystyka-dekoracje',      'Dekoracje i rośliny',      7),
  ('akwarystyka', 'akwarystyka-woda',           'Uzdatniacze i testy wody', 8),
  ('akwarystyka', 'akwarystyka-akcesoria',      'Akcesoria',                9)
) as v(parent_slug, slug, name, sort)
join public.categories p on p.slug = v.parent_slug and p.parent_id is null
on conflict (slug) do nothing;
