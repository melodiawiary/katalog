# Mapa myśli serwisu: sklep + salony + Akademia

Wersja graficzna (tablica): https://claude.ai/artifact/9yrgVbMTMZvu52PGc9Zd5Y
Ten plik jest wersją tekstową tej samej mapy. Przy zmianach planu aktualizować oba.
Uzasadnienie zmian z 2026-11-13: `KRYTYKA_KLIENTA.md` (dokumenty projektu Claude).

Legenda: [GOTOWE] zrobione · [ETAP 1-5] budujemy · [PÓŹNIEJ] plan na przyszłość
(Decyzje z 2026-11-14 potwierdzone przez Mariusza: próg miasta, "Brak opinii", weryfikacja właściciela.)

**Zasada od 2026-11-13: najpierw sklep, który sprzedaje, potem salony.**
Klient przychodzi po konkretny produkt (np. "Brit Care Adult Large Lamb 12 kg"). Jeśli go nie znajdzie
w kilka sekund, idzie do zooplus, Zooartu, Kakadu albo na Allegro. Katalog groomerów pokazujemy publicznie
dopiero z gotową listą salonów, bo pusta mapa odstrasza.

**Uzupełnienie 2026-11-14: katalog obejmuje wszystkich groomerów w Polsce, nie tylko Trójmiasto.**
Dane salonów zbieramy z otwartych baz (na start OpenStreetMap) do prywatnej listy zaproszeń, miasto po mieście; publicznie pokazujemy tylko to, co wskazano niżej (model zasilania katalogu).
Klienci oceniają salony, ranking powstaje z ocen. Właściciele sami zgłaszają się po przejęcie profilu, bo chcą mieć wysoki ranking
i wyróżnienie. To zmienia kilka punktów wcześniejszej mapy (zaznaczone niżej jako [ZMIANA]).

---

## Powiązania między obszarami

```
Sklep <──> Katalog miejsc ──> Mapa i szukanie
  ^              │                  ^
  │              v                  │
Konta ───────> Opinie ──────> Ranking <── Akademia

Fundament (prawo, nazwa, płatności, hosting) leży pod wszystkim.
```

- **Konta -> Sklep:** zamówienia przypisane do klienta, "Zamów ponownie", moje zwierzęta.
- **Sklep <-> Katalog:** produkty używane przez salon; kosmetyki po strzyżeniu.
- **Katalog -> Mapa:** każdy salon ma punkt na mapie.
- **Katalog -> Opinie:** opinie dotyczą konkretnego miejsca.
- **Konta -> Opinie:** opinię wystawia tylko zalogowany klient.
- **Opinie -> Ranking:** ranking liczony z opinii.
- **Ranking -> Mapa:** kolejność wyników wyszukiwania.
- **Akademia -> Ranking:** absolwent dostaje odznakę "Certyfikowany przez Akademię".

---

## 1. Sklep
- [GOTOWE] Produkty, kategorie, prosta wyszukiwarka (tylko po nazwie)
- [GOTOWE] Koszyk, zamówienie, dostawa
- [GOTOWE] Panel: produkty, zamówienia, stany
- [ETAP 1] Marka, cechy produktu (gatunek, wiek, wielkość psa, dieta, smak) i warianty (2 / 7 / 12 kg, S / M / L) w bazie
- [ETAP 1] Kategorie drzewem: Pies -> Karma -> Sucha (zamiast 5 płaskich)
- [ETAP 1] Wyszukiwarka: nazwa + marka + opis, tolerancja literówek, podpowiedzi przy wpisywaniu
- [ETAP 1] Pusty wynik: "może chodziło o..." i "nie mamy? napisz, sprowadzimy"
- [ETAP 1] Filtry: marka, wiek, wielkość psa, dieta, waga, cena od-do, dostępne, promocje
- [ETAP 1] Sortowanie (cena, popularność, nowości) i stronicowanie
- [ETAP 1] Karta produktu: galeria, skład, analiza, tabela dawkowania, kod EAN
- [ETAP 1] Cena za kg / litr, cena promocyjna z najniższą ceną z 30 dni (Omnibus)
- [ETAP 1] "Wysyłka dziś / jutro" zamiast liczby sztuk; "Powiadom o dostępności"
- [ETAP 1] Paczkomat wybierany z mapy (widget InPost), bez pełnego adresu przy paczkomacie
- [ETAP 1] Termin dostawy widoczny przed złożeniem zamówienia
- [ETAP 1] Usunąć "odbiór osobisty" (odbiór na miejscu odbiera zwolnienie z kasy fiskalnej)

