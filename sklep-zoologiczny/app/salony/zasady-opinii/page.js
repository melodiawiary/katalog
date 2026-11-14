import Link from 'next/link';

export const metadata = { title: 'Zasady opinii o salonach', description: 'Jak powstają i jak sprawdzamy opinie o salonach groomerskich.' };

export default function ReviewRules() {
  return (
    <article className="legal">
      <h1>Zasady opinii o salonach</h1>
      <p className="legal-draft">Wersja robocza: tekst nie został jeszcze sprawdzony przez prawnika.</p>
      <h2>Kto może dodać opinię</h2>
      <p>Opinię może dodać każdy zalogowany użytkownik, jedną o danym salonie (można ją później poprawić). <strong>Nie sprawdzamy, czy autor korzystał z usług salonu</strong>, dlatego prosimy o pisanie wyłącznie o własnych doświadczeniach. W jednym dniu można dodać do 5 nowych opinii.</p>
      <h2>Jak sprawdzamy opinie</h2>
      <p>Opinie są weryfikowane przez nas przed publikacją albo po niej (zależnie od ustawień serwisu), a każdą opublikowaną opinię można zgłosić jako naruszającą zasady. Nie przyjmujemy płatności za opinie i nie usuwamy opinii tylko dlatego, że są negatywne. Ukrywamy wyłącznie wpisy, które zawierają wulgaryzmy, groźby, dane osobowe, reklamy lub spam, dotyczą czegoś innego niż usługi salonu albo wyglądają na fałszywe.</p>
      <h2>Jak liczymy ranking</h2>
      <p>Przy salonie pokazujemy zwykłą średnią ocen i liczbę opinii. Kolejność w rankingu miasta uwzględnia liczbę opinii (jedna ocena 5/5 nie wyprzedza salonu z kilkudziesięcioma dobrymi ocenami), nowsze opinie liczą się bardziej niż stare, a niewielki bonus dostają salony z kompletnym profilem i sprawdzone przez nas. Salony bez opinii nie mają miejsca w rankingu. Płatne wyróżnienia, jeśli się pojawią, będą zawsze oznaczone jako „Promowane” i nie wpłyną na ocenę ani miejsce w rankingu.</p>
      <h2>Zgłoszenia</h2>
      <p>Jeśli uważasz, że opinia łamie zasady, użyj przycisku „Zgłoś nadużycie” pod opinią. Właściciel salonu może też zgłosić swój salon i poprosić o poprawę lub usunięcie wpisu przez formularz na stronie salonu.</p>
      <p><Link href="/salony">← Salony</Link></p>
    </article>
  );
}
