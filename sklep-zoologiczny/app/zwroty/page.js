import { getSettings } from '@/lib/settings';
import { sellerAddress } from '@/lib/legal';
import Doc, { Val } from '@/components/legal/Doc';

export const metadata = { title: 'Zwroty i reklamacje' };

export default async function ReturnsPage() {
  const s = await getSettings();
  const addr = sellerAddress(s);

  const formText = [
    `Adresat: ${s.company_name || '[nazwa firmy]'}, ${addr || '[adres]'}, e-mail: ${s.email || '[e-mail]'}`,
    '',
    'Ja niniejszym informuję o moim odstąpieniu od umowy sprzedaży następujących rzeczy:',
    '[nazwa produktów i ilość]',
    '',
    'Numer zamówienia: [numer]',
    'Data zawarcia umowy: [data]',
    'Data odbioru: [data]',
    'Imię i nazwisko: [imię i nazwisko]',
    'Adres: [adres]',
    'Numer konta do zwrotu pieniędzy: [numer konta]',
    '',
    'Data: [data]',
  ].join('\n');
  const mailto = s.email
    ? `mailto:${s.email}?subject=${encodeURIComponent('Odstąpienie od umowy - zamówienie nr ')}&body=${encodeURIComponent(formText)}`
    : '';

  return (
    <Doc title="Zwroty i reklamacje" settings={s}>
      <h2>1. Odstąpienie od umowy (zwrot w 14 dni)</h2>
      <ol>
        <li>
          Konsument może odstąpić od umowy sprzedaży zawartej na odległość w ciągu <strong>14 dni</strong> bez podania przyczyny.
          Termin liczy się od dnia, w którym Konsument (lub wskazana przez niego osoba trzecia, inna niż przewoźnik) objął towar w posiadanie.
          Jeśli zamówienie przyszło w kilku przesyłkach, termin liczy się od odebrania ostatniej z nich.
        </li>
        <li>
          Aby odstąpić od umowy, wystarczy wysłać jednoznaczne oświadczenie na adres e-mail <Val v={s.email} label="e-mail" /> albo
          listownie na adres <Val v={addr} label="adres" />. Można skorzystać z wzoru poniżej, ale nie trzeba. Do zachowania terminu
          wystarczy wysłać oświadczenie przed jego upływem.
        </li>
        <li>
          Sprzedawca potwierdzi otrzymanie oświadczenia e-mailem. Zwrot pieniędzy nastąpi w ciągu 14 dni od otrzymania oświadczenia,
          tym samym sposobem płatności, jakiego użył Konsument, chyba że Konsument wybrał inny sposób. Sprzedawca może wstrzymać zwrot
          do czasu otrzymania towaru z powrotem lub dowodu jego odesłania.
        </li>
        <li>
          Zwrot obejmuje cenę towaru i koszt dostawy do Konsumenta, w wysokości najtańszego zwykłego sposobu dostawy oferowanego w Sklepie.
          Dodatkowe koszty droższego sposobu dostawy nie są zwracane.
        </li>
        <li>
          Konsument odsyła towar niezwłocznie, nie później niż w ciągu 14 dni od odstąpienia, na adres: <Val v={s.company_name} label="nazwa firmy" />,{' '}
          <Val v={addr} label="adres" />. Towar należy zapakować tak, aby nie uległ uszkodzeniu. Bezpośredni koszt odesłania ponosi Konsument.
          Prosimy nie wysyłać zwrotów za pobraniem.
        </li>
        <li>
          Konsument odpowiada za zmniejszenie wartości towaru, które wynika z korzystania z niego w sposób wykraczający poza to,
          co jest konieczne do stwierdzenia charakteru, cech i funkcjonowania towaru.
        </li>
      </ol>

      <h3>Kiedy odstąpienie nie przysługuje</h3>
      <p>Prawo odstąpienia od umowy nie przysługuje Konsumentowi między innymi w odniesieniu do:</p>
      <ul>
        <li>
          towarów dostarczonych w zapieczętowanym opakowaniu, których po otwarciu opakowania nie można zwrócić ze względu na ochronę
          zdrowia lub ze względów higienicznych, jeśli opakowanie zostało otwarte po dostarczeniu. Dotyczy to w szczególności otwartej karmy,
          przysmaków i otwartych środków pielęgnacyjnych;
        </li>
        <li>towarów ulegających szybkiemu zepsuciu lub mających krótki termin przydatności do użycia;</li>
        <li>towarów wykonanych według specyfikacji Konsumenta lub służących zaspokojeniu jego zindywidualizowanych potrzeb.</li>
      </ul>
      <p>Zwrot nieotwartej karmy w oryginalnym, nieuszkodzonym opakowaniu jest zawsze możliwy w terminie 14 dni.</p>

      <h3>Wzór formularza odstąpienia od umowy</h3>
      <p className="muted">Formularz należy wypełnić i odesłać tylko w przypadku chęci odstąpienia od umowy.</p>
      <div className="legal-form">
        {formText.split('\n').map((line, i) => (line === '' ? <br key={i} /> : <p key={i}>{line}</p>))}
      </div>
      {mailto && (
        <p><a className="btn btn-small" href={mailto}>Napisz e-mail z gotowym formularzem</a></p>
      )}

      <h2>2. Reklamacje (niezgodność towaru z umową)</h2>
      <ol>
        <li>
          Sprzedawca odpowiada za to, że towar jest zgodny z umową, w tym za wady fizyczne i prawne. Dla Konsumenta odpowiedzialność trwa
          2 lata od dostarczenia towaru. Dla Klientów niebędących Konsumentami rękojmia jest wyłączona.
        </li>
        <li>
          Reklamację można złożyć e-mailem na adres <Val v={s.email} label="e-mail" /> albo listownie na adres <Val v={addr} label="adres" />.
          Prosimy podać numer zamówienia, opis problemu, czego Klient żąda (naprawa, wymiana, obniżenie ceny lub odstąpienie od umowy),
          a przy uszkodzeniu lub wadzie dołączyć zdjęcia, także zdjęcie etykiety i numeru partii.
        </li>
        <li>
          Sprzedawca odpowie na reklamację w ciągu <strong>14 dni</strong>. Brak odpowiedzi w tym terminie oznacza uznanie żądania Konsumenta.
        </li>
        <li>
          Konsument może żądać wymiany towaru na nowy lub jego naprawy. Jeśli to niemożliwe, nadmiernie kosztowne albo Sprzedawca nie zdążył
          z wymianą lub naprawą w odpowiednim czasie, Konsument może żądać obniżenia ceny albo odstąpić od umowy, o ile niezgodność jest istotna.
        </li>
        <li>Koszty dostarczenia towaru do reklamacji i jego odbioru pokrywa Sprzedawca. W przypadku karmy lub przysmaków prosimy zachować opakowanie z etykietą.</li>
        <li>Reklamacja nie wyłącza prawa do skorzystania z pozasądowych sposobów rozwiązywania sporów opisanych w Regulaminie.</li>
      </ol>

      <h2>3. Uszkodzenia w transporcie</h2>
      <p>
        Jeśli przesyłka dotarła uszkodzona, prosimy sfotografować paczkę i towar, zgłosić to przewoźnikowi i napisać do nas na adres
        <> <Val v={s.email} label="e-mail" /></>. Przyspieszymy wymianę lub zwrot pieniędzy.
      </p>
    </Doc>
  );
}
