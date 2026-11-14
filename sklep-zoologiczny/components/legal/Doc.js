import Link from 'next/link';
import { LEGAL_DATE_PL, LEGAL_LINKS, missingForLegal } from '@/lib/legal';

// Wartość z ustawień albo widoczny znacznik braku
export function Val({ v, label }) {
  const text = String(v ?? '').trim();
  if (text) return <>{text}</>;
  return <mark className="legal-missing">[uzupełnij w ustawieniach: {label}]</mark>;
}

export default function Doc({ title, settings, children }) {
  const missing = missingForLegal(settings);
  return (
    <article className="legal">
      <nav className="legal-nav" aria-label="Dokumenty">
        {LEGAL_LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
      </nav>
      <h1>{title}</h1>
      <p className="muted">Wersja z dnia {LEGAL_DATE_PL}</p>
      {!settings.sales_enabled && (
        <p className="legal-draft">Wersja robocza: sklep jeszcze nie sprzedaje, a dokument nie został jeszcze sprawdzony przez prawnika.</p>
      )}
      {missing.length > 0 && (
        <p className="legal-draft">Uzupełnij dane firmy w panelu (Ustawienia). Brakuje: {missing.join(', ')}.</p>
      )}
      {children}
    </article>
  );
}
