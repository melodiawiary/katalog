import Link from 'next/link';
import { SERVICE_CATEGORIES, categoryHref } from '@/lib/service-categories';
import { getSettings } from '@/lib/settings';
import ServicesBrowser from '@/components/ServicesBrowser';

export const metadata = { title: 'Wszystkie usługi dla psów i kotów' };

export default async function ServicesPage() {
  const s = await getSettings();
  const items = SERVICE_CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, title: c.title || c.name, blurb: c.blurb, icon: c.icon, href: categoryHref(c) }));
  const contactHref = s.email ? `mailto:${s.email}` : '/salony/polec';
  return (
    <div className="svcpage">
      <p className="svcpage-back"><Link href="/">← Powrót</Link></p>
      <h1 className="svcpage-title">Wszystkie usługi</h1>
      <p className="svcpage-sub">Znajdź najlepszych specjalistów w swojej okolicy</p>
      <ServicesBrowser items={items} contactHref={contactHref} />
    </div>
  );
}
