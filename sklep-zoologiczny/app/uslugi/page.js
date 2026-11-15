import Link from 'next/link';
import { SERVICE_CATEGORIES, categoryHref } from '@/lib/service-categories';

export const metadata = { title: 'Wszystkie usługi dla psów i kotów' };

export default function ServicesPage() {
  return (
    <div className="container">
      <h1>Wszystkie usługi</h1>
      <p className="muted">Wybierz, kogo szukasz dla swojego pupila.</p>
      <ul className="svc-grid svc-grid-all">
        {SERVICE_CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link href={categoryHref(c)} className="svc-tile">
              <img src={`/ikony/uslugi/${c.icon}.png`} alt="" loading="lazy" />
              <span>{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
