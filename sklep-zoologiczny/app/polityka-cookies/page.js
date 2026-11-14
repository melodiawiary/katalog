import { getSettings } from '@/lib/settings';
import Doc, { Val } from '@/components/legal/Doc';
import CookieSettingsLink from '@/components/CookieSettingsLink';

export const metadata = { title: 'Polityka cookies' };

export default async function CookiesPage() {
  const s = await getSettings();
  return (
    <Doc title="Polityka cookies" settings={s}>
      <h2>1. Co zapisujemy w Twojej przeglądarce</h2>
      <p>
        Sklep zapisuje w przeglądarce (w pamięci lokalnej, podobnej do cookies) wyłącznie dane niezbędne do jego działania.
        Nie stosujemy cookies reklamowych, śledzących ani analitycznych i nie budujemy profili użytkowników.
      </p>
      <table>
        <thead><tr><th>Nazwa</th><th>Do czego służy</th><th>Jak długo</th></tr></thead>
        <tbody>
          <tr><td>koszyk-v1</td><td>Zawartość koszyka, żeby zakupy nie znikały po odświeżeniu strony.</td><td>do usunięcia przez Ciebie lub po złożeniu zamówienia</td></tr>
          <tr><td>dane-klienta</td><td>Ostatnio wpisane dane do zamówienia, żeby kolejne zamówienie było szybsze. Zostają tylko w Twojej przeglądarce.</td><td>do usunięcia przez Ciebie</td></tr>
          <tr><td>paczkomat</td><td>Ostatnio wybrany paczkomat.</td><td>do usunięcia przez Ciebie</td></tr>
          <tr><td>zgoda-cookies</td><td>Zapamiętanie Twojej decyzji z banera o cookies.</td><td>do usunięcia przez Ciebie</td></tr>
          <tr><td>sb-… (cookies logowania)</td><td>Tylko dla osób logujących się do panelu sklepu (administrator). Klienci ich nie dostają.</td><td>sesja logowania</td></tr>
        </tbody>
      </table>
      <p>Zapis tych danych jest niezbędny do świadczenia usługi, o którą prosisz (zakupy w sklepie), dlatego nie wymaga odrębnej zgody.</p>

      <h2>2. Usługi zewnętrzne</h2>
      <ul>
        <li>
          <strong>Mapa paczkomatów</strong> (przy wyborze dostawy do paczkomatu): przeglądarka pobiera kafelki mapy z OpenStreetMap, punkty z InPost,
          a wpisany adres lub miejsce jest wyszukiwany w usłudze Nominatim (OpenStreetMap). Te serwisy widzą adres IP urządzenia.
        </li>
        <li>
          <strong>Płatność Przelewy24</strong>: po wybraniu płatności online przechodzisz na stronę PayPro S.A., która działa na własnych zasadach
          i może używać własnych cookies.
        </li>
        <li><strong>Hosting</strong>: serwery sklepu zapisują standardowe logi techniczne (adres IP, czas i adres żądania) w celu bezpieczeństwa i naprawy błędów.</li>
      </ul>

      <h2>3. Jak zarządzać</h2>
      <p>
        Dane zapisane w pamięci przeglądarki możesz usunąć w jej ustawieniach (zwykle: Prywatność, Dane witryn, Usuń dane tej strony).
        Po usunięciu koszyk będzie pusty. Wyłączenie zapisu w przeglądarce uniemożliwi zakupy.
      </p>
      <p>Decyzję z banera możesz zobaczyć lub zmienić w każdej chwili: <CookieSettingsLink /></p>

      <h2>4. Kontakt</h2>
      <p>Pytania: <Val v={s.email} label="e-mail" />. Więcej o danych osobowych: <a href="/polityka-prywatnosci">Polityka prywatności</a>.</p>
    </Doc>
  );
}
