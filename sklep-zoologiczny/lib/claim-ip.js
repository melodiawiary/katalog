// TYLKO NA SERWERZE. Limit nowych zgłoszeń salonów: 5 na dobę z jednego adresu IP (w bazie tylko skrót, nie sam adres).
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { serviceClient } from '@/lib/supabase/service';

// true = można zgłaszać dalej; w razie braku klucza serwisowego albo funkcji w bazie nie blokujemy (limit kont działa i tak)
export async function claimIpAllowed() {
  try {
    const db = serviceClient();
    if (!db) return true;
    const h = await headers();
    const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
    if (!ip) return true;
    const hash = createHash('sha256').update(`claim:${ip}`).digest('hex');
    const { data, error } = await db.rpc('claim_ip_hit', { p_ip_hash: hash });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export const IP_LIMIT_MESSAGE = 'Z tego połączenia zgłoszono dziś już kilka salonów. Wróć jutro albo napisz do nas.';
