import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/settings';
import { needsSql } from '@/lib/admin';
import { categoryPath } from '@/lib/categories';
import { siteUrl } from '@/lib/site';
import Gallery from '@/components/product/Gallery';
import BuyBox from '@/components/product/BuyBox';
import ProductTabs from '@/components/product/ProductTabs';
import ProductCard from '@/components/browse/ProductCard';
import Reviews from '@/components/product/Reviews';
import Stars from '@/components/product/Stars';

export const dynamic = 'force-dynamic';

// Wszystko do karty jednym zapytaniem (funkcja product_page w supabase/05_karta.sql)
const getProduct = cache(async (slug) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('product_page', { p_slug: slug });
  return { product: data, error };
});

const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('id, name, slug, emoji, parent_id');
  return data || [];
});

function images(p) {
  if (p.images?.length) return p.images;
  return p.image_url ? [{ url: p.image_url, alt: '' }] : [];
}

function pickVariant(variants, wanted) {
  const id = Number(wanted);
  return (variants.find((v) => v.id === id) || variants.find((v) => v.stock > 0) || variants[0])?.id;
}

function plain(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s;
}

const fmt = (n) => Number(n).toFixed(2).replace('.', ',');

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const { wariant } = await searchParams;
  const { product: p } = await getProduct(slug);
  if (!p) return { title: 'Produkt' };
  const s = await getSettings();
  const base = await siteUrl(s);
  const v = p.variants.find((x) => x.id === pickVariant(p.variants, wariant));
  const title = [p.name, p.variants.length > 1 && v?.name, p.brand?.name && !p.name.includes(p.brand.name) && p.brand.name]
    .filter(Boolean).join(' - ');
  const priceText = v ? `${p.variants.length > 1 ? 'od ' : ''}${fmt(Math.min(...p.variants.map((x) => x.effective_price)))} zł` : '';
  const description = plain(p.description, 155)
    || plain(`${p.name}${p.brand ? ` marki ${p.brand.name}` : ''} ${priceText} w sklepie ${s.shop_name}. Szybka wysyłka kurierem lub do paczkomatu.`, 160);
  const img = images(p)[0]?.url;
  return {
    title: `${title} | ${s.shop_name}`,
    description,
    alternates: { canonical: `${base}/produkt/${p.slug}` },
    robots: p.active ? undefined : { index: false },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${base}/produkt/${p.slug}`,
      siteName: s.shop_name,
      locale: 'pl_PL',
      images: img ? [{ url: img }] : undefined,
    },
  };
}

// Dane dla Google (schema.org): produkt albo grupa wariantów, z ceną, dostępnością i EAN
function structuredData(p, path, base, shopName, extras) {
  const url = `${base}/produkt/${p.slug}`;
  const pics = images(p).map((i) => i.url);
  const brand = p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined;
  const offer = (v) => ({
    '@type': 'Offer',
    url: p.variants.length > 1 ? `${url}?wariant=${v.id}` : url,
    priceCurrency: 'PLN',
    price: Number(v.effective_price).toFixed(2),
    priceValidUntil: v.promo_to ? v.promo_to.slice(0, 10) : undefined,
    availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: shopName },
  });
  const gtin = (v) => {
    const ean = String(v.ean || '');
    if (/^\d{13}$/.test(ean)) return { gtin13: ean };
    if (/^\d{8}$|^\d{12}$|^\d{14}$/.test(ean)) return { gtin: ean };
    return {};
  };
  const description = plain(p.description, 5000) || undefined;
  const category = path.map((c) => c.name).join(' > ') || undefined;

  const product = p.variants.length > 1
    ? {
        '@context': 'https://schema.org',
        '@type': 'ProductGroup',
        name: p.name,
        description,
        url,
        image: pics,
        brand,
        category,
        productGroupID: String(p.id),
        variesBy: ['https://schema.org/size'],
        hasVariant: p.variants.map((v) => ({
          '@type': 'Product',
          name: `${p.name} - ${v.name}`,
          sku: v.sku || String(v.id),
          ...gtin(v),
          size: v.name,
          image: pics[0],
          offers: offer(v),
        })),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description,
        url,
        image: pics,
        brand,
        category,
        sku: p.variants[0].sku || String(p.variants[0].id),
        ...gtin(p.variants[0]),
        offers: offer(p.variants[0]),
      };

  if (extras?.rating_count > 0 && extras?.rating_avg) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(extras.rating_avg),
      reviewCount: String(extras.rating_count),
      bestRating: '5',
      worstRating: '1',
    };
  }

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      ...path.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${base}/kategoria/${c.slug}` })),
      { '@type': 'ListItem', position: path.length + 1, name: p.name, item: url },
    ],
  };
  return [product, crumbs];
}