## 1a. Zaplecze sklepu: import z hurtowni i raporty
- [ETAP 1] Import wielu produktów naraz: plik Excel / CSV wgrywany w panelu (szablon do pobrania)
- [ETAP 1] Dopasowanie kolumn pliku (raz na hurtownię, system zapamiętuje)
- [ETAP 1] Dopasowanie kategorii hurtowni do naszego drzewa kategorii
- [ETAP 1] Reguła ceny, np. "cena zakupu + 35%, zaokrąglij do ,99"
- [ETAP 1] Podgląd przed zapisem: nowe / zmienione / z błędami
- [ETAP 1] Zdjęcia pobierane z linków hurtowni (zmniejszane, limit miejsca w Supabase Free)
- [ETAP 1] Nowe produkty jako szkice; kolejne importy aktualizują cenę i stan po EAN, nie ruszają naszych opisów
- [ETAP 1] Historia cen (potrzebna do Omnibusa)
- [ETAP 1] Raporty: sprzedaż, koszty, zysk na produkcie i miesiącu, najlepsze produkty
- [ETAP 1] Przy zamówieniu zapisywane: cena zakupu, cena sprzedaży, stawka VAT (karma 8%, akcesoria 23%), dostawa, prowizja płatności
- [ETAP 1] "Pobierz dla księgowego": plik Excel ze sprzedażą za miesiąc (z podziałem VAT, gdy firma wejdzie w VAT)
- [PÓŹNIEJ] Automatyczny feed XML z hurtowni (np. co noc, Vercel Cron)
- [PÓŹNIEJ] Program do faktur (faktura na żądanie klienta), płatny abonament
- [ETAP 2] Opinie o produktach po zakupie
- [ETAP 2] Podobne produkty, "kupowane razem"
- [PÓŹNIEJ] Produkty polecane przez groomerów (z profilu salonu)
- [PÓŹNIEJ] Subskrypcja karmy z rabatem
- [PÓŹNIEJ] Ceneo / Google Shopping (wymaga EAN)

