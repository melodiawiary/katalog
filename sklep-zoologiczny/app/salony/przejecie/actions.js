'use server';

import { redirect } from 'next/navigation';
import { serviceClient } from '@/lib/supabase/service';
import { siteUrl } from '@/lib/site';
import { sendTakeoverObjectionMails } from '@/lib/order-mail';

// „To nie ja”: bez logowania, wystarczy tajny token z e-maila
export async function objectTakeover(fd) {
  const token = String(fd.get('t') || '').trim().slice(0, 64);
  const note = String(fd.get('note') || '').trim().slice(0, 500);
  const db = serviceClient();
  if (!db || !token) redirect(`/salony/przejecie?t=${encodeURIComponent(token)}&e=1`);
  const { data, error } = await db.rpc('takeover_object', { p_token: token, p_note: note });
  if (error || !data) redirect(`/salony/przejecie?t=${encodeURIComponent(token)}&e=1`);
  if (data.status === 'ok') {
    const { data: settings } = await db.from('settings').select('domain').eq('id', 1).maybeSingle();
    const site = await siteUrl(settings);
    const { data: info } = await db.rpc('takeover_event_info', { p_token: token });
    await sendTakeoverObjectionMails(site, {
      placeName: data.place_name, claimantName: info?.claimant_name, claimantEmail: data.claimant_email,
    }).catch(() => {});
  }
  redirect(`/salony/przejecie?t=${encodeURIComponent(token)}`);
}
