'use client';

import { useState } from 'react';

// Zakładki: Opis / Skład / Analiza / Dawkowanie / Szczegóły.
// tabs: [{ key, label, text?, rows?: [[nazwa, wartość]] }] - puste zakładki nie przychodzą.
// Treść wszystkich zakładek jest w HTML strony (dobre dla Google), widoczna jest jedna.
export default function ProductTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0]?.key);
  if (tabs.length === 0) return null;

  return (
    <section className="tabs">
      <div className="tab-list" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls={`panel-${t.key}`}
            aria-selected={active === t.key} className={active === t.key ? 'tab on' : 'tab'} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`panel-${t.key}`} aria-labelledby={`tab-${t.key}`}
          hidden={active !== t.key} className="tab-panel">
          {t.blocks?.map((b, i) => (
            <div key={i} className="tab-block">
              {b.title && <h3>{b.title}</h3>}
              <p className="description">{b.text}</p>
            </div>
          ))}
          {t.rows && (
            <table className="spec">
              <tbody>
                {t.rows.map(([k, val], i) => (
                  <tr key={i}><th scope="row">{k}</th><td>{val}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </section>
  );
}