## 2. Katalog miejsc (salony)
- [ETAP 3] Miejsce ma typ: groomer; furtka na później: weterynarz, hotel, behawiorysta
- [ETAP 3] Profil: zdjęcia, opis, godziny otwarcia, telefon
- [ETAP 3] Usługi i cennik: pies / kot, rasa, wielkość
- [ETAP 3] Przewaga nad Booksy i Google: cennik wg rasy, czy strzyże koty, duże i lękliwe psy, zdjęcia przed / po
- [ETAP 3] Adres zamieniony na punkt na mapie (współrzędne)
- [ETAP 3] Status: zgłoszony -> zweryfikowany
- [GOTOWE] Import z OpenStreetMap (Trójmiasto, 29 salonów jako szkice, 2026-11-14); licencja ODbL, wymagane "© OpenStreetMap" na stronach katalogu
- [ETAP 3] [ZMIANA] Dwa poziomy wpisu: "niezweryfikowany" (z otwartych danych: bez odznak, z napisem) i "zweryfikowany" (sprawdzony przez nas albo przejęty przez właściciela)
- [ETAP 3] Zgłoszenie salonu przez właściciela: formularz "Dodaj swój salon" (nazwa, adres, telefon, pole "jestem właścicielem"); trafia do kolejki zgłoszeń w panelu, Mariusz zatwierdza (admin zakłada wpis jednym kliknięciem ze zgłoszenia)
- [ETAP 3] Przegląd po 60 dniach: lista salonów bez ani jednej opinii i bez przejętego profilu; Mariusz decyduje o każdym (zostaw / ukryj / usuń); nic nie znika automatycznie; domyślnie ukrywamy, nie kasujemy (zostaje źródło z OSM, więc kolejny import nie doda go drugi raz)
- [ETAP 3] [ZASADA SPRAWIEDLIWOŚCI MAŁE / DUŻE MIASTO] Próg otwarcia miasta jest niski i taki sam dla wszystkich: 5 przejrzanych salonów, a jeśli w mieście znamy mniej niż 5 (np. Przemyśl), otwieramy je z wszystkimi, które są. Górnego limitu nie ma: Warszawa pokazuje wszystkie przejrzane salony, lista po 20 na stronę, kolejność ustala ranking
- [ETAP 3] Małe miasto bez salonu w pobliżu: wyniki "najbliżsi w promieniu 30 km" (PostGIS), więc klient z małego miasta widzi salony z sąsiednich miejscowości
- [ETAP 3] Przegląd po 60 dniach nigdy nie podpowiada ukrycia ostatniego salonu w mieście
- [ETAP 3] Kolejne miasta: ten sam import (zapytanie Overpass dla miasta -> plik -> wgranie jako szkice -> przegląd adresów w panelu)
- [GOTOWE] Włączenie katalogu wymaga 5 opublikowanych salonów w jednym mieście (migracja 10_prog_miasta.sql). [ETAP 3] Otwieranie kolejnych miast osobno (małe miasta ze wszystkimi znanymi salonami) dochodzi razem z drugim miastem
- [PÓŹNIEJ] Inne źródła: rejestr CEIDG / REGON (kod PKD) po przeglądzie RODO (to dane osób prowadzących działalność, często z adresem domowym)
- [ETAP 3] [ZMIANA 2026-11-14] Model zasilania katalogu: katalog buduje się z ZGŁOSZEŃ SALONÓW, a nie z naszej listy. Admin wpisuje na start tylko 5 salonów na miasto (te najbardziej znane lub najlepiej opisane), żeby nie prowadzić tysięcy rekordów; to wystarcza też na otwarcie miasta. Reszta salonów z OSM zostaje szkicami, niewidocznymi dla klientów (prywatna lista zaproszeń). Salon pojawia się publicznie, gdy sam się zgłosi (formularz "Dodaj swój salon") albo gdy jest jednym z naszych 5 na miasto
- [ETAP 3] Wybór "5 na miasto": nie mamy legalnego źródła danych o tym, które salony są najczęściej wyszukiwane (Map Google nie kopiujemy), więc na start wybiera Mariusz (znane mu salony lub najlepiej opisane w OSM: adres, telefon, godziny); później kolejność ustalają opinie i kliknięcia w naszym serwisie
- [ETAP 3] Zaproszenia dla salonów: NIE wysyłamy masowo e-maili reklamowych do wszystkich salonów z listy (Prawo komunikacji elektronicznej wymaga zgody także od firm). Zaproszenie idzie innymi drogami: strona "Prowadzisz salon? Dołącz za darmo", list pocztowy na adres salonu, social media salonu przez formularz kontaktowy po konsultacji z prawnikiem, reklama lokalna; a zgody na kontakt zbieramy w formularzu zgłoszenia
- [ETAP 3] Salony, które publikujemy sami (5 na miasto), a prowadzone jako jednoosobowa firma: wysyłamy im krótką, neutralną informację o przetwarzaniu danych (RODO art. 14: skąd mamy dane, cel, prawa, jak poprawić lub usunąć, jak przejąć profil) najpóźniej w miesiąc od publikacji; pocztą lub e-mailem, treść do sprawdzenia przez prawnika
- [ZASADA] Nie kopiujemy danych z Map Google i nie scrapujemy serwisów typu Panorama Firm (łamie ich regulaminy). Salony spoza OSM dodajemy ręcznie, z poleceń klientów i ze zgłoszeń właścicieli
- [ETAP 5] Właściciel przejmuje profil ("To mój salon"): zasady poniżej
  - Wymaga konta (e-mail lub Google). Formularz: imię, rola (właściciel / zarządzający), kontakt, zgoda na weryfikację
  - Weryfikacja, trzy drogi od najłatwiejszej: (1) kod e-mailem na adres ze strony internetowej salonu; (2) kod SMS na telefon salonu z jego publicznej wizytówki (SMS dodajemy później, płatna bramka); (3) gdy te nie działają: zdjęcie szyldu lub drzwi salonu albo zgodność z wpisem w CEIDG (nazwa + adres), a Mariusz zatwierdza w panelu
  - Nie prosimy o dowód osobisty ani skan dokumentów tożsamości
  - Dwie osoby chcą ten sam salon: decyduje Mariusz; dotychczasowy właściciel profilu ma 14 dni na sprzeciw
  - Dane z weryfikacji: kod ważny 15 minut; zdjęcia i dokumenty z drogi (3) kasowane po 30 dniach od decyzji; zostaje tylko wpis: kto, kiedy, którą drogą, wynik
  - Przycisk "Zwolnij salon i usuń moje dane": profil wraca do "niezweryfikowany", teksty i zdjęcia właściciela kasujemy (na życzenie najpierw wysyłamy mu kopię), opinie klientów zostają (to nie jego dane)
  - Po przejęciu salon dostaje odznakę "Profil właściciela"; zasady rankingu i opinii bez zmian
  - Za darmo dla właściciela: godziny, telefon, opis, cennik, kilka zdjęć, odpowiedzi na opinie, podgląd miejsca w rankingu swojego miasta
