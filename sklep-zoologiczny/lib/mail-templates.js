// Treści e-maili (HTML + zwykły tekst). Dane zamówienia: wynik funkcji get_order.
import { price, shippingLabel } from '@/lib/shop';
import { formatAccount } from '@/lib/settings-fields';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function trackingUrl(order) {
  const n = String(order?.tracking_number || '').trim();
  if (!n) return '';
  // paczkomaty i kurier InPost: numer 24 cyfry; inne firmy - sam numer bez linku
  if (order.shipping_method === 'paczkomat' || /^\d{24}$/.test(n)) {
    return `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(n)}`;
  }
  return '';
}

function layout(settings, title, bodyHtml) {
  const s = settings || {};
  const company = [s.company_name, s.address, [s.postal_code, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#fbf8f3;font-family:Arial,Helvetica,sans-serif;color:#2b2a28;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f3;padding:20px 10px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #ece5da;border-radius:14px;">
<tr><td style="padding:18px 22px;border-bottom:3px solid #e07a2f;font-size:20px;font-weight:bold;">🐾 ${esc(s.shop_name || 'Sklep')}</td></tr>
<tr><td style="padding:20px 22px;font-size:15px;line-height:1.55;">${bodyHtml}</td></tr>
<tr><td style="padding:14px 22px;border-top:1px solid #ece5da;font-size:12px;color:#7a746b;">
${company ? `${esc(company)}<br>` : ''}${s.email ? `E-mail: ${esc(s.email)}` : ''}${s.phone ? ` · tel. ${esc(s.phone)}` : ''}
</td></tr></table></td></tr></table></body></html>`;
}

const button = (url, label) =>
  `<p style="margin:18px 0;"><a href="${esc(url)}" style="display:inline-block;background:#e07a2f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px;">${esc(label)}</a></p>`;

function itemsTable(order) {
  const rows = order.items.map((i) => `<tr>
<td style="padding:6px 0;border-bottom:1px solid #ece5da;">${esc(i.name)} × ${i.quantity}</td>
<td style="padding:6px 0;border-bottom:1px solid #ece5da;text-align:right;white-space:nowrap;">${esc(price(i.price * i.quantity))}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:10px 0;">${rows}
<tr><td style="padding:6px 0;">Dostawa (${esc(shippingLabel(order.shipping_method))})</td><td style="padding:6px 0;text-align:right;">${esc(price(order.shipping_cost))}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold;font-size:16px;">Razem</td><td style="padding:8px 0;text-align:right;font-weight:bold;font-size:16px;">${esc(price(order.total))}</td></tr></table>`;
}

function itemsText(order) {
  return [
    ...order.items.map((i) => `- ${i.name} × ${i.quantity}: ${price(i.price * i.quantity)}`),
    `- Dostawa (${shippingLabel(order.shipping_method)}): ${price(order.shipping_cost)}`,
    `Razem: ${price(order.total)}`,
  ].join('\n');
}

export function deliveryText(order) {
  if (order.shipping_method === 'paczkomat') {
    return `Paczkomat ${order.locker_id}${order.locker_desc ? `, ${order.locker_desc}` : ''}`;
  }
  return `${order.customer_name}, ${order.address}, ${order.postal_code} ${order.city}`;
}

// Linki do regulaminu i zwrotów (informacje dla konsumenta w potwierdzeniu zamówienia); baza z adresu zamówienia
function legalBase(extra) {
  try { return extra?.orderUrl ? new URL(extra.orderUrl).origin : ''; } catch { return ''; }
}

const testPrefix = (order) => (order.is_test ? '[TEST] ' : '');

// Potwierdzenie zamówienia dla klienta
// extra: { orderUrl, payUrl (Przelewy24), delivery: { ship, delivery } }
export function orderConfirmation(order, settings, extra = {}) {
  const s = settings || {};
  const subject = `${testPrefix(order)}Zamówienie nr ${order.number} - ${s.shop_name || 'sklep'}`;
  let payHtml = '';
  let payText = '';
  if (order.payment_method === 'przelew') {
    const acc = s.bank_account ? formatAccount(s.bank_account) : '(numer konta w osobnej wiadomości)';
    payHtml = `<div style="background:#fff7ee;border:1px solid #f3d7bb;border-radius:12px;padding:12px 14px;margin:14px 0;">
<strong>Dane do przelewu</strong><br>Kwota: <strong>${esc(price(order.total))}</strong><br>Tytuł: <strong>Zamówienie nr ${order.number}</strong><br>
Numer konta: <strong>${esc(acc)}</strong>${s.company_name ? `<br>Odbiorca: ${esc(s.company_name)}, ${esc(s.address)}, ${esc(s.postal_code)} ${esc(s.city)}` : ''}<br>
<span style="color:#7a746b;font-size:13px;">Wyślemy paczkę po zaksięgowaniu wpłaty.</span></div>`;
    payText = `Dane do przelewu:\nKwota: ${price(order.total)}\nTytuł: Zamówienie nr ${order.number}\nNumer konta: ${acc}\n${s.company_name ? `Odbiorca: ${s.company_name}, ${s.address}, ${s.postal_code} ${s.city}\n` : ''}Wyślemy paczkę po zaksięgowaniu wpłaty.`;
  } else if (order.payment_method === 'p24') {
    if (order.payment_status === 'oplacone') {
      payHtml = '<p><strong>Płatność przyjęta.</strong> Dziękujemy!</p>';
      payText = 'Płatność przyjęta. Dziękujemy!';
    } else {
      const url = extra.payUrl || extra.orderUrl;
      payHtml = `<p>Płatność online (BLIK, przelew, karta) przez Przelewy24. Jeśli płatność się nie udała, możesz zapłacić ponownie:</p>${url ? button(url, 'Zapłać teraz') : ''}`;
      payText = `Płatność online przez Przelewy24. Jeśli płatność się nie udała, zapłać ponownie: ${url || ''}`;
    }
  } else {
    payHtml = `<p>Płatność przy odbiorze: <strong>${esc(price(order.total))}</strong>.</p>`;
    payText = `Płatność przy odbiorze: ${price(order.total)}.`;
  }

  const when = extra.delivery
    ? `Wyślemy ${extra.delivery.ship}, przewidywana dostawa: ${extra.delivery.delivery}.`
    : '';

  const html = layout(s, subject, `
${order.is_test ? '<p style="background:#fde2e2;padding:8px 12px;border-radius:8px;"><strong>To zamówienie testowe</strong> (sklep jeszcze nie sprzedaje).</p>' : ''}
<p>Dzień dobry ${esc(order.customer_name)},</p>
<p>dziękujemy za zamówienie <strong>nr ${order.number}</strong>. Oto podsumowanie:</p>
${itemsTable(order)}
${payHtml}
<p><strong>Dostawa:</strong> ${esc(deliveryText(order))}${when ? `<br>${esc(when)}` : ''}</p>
${extra.orderUrl ? button(extra.orderUrl, 'Zobacz zamówienie') : ''}
<p style="color:#7a746b;font-size:13px;">Masz pytanie? Odpowiedz na tego e-maila${s.phone ? ` albo zadzwoń: ${esc(s.phone)}` : ''}.</p>
${legalBase(extra) ? `<p style="color:#7a746b;font-size:13px;">Masz 14 dni na odstąpienie od umowy. Informacje i wzór formularza: <a href="${esc(legalBase(extra))}/zwroty" style="color:#c4631c;">zwroty i reklamacje</a>. Zaakceptowany <a href="${esc(legalBase(extra))}/regulamin" style="color:#c4631c;">regulamin</a> i <a href="${esc(legalBase(extra))}/polityka-prywatnosci" style="color:#c4631c;">politykę prywatności</a> znajdziesz w sklepie.</p>` : ''}`);

  const text = [
    order.is_test ? 'TO ZAMÓWIENIE TESTOWE.\n' : '',
    `Dzień dobry ${order.customer_name},`,
    `dziękujemy za zamówienie nr ${order.number}.`,
    '',
    itemsText(order),
    '',
    payText,
    '',
    `Dostawa: ${deliveryText(order)}${when ? `\n${when}` : ''}`,
    extra.orderUrl ? `\nZamówienie: ${extra.orderUrl}` : '',
    legalBase(extra)
      ? `\nMasz 14 dni na odstąpienie od umowy: ${legalBase(extra)}/zwroty\nRegulamin: ${legalBase(extra)}/regulamin\nPolityka prywatności: ${legalBase(extra)}/polityka-prywatnosci`
      : '',
    '',
    `Pozdrawiamy\n${s.shop_name || ''}`,
  ].join('\n');

  return { subject, html, text };
}

// Kopia dla sklepu: nowe zamówienie
export function adminNewOrder(order, settings, extra = {}) {
  const subject = `${testPrefix(order)}Nowe zamówienie nr ${order.number}: ${price(order.total)}`;
  const pay = { przelew: 'przelew tradycyjny', pobranie: 'za pobraniem', p24: 'Przelewy24' }[order.payment_method] || order.payment_method;
  const html = layout(settings, subject, `
<p><strong>Nowe zamówienie nr ${order.number}</strong> od ${esc(order.customer_name)} (${esc(order.email)}, ${esc(order.phone)}).</p>
${itemsTable(order)}
<p>Płatność: ${esc(pay)}<br>Dostawa: ${esc(deliveryText(order))}</p>
${extra.adminUrl ? button(extra.adminUrl, 'Otwórz panel') : ''}`);
  const text = `Nowe zamówienie nr ${order.number} od ${order.customer_name} (${order.email}, ${order.phone}).\n\n${itemsText(order)}\n\nPłatność: ${pay}\nDostawa: ${deliveryText(order)}\n${extra.adminUrl || ''}`;
  return { subject, html, text };
}

const STATUS_MAIL = {
  oplacone: {
    title: (o) => `Płatność za zamówienie nr ${o.number} przyjęta`,
    body: () => 'Otrzymaliśmy płatność. Przygotowujemy paczkę i damy znać, gdy wyruszy w drogę.',
  },
  wyslane: {
    title: (o) => `Zamówienie nr ${o.number} wysłane`,
    body: (o) => (o.shipping_method === 'paczkomat'
      ? `Paczka jest w drodze do paczkomatu ${o.locker_id}. Kod odbioru przyjdzie SMS-em i e-mailem od InPost.`
      : 'Paczka jest w drodze. Kurier zadzwoni lub wyśle SMS przed doręczeniem.'),
  },
  zrealizowane: {
    title: (o) => `Zamówienie nr ${o.number} zrealizowane`,
    body: () => 'Dziękujemy za zakupy! Mamy nadzieję, że Twój pupil jest zadowolony.',
  },
  anulowane: {
    title: (o) => `Zamówienie nr ${o.number} anulowane`,
    body: (o) => (o.payment_status === 'oplacone'
      ? 'Zamówienie zostało anulowane. Pieniądze zwrócimy w ciągu kilku dni roboczych tą samą drogą, którą zapłacono.'
      : 'Zamówienie zostało anulowane. Jeśli to pomyłka, odpowiedz na tego e-maila.'),
  },
};

export function hasStatusMail(status) {
  return Boolean(STATUS_MAIL[status]);
}

export function orderStatusMail(order, settings, status, extra = {}) {
  const t = STATUS_MAIL[status];
  const subject = `${testPrefix(order)}${t.title(order)}`;
  const track = status === 'wyslane' ? trackingUrl(order) : '';
  const html = layout(settings, subject, `
<p>Dzień dobry ${esc(order.customer_name)},</p>
<p>${esc(t.body(order))}</p>
${status === 'wyslane' && order.tracking_number ? `<p>Numer przesyłki: <strong>${esc(order.tracking_number)}</strong></p>${track ? button(track, 'Śledź paczkę') : ''}` : ''}
${extra.orderUrl ? `<p><a href="${esc(extra.orderUrl)}" style="color:#c4631c;">Zobacz zamówienie</a></p>` : ''}
<p>Pozdrawiamy<br>${esc(settings?.shop_name || '')}</p>`);
  const text = [
    `Dzień dobry ${order.customer_name},`,
    t.body(order),
    status === 'wyslane' && order.tracking_number ? `Numer przesyłki: ${order.tracking_number}${track ? `\nŚledzenie: ${track}` : ''}` : '',
    extra.orderUrl ? `Zamówienie: ${extra.orderUrl}` : '',
    '',
    `Pozdrawiamy\n${settings?.shop_name || ''}`,
  ].filter(Boolean).join('\n\n');
  return { subject, html, text };
}

// "Produkt znów dostępny"
export function backInStockMail(title, url, settings) {
  const subject = `${title} znów dostępny`;
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>produkt, na który czekasz, jest znów dostępny:</p>
<p style="font-size:17px;"><strong>${esc(title)}</strong></p>
${button(url, 'Zobacz w sklepie')}
<p style="color:#7a746b;font-size:13px;">Napisaliśmy, bo zapisałeś się na powiadomienie o dostępności. To jednorazowa wiadomość.</p>`);
  const text = `Dzień dobry,\n\nprodukt, na który czekasz, jest znów dostępny:\n${title}\n${url}\n\nTo jednorazowa wiadomość.\n\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}

export function testMail(settings) {
  const subject = `Test e-maili - ${settings?.shop_name || 'sklep'}`;
  return {
    subject,
    html: layout(settings, subject, '<p>Działa! 🎉 Tak będą wyglądać e-maile ze sklepu.</p>'),
    text: 'Działa! Tak będą wyglądać e-maile ze sklepu.',
  };
}

// Logowanie do konta: link i kod (kod do wpisania, gdy link otwiera się w innej przeglądarce niż strona sklepu)
export function loginMail(url, code, settings) {
  const subject = `Logowanie do konta - ${settings?.shop_name || 'sklep'}`;
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>kliknij przycisk, żeby zalogować się do konta w sklepie:</p>
${button(url, 'Zaloguj mnie')}
${code ? `<p>Jeśli link otworzył się w innej przeglądarce, wpisz na stronie logowania kod:</p>
<p style="font-size:26px;letter-spacing:6px;font-weight:bold;margin:8px 0;">${esc(code)}</p>` : ''}
<p style="color:#7a746b;font-size:13px;">Link i kod działają krótko i tylko raz. Jeśli to nie Ty prosiłeś o logowanie, zignoruj tę wiadomość - nikt nie wejdzie na konto bez dostępu do Twojej poczty.</p>`);
  const text = `Dzień dobry,\n\nzaloguj się do konta w sklepie: ${url}\n${code ? `\nKod logowania: ${code}\n` : ''}\nLink i kod działają krótko i tylko raz. Jeśli to nie Ty prosiłeś o logowanie, zignoruj tę wiadomość.\n\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}

// Przypomnienie o karmie. items: [{ title, pet, url, endsOn }]
export function foodReminderMail(name, items, accountUrl, unsubUrl, settings) {
  const subject = items.length === 1 ? `Czas na nową karmę: ${items[0].title}` : 'Czas na nową karmę dla Twoich zwierzaków';
  const date = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  const rows = items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #ece5da;">
<strong>${esc(i.title)}</strong>${i.pet ? `<br><span style="color:#7a746b;font-size:13px;">dla: ${esc(i.pet)}</span>` : ''}
<br><span style="color:#7a746b;font-size:13px;">opakowanie powinno starczyć mniej więcej do ${esc(date(i.endsOn))}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #ece5da;text-align:right;white-space:nowrap;"><a href="${esc(i.url)}" style="color:#c4631c;font-weight:bold;">Zamów ponownie</a></td></tr>`).join('');
  const html = layout(settings, subject, `
<p>${name ? `Dzień dobry, ${esc(name)}!` : 'Dzień dobry!'}</p>
<p>Ustawiłeś u nas przypomnienie o karmie. Wygląda na to, że niedługo zacznie się kończyć:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:10px 0;">${rows}</table>
${button(accountUrl, 'Moje przypomnienia')}
<p style="color:#7a746b;font-size:13px;">Dni liczymy od ostatniego zakupu. Możesz je zmienić albo wyłączyć przypomnienie w koncie. <a href="${esc(unsubUrl)}" style="color:#7a746b;">Wyłącz wszystkie przypomnienia o karmie</a>.</p>`);
  const text = [
    name ? `Dzień dobry, ${name}!` : 'Dzień dobry!',
    'Ustawiłeś u nas przypomnienie o karmie. Wygląda na to, że niedługo zacznie się kończyć:',
    ...items.map((i) => `- ${i.title}${i.pet ? ` (dla: ${i.pet})` : ''}, do ok. ${date(i.endsOn)}: ${i.url}`),
    `Moje przypomnienia: ${accountUrl}`,
    `Wyłącz wszystkie przypomnienia o karmie: ${unsubUrl}`,
    `Pozdrawiamy\n${settings?.shop_name || ''}`,
  ].join('\n\n');
  return { subject, html, text };
}

// Kod potwierdzający przejęcie profilu salonu (Etap 5)
export function claimCodeMail(code, placeName, settings) {
  const subject = `Kod do potwierdzenia salonu ${placeName}`;
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>ktoś (mamy nadzieję, że Ty) zgłosił, że jest właścicielem lub zarządza salonem <strong>${esc(placeName)}</strong> w naszym katalogu. Żeby potwierdzić, wpisz na stronie ten kod:</p>
<p style="font-size:26px;letter-spacing:6px;font-weight:bold;margin:8px 0;">${esc(code)}</p>
<p style="color:#7a746b;font-size:13px;">Kod działa krótko i tylko raz. Jeśli to nie Ty, zignoruj tę wiadomość - bez kodu nikt nie dostanie dostępu do profilu salonu.</p>`);
  const text = `Dzień dobry,\n\nkod do potwierdzenia salonu ${placeName}: ${code}\n\nKod działa krótko i tylko raz. Jeśli to nie Ty, zignoruj tę wiadomość.\n\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}

// Informacja dla dotychczasowego właściciela, że ktoś zgłasza ten sam salon
export function claimConflictMail(placeName, settings) {
  const subject = `Ktoś zgłasza ten sam salon: ${placeName}`;
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>ktoś inny zgłosił prawo do profilu salonu <strong>${esc(placeName)}</strong>, który masz na swoim koncie. Sprawdzimy sprawę ręcznie. Do czasu decyzji nic się nie zmienia, a Twój dostęp zostaje.</p>
<p style="color:#7a746b;font-size:13px;">Jeśli to Ty lub ktoś z Twojego zespołu, możesz zignorować tę wiadomość. W razie wątpliwości odpisz na ten e-mail.</p>`);
  const text = `Dzień dobry,\n\nktoś inny zgłosił prawo do profilu salonu ${placeName}, który masz na swoim koncie. Sprawdzimy sprawę ręcznie. Do czasu decyzji nic się nie zmienia.\n\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}

// Nowa opinia o salonie dla właściciela
export function ownerReviewMail(placeName, rating, body, url, settings) {
  const subject = `Nowa opinia o salonie ${placeName}`;
  const snippet = String(body || '').trim().slice(0, 300);
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>w katalogu pojawiła się nowa opinia o salonie <strong>${esc(placeName)}</strong>: <strong>${esc(String(rating))}/5</strong>.</p>
${snippet ? `<p style="border-left:3px solid #ece5da;padding-left:10px;">${esc(snippet)}</p>` : ''}
${button(url, 'Odpowiedz na opinię')}
<p style="color:#7a746b;font-size:13px;">Powiadomienia możesz wyłączyć w panelu salonu.</p>`);
  const text = `Nowa opinia o salonie ${placeName}: ${rating}/5.\n${snippet ? `\n"${snippet}"\n` : ''}\nOdpowiedz: ${url}`;
  return { subject, html, text };
}

// ETAP 5a: pakiet bezpieczeństwa przejęć
const FIELD_LABELS = { phone: 'telefon', email: 'e-mail', website: 'strona WWW', booking_url: 'link do rezerwacji', instagram: 'Instagram', facebook: 'Facebook' };
const fmtDate = (d) => new Date(d).toLocaleString('pl-PL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Warsaw' });

// Do dotychczasowych właścicieli i na adres salonu z katalogu: ktoś przejął profil
export function takeoverNoticeMail(n, objectUrl, settings) {
  const subject = `Ktoś przejął profil salonu: ${n.place_name}`;
  const who = n.claimant_name ? `${n.claimant_name} (${n.role === 'zarzadzajacy' ? 'zarządzający' : 'właściciel'})` : 'ktoś';
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>profil salonu <strong>${esc(n.place_name)}</strong> w naszym katalogu został przejęty przez: <strong>${esc(who)}</strong>.</p>
<p>Przez pierwsze 48 godzin (do ${esc(fmtDate(n.hold_until))}) nowy opiekun nie może zmienić telefonu, e-maila ani linków do strony, rezerwacji i social mediów.</p>
<p><strong>Jeśli to nie Ty ani nikt z Twojego zespołu, kliknij poniżej.</strong> Natychmiast wstrzymamy konto tej osoby i sprawdzimy sprawę.</p>
${button(objectUrl, 'To nie ja')}
<p style="color:#7a746b;font-size:13px;">Jeśli to Ty lub Twój pracownik, nic nie musisz robić. Link jest ważny 30 dni.</p>`);
  const text = `Dzień dobry,\n\nprofil salonu ${n.place_name} został przejęty przez: ${who}.\nPrzez 48 godzin (do ${fmtDate(n.hold_until)}) nowy opiekun nie zmieni telefonu, e-maila ani linków.\n\nJeśli to nie Ty ani nikt z Twojego zespołu, otwórz: ${objectUrl}\nNatychmiast wstrzymamy to konto i sprawdzimy sprawę. Link jest ważny 30 dni.\n\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}

// Ktoś w okresie wstrzymania próbował zmienić dane kontaktowe
export function pendingChangeMail(n, objectUrl, settings) {
  const fields = (n.fields || []).map((f) => FIELD_LABELS[f] || f).join(', ');
  const subject = `Zmiana danych salonu czeka na zatwierdzenie: ${n.place_name}`;
  const html = layout(settings, subject, `
<p>Dzień dobry,</p>
<p>nowy opiekun profilu <strong>${esc(n.place_name)}</strong> chce zmienić: <strong>${esc(fields)}</strong>. Zmiana wejdzie w życie ${esc(fmtDate(n.apply_at))}, dopóki jej nie zablokujesz.</p>
${objectUrl ? button(objectUrl, 'To nie ja') : ''}
<p style="color:#7a746b;font-size:13px;">Jeśli to Ty lub Twój pracownik, zignoruj tę wiadomość.</p>`);
  const text = `Dzień dobry,\n\nnowy opiekun profilu ${n.place_name} chce zmienić: ${fields}. Zmiana wejdzie w życie ${fmtDate(n.apply_at)}.\n${objectUrl ? `Jeśli to nie Ty: ${objectUrl}\n` : ''}\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}

// Do administratora: nowy sprzeciw „To nie ja”
export function takeoverObjectionAdminMail(placeName, claimantName, adminUrl, settings) {
  const subject = `Sprzeciw „To nie ja”: ${placeName}`;
  const html = layout(settings, subject, `
<p>Właściciel zgłosił, że przejęcie profilu <strong>${esc(placeName)}</strong> przez <strong>${esc(claimantName || 'nieznaną osobę')}</strong> to nie on. Konto nowego opiekuna jest wstrzymane. Czeka na Twoją decyzję.</p>
${button(adminUrl, 'Otwórz panel przejęć')}`);
  const text = `Sprzeciw „To nie ja” w sprawie profilu ${placeName} (${claimantName || 'nieznana osoba'}). Konto nowego opiekuna wstrzymane. Panel: ${adminUrl}`;
  return { subject, html, text };
}

// Do zgłaszającego: jego dostęp został wstrzymany albo rozstrzygnięty
export function takeoverClaimantMail(kind, placeName, settings) {
  const titles = {
    wstrzymane: `Dostęp do salonu wstrzymany: ${placeName}`,
    przywrocono: `Dostęp do salonu przywrócony: ${placeName}`,
    odrzucono: `Przejęcie salonu odrzucone: ${placeName}`,
  };
  const bodies = {
    wstrzymane: `dotychczasowy właściciel zgłosił sprzeciw wobec przejęcia profilu <strong>${esc(placeName)}</strong>. Na czas sprawdzenia Twój dostęp do edycji jest wstrzymany. Sprawdzimy sprawę i damy znać.`,
    przywrocono: `sprawdziliśmy zgłoszenie sprzeciwu wobec przejęcia profilu <strong>${esc(placeName)}</strong> i przywróciliśmy Twój dostęp.`,
    odrzucono: `po sprawdzeniu zgłoszenia sprzeciwu nie mogliśmy potwierdzić Twojego prawa do profilu <strong>${esc(placeName)}</strong>. Dostęp został odebrany. Jeśli to pomyłka, odpisz na ten e-mail.`,
  };
  const subject = titles[kind];
  const html = layout(settings, subject, `<p>Dzień dobry,</p><p>${bodies[kind]}</p><p style="color:#7a746b;font-size:13px;">W razie pytań odpisz na ten e-mail.</p>`);
  const text = `Dzień dobry,\n\n${bodies[kind].replace(/<[^>]+>/g, '')}\n\nPozdrawiamy\n${settings?.shop_name || ''}`;
  return { subject, html, text };
}