function tabsFor(p) {
  const tabs = [];
  if (p.description?.trim()) tabs.push({ key: 'opis', label: 'Opis', blocks: [{ text: p.description }] });
  const comp = [
    p.composition?.trim() && { title: 'Skład', text: p.composition },
    p.additives?.trim() && { title: 'Dodatki', text: p.additives },
  ].filter(Boolean);
  if (comp.length) tabs.push({ key: 'sklad', label: 'Skład', blocks: comp.length === 1 && !p.additives?.trim() ? [{ text: p.composition }] : comp });
  if (p.analysis?.trim()) tabs.push({ key: 'analiza', label: 'Analiza', blocks: [{ title: 'Składniki analityczne', text: p.analysis }] });
  if (p.dosage?.trim()) tabs.push({ key: 'dawkowanie', label: 'Dawkowanie', blocks: [{ text: p.dosage }] });

  const rows = [];
  if (p.brand) rows.push(['Marka', p.brand.name]);
  for (const a of p.attributes || []) rows.push([a.name, a.values.map((x) => x.value).join(', ')]);
  const multi = p.variants.length > 1;
  for (const v of p.variants) {
    if (v.ean) rows.push([multi ? `EAN (${v.name})` : 'EAN', v.ean]);
  }
  if (rows.length) tabs.push({ key: 'szczegoly', label: 'Szczegóły', rows });
  return tabs;
}

export default async function ProductPage({ params, searchParams }) {
  const { slug } = await params;
  const { wariant } = await searchParams;
  const { product: p, error } = await getProduct(slug);

  if (error) {
    return (
      <p className="alert">
        {needsSql(error)
          ? 'Karta produktu czeka na aktualizację bazy (plik supabase/05_karta.sql).'
          : 'Nie udało się wczytać produktu. Spróbuj odświeżyć stronę.'}
      </p>
    );
  }
  if (!p) notFound();

  const [s, categories, extrasRes] = await Promise.all([
    getSettings(),
    getCategories(),
    // oceny, opinie i "kupowane razem"; przed wklejeniem 08_konto.sql funkcji nie ma - wtedy bez nich
    (await createClient()).rpc('product_extras', { p_product: p.id }),
  ]);
  const extras = extrasRes?.data || null;
  const base = await siteUrl(s);
  const path = p.category_id ? categoryPath(categories, p.category_id) : [];
  const gallery = images(p);
  const tabs = tabsFor(p);
  const json = JSON.stringify(p.variants.length ? structuredData(p, path, base, s.shop_name, extras) : []).replace(/</g, '\\u003c');

  return (
    <>
      {!p.active && <p className="alert">Podgląd: ten produkt jest ukryty i klienci go nie widzą.</p>}
      {path.length > 0 && (
        <nav className="muted breadcrumbs" aria-label="Okruszki">
          {path.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' › '}
              <Link href={`/kategoria/${c.slug}`}>{i === 0 && `${c.emoji} `}{c.name}</Link>
            </span>
          ))}
        </nav>
      )}

      <div className="product-page">
        <Gallery images={gallery} name={p.name} emoji={p.emoji || '🐾'} />
        <div className="product-info">
          {p.brand && (
            <Link href={`/?marka=${p.brand.slug}`} className="card-brand product-brand">{p.brand.name}</Link>
          )}
          <h1>{p.name}</h1>
          {extras?.rating_count > 0 && (
            <p className="rating-line">
              <a href="#opinie"><Stars value={extras.rating_avg} /> <span className="muted">{String(extras.rating_avg).replace('.', ',')} ({extras.rating_count})</span></a>
            </p>
          )}
          {p.attributes?.length > 0 && (
            <ul className="product-attrs">
              {p.attributes.flatMap((a) => a.values.map((x) => (
                <li key={`${a.code}-${x.slug}`}><Link href={`/?${a.code}=${x.slug}`}>{x.value}</Link></li>
              )))}
            </ul>
          )}
          {p.variants.length > 0 ? (
            <BuyBox
              product={{ id: p.id, name: p.name, slug: p.slug, image_url: gallery[0]?.url || null, variants: p.variants }}
              initialVariantId={pickVariant(p.variants, wariant)}
              shipCutoff={s.ship_cutoff || '13:00'}
              shipHandlingDays={s.ship_handling_days ?? 0}
            />
          ) : (
            <p className="stock-out">Produkt chwilowo niedostępny.</p>
          )}
        </div>
      </div>

      <ProductTabs tabs={tabs} />

      {extras?.together?.length > 0 && (
        <section className="similar">
          <h2>Kupowane razem</h2>
          <p className="small muted">Klienci, którzy kupili ten produkt, często zamawiali też:</p>
          <div className="similar-row">
            {extras.together.map((x) => <ProductCard key={x.id} p={x} />)}
          </div>
        </section>
      )}

      {p.similar?.length > 0 && (
        <section className="similar">
          <h2>Podobne produkty</h2>
          <div className="similar-row">
            {p.similar.map((x) => <ProductCard key={x.id} p={x} />)}
          </div>
        </section>
      )}

      <Reviews productId={p.id} extras={extras} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
    </>
  );
}
