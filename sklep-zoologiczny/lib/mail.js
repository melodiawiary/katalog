// TYLKO NA SERWERZE. Wysyłka e-maili przez Resend (https://resend.com) + zapis w dzienniku email_log.
// Bez własnej domeny Resend wysyła tylko z adresu onboarding@resend.dev i tylko na e-mail właściciela konta Resend.

import nodemailer from 'nodemailer';

const RESEND_URL = 'https://api.resend.com';

// Gmail (SMTP) ma pierwszenstwo, gdy wpisano adres i haslo aplikacji; inaczej Resend
export function hasGmail(integ) {
  return Boolean(String(integ?.gmail_user || '').trim() && String(integ?.gmail_app_password || '').trim());
}
export function canSend(integ) {
  return hasGmail(integ) || Boolean(integ?.resend_api_key);
}

let gmailCache = { key: '', transport: null };
function gmailTransport(integ) {
  const user = String(integ.gmail_user).trim();
  const pass = String(integ.gmail_app_password).replace(/\s+/g, '');
  const key = `${user}|${pass}`;
  if (gmailCache.key !== key) {
    gmailCache = { key, transport: nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } }) };
  }
  return gmailCache.transport;
}

function gmailFrom(integ, settings) {
  const name = String(settings?.shop_name || 'Sklep').replace(/[<>"]/g, '');
  return `${name} <${String(integ.gmail_user).trim()}>`;
}

async function gmailSend(integ, settings, m) {
  try {
    await gmailTransport(integ).sendMail({
      from: gmailFrom(integ, settings),
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      ...(m.headers ? { headers: m.headers } : {}),
    });
    return { ok: true };
  } catch (e) {
    const msg = /Invalid login|Username and Password|535/i.test(e.message || '')
      ? 'Gmail odrzucił logowanie. Wpisz hasło aplikacji (16 znaków z konta Google), nie zwykłe hasło.'
      : `Gmail: ${e.message}`;
    return { ok: false, error: msg };
  }
}

export function mailFrom(integ, settings) {
  const from = String(integ?.mail_from || '').trim();
  if (from) return from;
  const name = String(settings?.shop_name || 'Sklep').replace(/[<>"]/g, '');
  return `${name} <onboarding@resend.dev>`;
}

async function resend(path, apiKey, body) {
  try {
    const res = await fetch(`${RESEND_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `Resend: błąd ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: `Resend: brak połączenia (${e.message})` };
  }
}

async function log(db, rows) {
  if (!db || rows.length === 0) return;
  try {
    await db.from('email_log').insert(rows.map((r) => ({
      order_id: r.orderId || null,
      kind: r.kind || 'inny',
      to_email: String(r.to).slice(0, 200),
      subject: String(r.subject || '').slice(0, 300),
      ok: r.ok,
      error: r.error ? String(r.error).slice(0, 500) : null,
    })));
  } catch {
    // dziennik nie może zatrzymać zamówienia
  }
}

// mail: { to, subject, html, text, kind, orderId, replyTo }
export async function sendMail(db, integ, settings, mail) {
  if (!canSend(integ)) {
    return { ok: false, skipped: true, error: 'Brak ustawień poczty (panel: Integracje).' };
  }
  if (hasGmail(integ)) {
    const g = await gmailSend(integ, settings, mail);
    await log(db, [{ ...mail, ok: g.ok, error: g.error }]);
    return g;
  }
  const r = await resend('/emails', integ.resend_api_key, {
    from: mailFrom(integ, settings),
    to: [mail.to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    ...(mail.headers ? { headers: mail.headers } : {}),
  });
  await log(db, [{ ...mail, ok: r.ok, error: r.error }]);
  return r;
}

// Do 100 wiadomości jednym zapytaniem (Resend ogranicza liczbę zapytań na sekundę)
export async function sendBatch(db, integ, settings, mails) {
  if (!canSend(integ)) return { ok: false, skipped: true, error: 'Brak ustawień poczty (panel: Integracje).' };
  if (hasGmail(integ)) {
    let allOk = true;
    let lastError = null;
    for (const m of mails) {
      const g = await gmailSend(integ, settings, m);
      await log(db, [{ ...m, ok: g.ok, error: g.error }]);
      m.ok = g.ok;
      if (!g.ok) { allOk = false; lastError = g.error; }
    }
    return { ok: allOk, error: lastError };
  }
  const from = mailFrom(integ, settings);
  let allOk = true;
  let lastError = null;
  for (let i = 0; i < mails.length; i += 100) {
    const part = mails.slice(i, i + 100);
    const r = await resend('/emails/batch', integ.resend_api_key, part.map((m) => ({
      from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      ...(m.headers ? { headers: m.headers } : {}),
    })));
    await log(db, part.map((m) => ({ ...m, ok: r.ok, error: r.error })));
    part.forEach((m) => { m.ok = r.ok; });
    if (!r.ok) { allOk = false; lastError = r.error; }
    if (i + 100 < mails.length) await new Promise((res) => setTimeout(res, 600));
  }
  return { ok: allOk, error: lastError };
}
