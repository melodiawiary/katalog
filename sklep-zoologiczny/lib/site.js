import { headers } from 'next/headers';

// Pełny adres sklepu (do linków dla Google): domena z ustawień, adres Vercela albo adres z zapytania
export async function siteUrl(settings) {
  const domain = String(settings?.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (domain) return `https://${domain}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
