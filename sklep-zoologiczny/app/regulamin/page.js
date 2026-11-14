import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { SHIPPING, FREE_SHIPPING_FROM, price } from '@/lib/shop';
import { sellerAddress } from '@/lib/legal';
import Doc, { Val } from '@/components/legal/Doc';

export const metadata = { title: 'Regulamin' };

export default async function RegulaminPage() {
  const s = await getSettings();
  const vatFree = s.vat_status !== 'czynny';
  const handling = Number(s.ship_handling_days) || 0;
  const cutoff = s.ship_cutoff || '13:00';
  const shop = s.shop_name;
  const site = String(s.domain || '').trim();

  return (
    <Doc title={`Regulamin sklepu ${shop}`} settings={s}>
      <h2>§ 1. Postanowienia ogólne</h2>
      <ol>
        <li>
          Regulamin określa zasady korzystania ze sklepu internetowego {shop}
          {site && <> dostępnego pod adresem {site}</>} (dalej: „Sklep”) oraz zasady zawierania umów sprzedaży na odległość.
        </li>
        <li>
          Sprzedawcą i usługodawcą jest <Val v={s.company_name} label="nazwa firmy" />
          {s.owner_name && s.owner_name !== s.company_name && <>, właściciel: {s.owner_name}</>}, adres: <Val v={sellerAddress(s)} label="adres" />,
          NIP: <Val v={s.nip} label="NIP" />, REGON: <Val v={s.regon} label="REGON" /> (dalej: „Sprzedawca”).
        </li>
        <li>
          Kontakt ze Sprzedawcą: e-mail <Val v={s.email} label="e-mail" />, telefon <Val v={s.phone} label="telefon" />.
        </li>
        <li>
          Sprzedawca jest wpisany do rejestru podmiotów działających na rynku pasz pod numerem <Val v={s.feed_register_no} label="numer rejestru paszowego" />.
        </li>
        <li>
          Klient to osoba, która korzysta ze Sklepu lub składa zamówienie. Konsument to Klient będący osobą fizyczną, która dokonuje
          zakupu niezwiązanego bezpośrednio z jej działalnością gospodarczą lub zawodową.
        </li>
        <li>Sklep prowadzi sprzedaż wyłącznie na terenie Polski. Wszystkie ceny podane są w złotych polskich (PLN).</li>
      </ol>

      <h2>§ 2. Wymagania techniczne i usługi elektroniczne</h2>
      <ol>
        <li>
          Do korzystania ze Sklepu potrzebne są: urządzenie z dostępem do internetu, aktualna przeglądarka z włączoną obsługą JavaScript
          oraz zapisu danych w przeglądarce (koszyk jest zapamiętywany w przeglądarce) i adres e-mail.
        </li>
        <li>Zakupy nie wymagają zakładania konta. Zamówienie składa się, podając dane potrzebne do realizacji.</li>
        <li>
          Przez Sklep świadczone są nieodpłatne usługi elektroniczne: przeglądanie oferty, koszyk, składanie zamówień,
          formularz „Powiadom o dostępności” oraz formularz „Nie masz produktu? Napisz, sprowadzimy”. Usługi można zakończyć w każdej chwili,
          przestając z nich korzystać. Powiadomienie o dostępności można anulować, pisząc na adres e-mail Sprzedawcy.
        </li>
        <li>Klient nie może przesyłać przez Sklep treści bezprawnych.</li>
      </ol>

      <h2>§ 3. Składanie zamówień i zawarcie umowy</h2>
      <ol>
        <li>Informacje o produktach w Sklepie (opisy, zdjęcia, ceny, dostępność) stanowią zaproszenie do zawarcia umowy.</li>
        <li>
          Zamówienie składa się przez dodanie produktów do koszyka, wybór dostawy i płatności, podanie danych, akceptację Regulaminu
          i kliknięcie przycisku „Zamawiam z obowiązkiem zapłaty”. Przed złożeniem zamówienia można poprawić dane i zawartość koszyka.
        </li>
        <li>Zamówienie wymaga podania prawdziwych danych: imienia i nazwiska, adresu e-mail, numeru telefonu oraz paczkomatu lub adresu dostawy.</li>
        <li>
          Po złożeniu zamówienia Klient dostaje e-mail z potwierdzeniem. Umowa sprzedaży zostaje zawarta w chwili złożenia zamówienia
          i otrzymania przez Klienta tego potwierdzenia.
        </li>
        <li>
          Jeśli pojedynczego produktu zabraknie mimo zamówienia, Sprzedawca niezwłocznie skontaktuje się z Klientem. Klient może wtedy
          wybrać zwrot ceny za ten produkt, poczekać na dostawę albo wybrać inny produkt. Zapłacona kwota za niedostępny produkt zostanie zwrócona.
        </li>
        <li>Klient może anulować zamówienie przed jego wysyłką, pisząc na adres e-mail Sprzedawcy. Zapłacone kwoty zostaną zwrócone.</li>
      </ol>

      <h2>§ 4. Ceny i płatności</h2>
      <ol>
        <li>
          {vatFree
            ? 'Sprzedawca korzysta ze zwolnienia z podatku VAT, dlatego ceny w Sklepie nie zawierają podatku VAT i są cenami końcowymi do zapłaty.'
            : 'Ceny w Sklepie są cenami brutto, zawierają podatek VAT. Do ceny produktów dolicza się koszt dostawy wybrany przez Klienta.'}
        </li>
        <li>
          Przy produktach w promocji Sklep podaje najniższą cenę z 30 dni przed obniżką. Cena obowiązująca w chwili złożenia zamówienia
          jest wiążąca, także gdy później się zmieni.
        </li>
        <li>
          Klient może zapłacić: (a) przez Przelewy24 (BLIK, szybki przelew, karta), (b) przelewem tradycyjnym na rachunek
          Sprzedawcy podany po złożeniu zamówienia, (c) przy odbiorze (pobranie), jeśli ta opcja jest widoczna w zamówieniu.
        </li>
        <li>
          Płatności online obsługuje PayPro S.A. (Przelewy24). Sklep nie przechowuje danych kart płatniczych ani danych logowania do banku.
        </li>
        <li>
          Przy przelewie tradycyjnym Klient powinien zapłacić w ciągu 7 dni, wpisując w tytule numer zamówienia. Zamówienie jest realizowane
          po zaksięgowaniu wpłaty. Po bezskutecznym upływie tego terminu Sprzedawca może anulować zamówienie.
        </li>
        <li>Sprzedawca wystawia dokument sprzedaży zgodnie z obowiązującymi przepisami i przesyła go na życzenie Klienta oraz w sposób uzgodniony przy zamówieniu.</li>
      </ol>

      <h2>§ 5. Dostawa</h2>
      <ol>
        <li>
          Dostępne sposoby dostawy i ich koszt:
          <ul>
            {Object.values(SHIPPING).map((d) => <li key={d.label}>{d.label}: {price(d.price)}</li>)}
          </ul>
          Dostawa jest darmowa przy zamówieniach od {price(FREE_SHIPPING_FROM)}.
        </li>
        <li>
          Zamówienia z potwierdzoną płatnością lub wybranym pobraniem są przygotowywane w dni robocze.
          {handling === 0
            ? <> Zamówienia złożone do godz. {cutoff} Sprzedawca wysyła zwykle tego samego dnia roboczego, późniejsze w kolejnym dniu roboczym.</>
            : <> Zamówienia złożone do godz. {cutoff} Sprzedawca wysyła zwykle po {handling} {handling === 1 ? 'dniu roboczym' : 'dniach roboczych'}, późniejsze dzień później.</>}
          {' '}Termin dostawy wyświetlany przy zamówieniu jest przewidywany i zależy od przewoźnika.
        </li>
        <li>
          Przy dostawie do paczkomatu Klient odbiera przesyłkę na podstawie kodu odbioru wysłanego przez przewoźnika SMS-em i e-mailem,
          w terminie wskazanym przez przewoźnika.
        </li>
        <li>
          Klient powinien sprawdzić przesyłkę przy odbiorze. W razie widocznego uszkodzenia powinien spisać protokół szkody z kurierem
          albo zgłosić uszkodzenie przewoźnikowi i Sprzedawcy, najlepiej ze zdjęciami. Brak protokołu nie pozbawia Klienta praw wynikających z przepisów.
        </li>
      </ol>

      <h2>§ 6. Karma i produkty dla zwierząt</h2>
      <ol>
        <li>
          Opisy, składy, analizy i zalecenia żywieniowe pochodzą od producentów. Producent może zmienić skład lub wygląd opakowania,
          dlatego w razie wątpliwości lub alergii zwierzęcia prosimy o sprawdzenie etykiety na otrzymanym produkcie.
        </li>
        <li>Karmy weterynaryjne i dietetyczne należy stosować po konsultacji z lekarzem weterynarii. Informacje w Sklepie nie zastępują porady weterynaryjnej.</li>
        <li>Zdjęcia produktów mają charakter poglądowy.</li>
      </ol>

      <h2>§ 7. Odstąpienie od umowy i reklamacje</h2>
      <ol>
        <li>
          Konsument ma prawo odstąpić od umowy w ciągu 14 dni bez podania przyczyny, z wyjątkami przewidzianymi w przepisach.
          Szczegóły, termin, koszty i wzór formularza podaje strona <Link href="/zwroty">Zwroty i reklamacje</Link>, która stanowi część Regulaminu.
        </li>
        <li>
          Sprzedawca odpowiada za zgodność sprzedanego towaru z umową na zasadach określonych w przepisach prawa.
          Zasady składania reklamacji podaje strona <Link href="/zwroty">Zwroty i reklamacje</Link>.
        </li>
      </ol>

      <h2>§ 8. Dane osobowe</h2>
      <p>Zasady przetwarzania danych osobowych opisuje <Link href="/polityka-prywatnosci">Polityka prywatności</Link>, a zasady korzystania z pamięci przeglądarki <Link href="/polityka-cookies">Polityka cookies</Link>.</p>

      <h2>§ 9. Pozasądowe rozwiązywanie sporów</h2>
      <p>
        Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w szczególności z mediacji
        lub sądu polubownego, a także zwrócić się o pomoc do powiatowego (miejskiego) rzecznika konsumentów lub do Wojewódzkiego Inspektoratu
        Inspekcji Handlowej. Korzystanie z tych sposobów jest dobrowolne i wymaga zgody obu stron. Informacje i wzory wniosków są na stronie
        Urzędu Ochrony Konkurencji i Konsumentów (uokik.gov.pl).
      </p>

      <h2>§ 10. Postanowienia końcowe</h2>
      <ol>
        <li>Do umów zawieranych przez Sklep stosuje się prawo polskie. Wobec Konsumentów nie wyłącza się przepisów, które chronią go na mocy prawa kraju jego zamieszkania.</li>
        <li>Sprzedawca może zmienić Regulamin z ważnych przyczyn, w szczególności przy zmianie przepisów, oferty płatności i dostaw lub działania Sklepu. Zmiany nie dotyczą zamówień złożonych przed ich wprowadzeniem.</li>
        <li>Regulamin jest dostępny na stronie Sklepu i można go zapisać lub wydrukować. Klient dostaje do niego link w e-mailu z potwierdzeniem zamówienia.</li>
      </ol>
    </Doc>
  );
}
