import { getSettings } from '@/lib/settings';
import { sellerAddress } from '@/lib/legal';
import Doc, { Val } from '@/components/legal/Doc';

export const metadata = { title: 'Polityka prywatności' };

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <Doc title="Polityka prywatności" settings={s}>
      <h2>1. Administrator danych</h2>
      <p>
        Administratorem danych osobowych jest <Val v={s.company_name} label="nazwa firmy" />, <Val v={sellerAddress(s)} label="adres" />,
        NIP <Val v={s.nip} label="NIP" />. Kontakt w sprawach danych osobowych: <Val v={s.email} label="e-mail" />,
        telefon <Val v={s.phone} label="telefon" />.
      </p>

      <h2>2. Jakie dane, w jakim celu i na jakiej podstawie</h2>
      <table>
        <thead>
          <tr><th>Cel</th><th>Dane</th><th>Podstawa prawna</th><th>Jak długo</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Realizacja zamówienia: zawarcie i wykonanie umowy, płatność, dostawa, kontakt w sprawie zamówienia</td>
            <td>imię i nazwisko, e-mail, telefon, adres lub paczkomat, treść zamówienia, uwagi do zamówienia</td>
            <td>wykonanie umowy (art. 6 ust. 1 lit. b RODO)</td>
            <td>do czasu zrealizowania zamówienia i rozpatrzenia ewentualnych zwrotów i reklamacji</td>
          </tr>
          <tr>
            <td>Księgowość i podatki</td>
            <td>dane z zamówienia i dokumentu sprzedaży</td>
            <td>obowiązek prawny (art. 6 ust. 1 lit. c RODO)</td>
            <td>5 lat od końca roku podatkowego, w którym powstał obowiązek podatkowy</td>
          </tr>
          <tr>
            <td>Obrona przed roszczeniami lub ich dochodzenie, bezpieczeństwo sklepu</td>
            <td>dane z zamówienia, korespondencja, dziennik wysłanych e-maili</td>
            <td>prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO)</td>
            <td>do czasu przedawnienia roszczeń</td>
          </tr>
          <tr>
            <td>Powiadomienie o dostępności produktu</td>
            <td>adres e-mail, wybrany produkt</td>
            <td>zgoda (art. 6 ust. 1 lit. a RODO), wyrażona przez wysłanie formularza</td>
            <td>do wysłania powiadomienia lub wycofania zgody</td>
          </tr>
          <tr>
            <td>Zgłoszenie „Nie masz produktu? Napisz, sprowadzimy”</td>
            <td>e-mail, treść zgłoszenia</td>
            <td>podjęcie działań na żądanie osoby przed zawarciem umowy (art. 6 ust. 1 lit. b RODO)</td>
            <td>do czasu odpowiedzi i krótko po niej, nie dłużej niż 12 miesięcy</td>
          </tr>
          <tr>
            <td>Korespondencja e-mailowa i telefoniczna</td>
            <td>dane podane w wiadomości</td>
            <td>prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO) albo wykonanie umowy</td>
            <td>do zakończenia sprawy, potem do przedawnienia roszczeń</td>
          </tr>
        </tbody>
      </table>
      <p>
        Podanie danych potrzebnych do zamówienia jest dobrowolne, ale bez nich nie da się zrealizować zamówienia. Dane z formularzy
        „Powiadom o dostępności” i „Sprowadzimy” są dobrowolne.
      </p>
      <p>Nie podejmujemy decyzji w sposób zautomatyzowany i nie profilujemy Klientów. Sklep nie wymaga zakładania konta.</p>

      <h2>3. Komu przekazujemy dane</h2>
      <p>Dane trafiają tylko do podmiotów potrzebnych do działania sklepu, które przetwarzają je na nasze zlecenie albo we własnym zakresie:</p>
      <ul>
        <li>operatorzy płatności: PayPro S.A. (Przelewy24), przy płatności online;</li>
        <li>przewoźnicy: InPost lub inny przewoźnik wybrany przy zamówieniu (imię i nazwisko, telefon, e-mail, adres lub paczkomat);</li>
        <li>dostawca bazy danych sklepu: Supabase (serwery w Europie);</li>
        <li>dostawca hostingu sklepu: Vercel Inc. (USA);</li>
        <li>dostawca wysyłki e-maili: Resend (USA);</li>
        <li>biuro rachunkowe i doradcy prawni, w zakresie potrzebnym do obsługi księgowej i prawnej;</li>
        <li>organy państwowe, gdy wymagają tego przepisy.</li>
      </ul>
      <p>
        Przekazanie danych do USA odbywa się z zastosowaniem zabezpieczeń przewidzianych w RODO, w szczególności standardowych klauzul
        umownych lub ramy Data Privacy Framework, jeśli dostawca w niej uczestniczy. Nie sprzedajemy danych.
      </p>
      <p>
        Przy wyborze paczkomatu na mapie przeglądarka łączy się z serwisami zewnętrznymi (InPost, OpenStreetMap), które widzą adres IP urządzenia
        i wpisane wyszukiwane miejsce. Szczegóły w <a href="/polityka-cookies">Polityce cookies</a>.
      </p>

      <h2>4. Twoje prawa</h2>
      <p>Masz prawo do:</p>
      <ul>
        <li>dostępu do swoich danych i uzyskania ich kopii,</li>
        <li>sprostowania danych,</li>
        <li>usunięcia danych, ograniczenia przetwarzania i sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,</li>
        <li>przenoszenia danych, jeśli przetwarzamy je na podstawie umowy lub zgody w sposób zautomatyzowany,</li>
        <li>wycofania zgody w każdej chwili, bez wpływu na zgodność z prawem przetwarzania przed jej wycofaniem,</li>
        <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).</li>
      </ul>
      <p>
        Aby skorzystać z praw, napisz na adres <Val v={s.email} label="e-mail" />. Nie wszystkie prawa przysługują w każdej sytuacji,
        na przykład dane ze sprzedaży musimy przechowywać przez okres wymagany przepisami podatkowymi.
      </p>

      <h2>5. Bezpieczeństwo</h2>
      <p>
        Połączenie ze sklepem jest szyfrowane (HTTPS). Dostęp do danych zamówień mają tylko upoważnione osoby po zalogowaniu do panelu.
        Sklep nie przechowuje danych kart płatniczych.
      </p>

      <h2>6. Zmiany</h2>
      <p>Politykę prywatności możemy aktualizować, na przykład przy zmianie przepisów lub usług. Aktualna wersja jest zawsze na tej stronie.</p>
    </Doc>
  );
}
