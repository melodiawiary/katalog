'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

// Przesuwany palcem pasek na górze strony startowej: 3 plansze (informacje, kategorie, skróty) z kropkami.
// Bez automatycznego przewijania: klient sam decyduje, co czyta (dostępność).
const CATEGORY_ICONS = { psy: 'psy', koty: 'koty', gryzonie: 'gryzonie', ptaki: 'ptaki', akwarystyka: 'akwarystyka' };

export default function HomeStrip({ freeFrom, categories, showSalons }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);

  const info = [
    { icon: 'dostawa', label: `Darmowa dostawa od ${freeFrom} zł` },
    { icon: 'wysylka', label: 'Szybka wysyłka' },
    { icon: 'zwrot', label: '14 dni na zwrot' },
    { icon: 'blik', label: 'BLIK i szybkie przelewy' },
  ];
  const cats = categories.map((c) => ({ href: `/kategoria/${c.slug}`, icon: CATEGORY_ICONS[c.slug], label: c.name.replace('Akwarystyka', 'Akwa\u00ADrystyka') }));
  const quick = [
    { href: '/sklep', icon: 'sklep', label: 'Sklep', sub: 'zakupy' },
    ...(showSalons ? [{ href: '/salony', icon: 'groomerzy', label: 'Groomerzy', sub: 'pielęgnacja' }] : []),
    { href: '/akademia', icon: 'akademia', label: 'Akademia', sub: 'porady' },
    { href: '/sklep?sort=nowosci', icon: 'promocje', label: 'Promocje i nowości' },
  ];
  const slides = [
    { name: 'Informacje o zakupach', items: info },
    ...(cats.length ? [{ name: 'Kategorie', items: cats }] : []),
    { name: 'Skróty', items: quick },
  ];

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' });

  return (
    <section className="home-strip" aria-label="Skróty i informacje">
      <div className="home-strip-track" ref={ref} onScroll={onScroll}>
        {slides.map((s, i) => (
          <ul key={s.name} className="home-strip-slide" aria-label={s.name} data-count={s.items.length}>
            {s.items.map((it) => {
              const inner = (
                <>
                  {it.icon && <img src={`/ikony/start/${it.icon}.png`} alt="" height="64" loading={i === 0 ? 'eager' : 'lazy'} />}
                  <span className="home-strip-label">{it.label}</span>
                  {it.sub && <span className="home-strip-sub">({it.sub})</span>}
                </>
              );
              return (
                <li key={it.label}>
                  {it.href ? <Link href={it.href} className="home-strip-item">{inner}</Link> : <div className="home-strip-item">{inner}</div>}
                </li>
              );
            })}
          </ul>
        ))}
      </div>
      <div className="home-strip-dots">
        {slides.map((s, i) => (
          <button key={s.name} type="button" className={i === active ? 'on' : ''} aria-label={`${s.name}, plansza ${i + 1} z ${slides.length}`} aria-current={i === active} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  );
}