- [PÓŹNIEJ] Wizytówka Plus (płatna): rozszerzona podstrona salonu, którą właściciel sam układa i upiększa. Dziś budujemy tylko furtkę: w panelu właściciela zakładka "Wizytówka Plus (wkrótce)" z zapisem chętnych (pokazuje nam zainteresowanie) oraz w bazie pole planu salonu (darmowy / plus, ważny do daty). Co dokładnie w niej będzie i ile kosztuje: ustalimy po sprawdzeniu zainteresowania
- [ZASADA] Wizytówka Plus zawsze oznaczona "Promowane", nie zmienia miejsca w rankingu, nie ukrywa ani nie edytuje opinii klientów

## 3. Mapa i szukanie w okolicy
- [ETAP 3] "Użyj mojej lokalizacji" albo miasto / kod pocztowy
- [ETAP 3] Najbliżsi w promieniu X km (PostGIS w Supabase)
- [ETAP 3] Filtry: pies / kot, usługa, ocena, cena
- [ETAP 3] [ZMIANA] Przy bazie całej Polski mapa i lista nie ładują wszystkiego: lista po 20 z numerowaniem stron, mapa tylko z widocznego obszaru (do 100 punktów, przy oddaleniu grupowanie), domyślnie szukanie po mieście albo pozycji
- [ETAP 3] Mapa OpenStreetMap (Leaflet, darmowa)
- [ETAP 4] [ZMIANA] Strony miast, np. "Groomer Gdynia", z pamięcią podręczną (ruch z Google i mniej zapytań do bazy); wcześniej było PÓŹNIEJ
- [PÓŹNIEJ] "Otwarte teraz", rezerwacja online

## 4. Konta i role
- [ETAP 2] Logowanie e-mailem i przez Google; zakup także bez konta
- [ETAP 2] Historia zamówień i "Zamów ponownie"
- [ETAP 2] Moje zwierzęta (imię, rasa, wiek, waga) -> dopasowane produkty
- [ETAP 2] Przypomnienie "kończy się karma?" (e-mail po wyliczonym czasie)
- [ETAP 4] Role: klient, właściciel salonu, admin; ulubione salony
- [PÓŹNIEJ] Kolejne role: kursant, instruktor, weterynarz

## 5. Opinie
- [ETAP 4] Tylko zalogowani, 1 opinia na salon (można edytować); oceniać można także salon niezweryfikowany
- [ETAP 4] Gwiazdki: jakość, podejście do zwierzęcia, czystość, cena
- [ETAP 4] Tekst i zdjęcie efektu
- [ETAP 4] Admin zatwierdza, zgłaszanie nadużyć
- [ETAP 4] Informacja, jak sprawdzamy opinie (wymóg prawa)
- [ETAP 5] Odpowiedź właściciela salonu

