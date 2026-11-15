import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { categoryBySlug, categoryHref } from '@/lib/service-categories';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const c = categoryBySlug(slug);
  return { title: c ? c.name : 'Usługi' };
}

export default async function ServiceCategoryPage({ params }) {
  const { slug } = await params;
  const c = categoryBySlug(slug);
  if (!c) notFound();
  if (c.open) redirect(categoryHref(c));
  return (
    <div className="checkout">
      <p className="muted"><Link href="/uslugi">← Wszystkie usługi</Link></p>
      <img src={`/ikony/uslugi/${c.icon}.png`} alt="" width="96" className="svc-empty-icon" />
      <h1>{c.name}</h1>
      <p className="muted">{c.blurb}</p>
      <div className="box">
        <h2>Katalog w tej kategorii jest jeszcze pusty</h2>
        <p>Znasz sprawdzone miejsce albo sam prowadzisz taką działalność? Zgłoś je, a po sprawdzeniu dodamy do katalogu. Dodanie jest bezpłatne.</p>
        <Link href="/salony/polec" className="btn btn-light">Poleć lub dodaj firmę</Link>
      </div>
    </div>
  );
}