## 6. Ranking i odznaki
- [ETAP 4] Sortowanie listy: najlepiej oceniane, najwięcej opinii, najbliżej, najtańsze
- [ETAP 4] Strona "Ranking w mieście" (top 10 miasta)
- [ETAP 4] Średnia, liczba opinii i punkty rankingu zapisane w tabeli salonu i przeliczane po każdej opinii (nie liczone przy każdym wejściu klienta)
- [ETAP 4] Salon bez opinii pokazujemy z napisem "Brak opinii" i bez miejsca w rankingu
- [ETAP 4] Średnia ocen ważona liczbą opinii, z średnią miasta jako punktem startu (jedna ocena 5/5 nie wygrywa z 50 ocenami 4,8; w małym mieście kilka opinii wystarcza)
- [ETAP 4] Nowsze opinie ważą więcej
- [ETAP 4] Bonus za pełny i zweryfikowany profil
- [ETAP 4] Odznaki (tylko salony zweryfikowane, min. 3 opinie): "Polecany"; "Top w mieście" = 3 najlepsze w małym mieście, 10% najlepszych w dużym
- [ETAP 5] [ZMIANA] "Sprawdź swój ranking": właściciel przejmuje profil ("To mój salon": zgłoszenie, potwierdzenie telefonem lub e-mailem, zatwierdza admin), potem widzi miejsce w mieście, opinie, odpowiada i uzupełnia cennik
- [PÓŹNIEJ] Certyfikowany przez Akademię
- [PÓŹNIEJ] Płatne wyróżnienie, zawsze oznaczone "Promowane" (pierwsze źródło przychodu z katalogu: oferta pokazuje się salonom, które przejęły profil; nie wpływa na ocenę ani miejsce w rankingu)

## 7. Akademia (później)
- [ETAP 4] Zapis na listę chętnych (na nowej stronie głównej)
- [PÓŹNIEJ] Kursy pielęgnacji psów i kotów
- [PÓŹNIEJ] Egzaminy i certyfikaty
- [PÓŹNIEJ] Zestawy startowe w sklepie

## Fundament pod wszystko
- [ETAP 1] Nazwa serwisu i domena
- [ETAP 1] Firma: jednoosobowa działalność (CEIDG) albo dopisanie sklepu do istniejącej; działalność nierejestrowana za mała (limit 10 813,50 zł przychodu na kwartał w 2026)
- [ETAP 1] Wpis do rejestru podmiotów paszowych w powiatowym inspektoracie weterynarii (karma = pasza, warunek stawki 8%)
- [ETAP 1] Decyzja z księgowym: zwolnienie z VAT (limit 240 000 zł/rok w 2026) czy czynny VAT; forma podatku (skala / liniowy / ryczałt)
- [ETAP 1] ZUS: ulga na start 6 mies. (tylko zdrowotna), potem preferencyjny 24 mies., potem pełny; płaci się raz na osobę, nie na firmę
- [ETAP 1] Regulaminy (sklep, katalog, opinie), polityka prywatności (RODO), cookies, zwroty
- [ETAP 1] Płatności online: BLIK / Przelewy24 (lub PayU), e-mail z potwierdzeniem zamówienia
- [ETAP 1] Vercel: plan Hobby tylko niekomercyjnie, przy sprzedaży plan Pro
- [ETAP 3] [ZMIANA] Przed publikacją mapy: 20-30 salonów z Trójmiasta (import z OSM + ręczny przegląd adresów i cen); wcześniej zakładaliśmy wpisywanie ręczne
- [ETAP 3] Koszty i obciążenie przy bazie całej Polski (pomiar z 2026-11-14, patrz sekcja "Koszty i obciążenie" niżej)
- [PÓŹNIEJ] Zarabianie: marża sklepu, wyróżnienia salonów, kursy

---

## Koszty i obciążenie przy bazie całej Polski (pomiar 2026-11-14)

Test na bazie Supabase z 10 000 sztucznych salonów (z godzinami, cennikiem i notatkami; po teście wszystko cofnięte):
- **Miejsce w bazie:** 10 000 salonów to ok. 25 MB (z indeksami). Cała baza ma dziś 22 MB, limit Free 500 MB, Pro 8 GB. Opinie to ok. 1 KB na sztukę, więc 100 000 opinii to ok. 100 MB.
- **Szybkość:** szukanie 20 salonów w mieście lub okolicy 20-65 ms, 200 salonów 110-190 ms.
- **Ruch z bazy do Vercela (egress Supabase):** 20 salonów na stronę to ok. 8 KB, 200 salonów ok. 80 KB. Limit Free 5 GB, Pro 250 GB. Dlatego lista po 20, a nie po 200.
- **Zdjęcia salonów** (gdy dojdą) to największy zjadacz miejsca: Free 1 GB, Pro 100 GB. Zmniejszamy je w przeglądarce, tak jak zdjęcia produktów.
- **Vercel:** katalog to zwykłe wywołania funkcji (kilka tysięcy dziennie przy sporym ruchu to nadal mało). Plan Hobby zabrania użytku komercyjnego, więc Pro (20 USD/miesiąc) i tak jest potrzebne przy sprzedaży.
- **Supabase Free usypia projekt po tygodniu bez ruchu i nie robi kopii zapasowych:** przed startem publicznym plan Pro (25 USD/miesiąc).
- **Poza naszymi serwerami:** kafelki mapy z OpenStreetMap i wyszukiwanie adresu (Nominatim) to bezpłatne usługi wolontariuszy z limitami użycia. Przy większym ruchu przechodzimy na płatnego dostawcę map i adresów (rząd kilkudziesięciu USD/miesiąc na początek). Wyszukiwania adresów mamy w pamięci podręcznej na dobę.
- **Wniosek:** sama liczba salonów nie obciąża serwerów. Obciążają je ruch, zdjęcia i opinie. Do pierwszych kilkudziesięciu tysięcy odwiedzin miesięcznie wystarczy Supabase Pro + Vercel Pro (ok. 45 USD/miesiąc).

---

## Kolejność budowy

1. **Etap 1: sklep, który sprzedaje.** Marka, cechy i warianty w bazie, import z hurtowni (CSV),
   wyszukiwarka, filtry, sortowanie, karta produktu (skład, cena za kg, Omnibus), paczkomat z mapy,
   BLIK / Przelewy24, e-mail z potwierdzeniem, raporty i plik dla księgowego.
   Równolegle formalności: firma, rejestr paszowy, decyzja o VAT, regulamin, nazwa i domena.
2. **Etap 2: konto klienta do zakupów.** Historia, "Zamów ponownie", moje zwierzęta, przypomnienie o karmie,
   opinie o produktach.
3. **Etap 3: katalog groomerów i mapa** (wpisy z importu i od admina; publicznie dopiero z przejrzonymi salonami z Trójmiasta).
   Potem miasto po miasto: import z OSM, przegląd, otwarcie miasta.
4. **Etap 4: opinie o salonach, ranking (sortowanie: najlepsze / najwięcej opinii), strony miast, odznaki, nowa strona główna** (sklep + salony, zapis do Akademii).
5. **Etap 5:** przejmowanie profilu przez właściciela ("Sprawdź swój ranking"), odpowiedzi na opinie, oferta "Promowane".
6. **Etap 6:** Akademia: kursy, egzaminy, certyfikaty.

## Strona główna (etap 4), od góry
1. Nagłówek: logo, duża wyszukiwarka z podpowiedziami, koszyk, menu Sklep / Groomerzy / Akademia
2. Baner: czym jest serwis + przyciski "Zakupy dla pupila" i "Znajdź groomera w pobliżu"
3. Pasek zaufania: darmowa dostawa od 200 zł, wysyłka dziś, zwroty 14 dni, BLIK
4. Kafelki "Dla psa" i "Dla kota" (+ pozostałe kategorie)
5. "Zamów ponownie" dla zalogowanych
6. Bestsellery / promocje
7. Polecani groomerzy w okolicy: mapka + 3 karty z oceną
8. Akademia: zapis na listę chętnych
9. "Prowadzisz salon? Dołącz za darmo"
10. Stopka: dane firmy, regulamin, prywatność, zwroty, kontakt
