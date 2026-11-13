# Mapa myśli serwisu: sklep + salony + Akademia

Wersja graficzna (tablica): https://claude.ai/artifact/9yrgVbMTMZvu52PGc9Zd5Y
Ten plik jest wersją tekstową tej samej mapy. Przy zmianach planu aktualizować oba.
Uzasadnienie zmian z 2026-11-13: `KRYTYKA_KLIENTA.md` (dokumenty projektu Claude).

Legenda: [GOTOWE] zrobione · [ETAP 1-5] budujemy · [PÓŹNIEJ] plan na przyszłość

**Zasada od 2026-11-13: najpierw sklep, który sprzedaje, potem salony.**
Klient przychodzi po konkretny produkt (np. "Brit Care Adult Large Lamb 12 kg"). Jeśli go nie znajdzie
w kilka sekund, idzie do zooplus, Zooartu, Kakadu albo na Allegro. Katalog groomerów pokazujemy publicznie
dopiero z gotową listą salonów, bo pusta mapa odstrasza.

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
- [ETAP 5] Właściciel przejmuje profil ("To mój salon")

## 3. Mapa i szukanie w okolicy
- [ETAP 3] "Użyj mojej lokalizacji" albo miasto / kod pocztowy
- [ETAP 3] Najbliżsi w promieniu X km (PostGIS w Supabase)
- [ETAP 3] Filtry: pies / kot, usługa, ocena, cena
- [ETAP 3] Mapa OpenStreetMap (Leaflet, darmowa)
- [PÓŹNIEJ] Strony miast, np. "Groomer Gdynia" (ruch z Google)
- [PÓŹNIEJ] "Otwarte teraz", rezerwacja online

## 4. Konta i role
- [ETAP 2] Logowanie e-mailem i przez Google; zakup także bez konta
- [ETAP 2] Historia zamówień i "Zamów ponownie"
- [ETAP 2] Moje zwierzęta (imię, rasa, wiek, waga) -> dopasowane produkty
- [ETAP 2] Przypomnienie "kończy się karma?" (e-mail po wyliczonym czasie)
- [ETAP 4] Role: klient, właściciel salonu, admin; ulubione salony
- [PÓŹNIEJ] Kolejne role: kursant, instruktor, weterynarz

## 5. Opinie
- [ETAP 4] Tylko zalogowani, 1 opinia na salon (można edytować)
- [ETAP 4] Gwiazdki: jakość, podejście do zwierzęcia, czystość, cena
- [ETAP 4] Tekst i zdjęcie efektu
- [ETAP 4] Admin zatwierdza, zgłaszanie nadużyć
- [ETAP 4] Informacja, jak sprawdzamy opinie (wymóg prawa)
- [ETAP 5] Odpowiedź właściciela salonu

## 6. Ranking i odznaki
- [ETAP 4] Średnia ocen ważona liczbą opinii (jedna ocena 5/5 nie wygrywa z 50 ocenami 4,8)
- [ETAP 4] Nowsze opinie ważą więcej
- [ETAP 4] Bonus za pełny i zweryfikowany profil
- [ETAP 4] Odznaki: Polecany, Top w mieście
- [PÓŹNIEJ] Certyfikowany przez Akademię
- [PÓŹNIEJ] Płatne wyróżnienie, zawsze oznaczone "Promowane"

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
- [ETAP 3] Przed publikacją mapy: 20-30 salonów z Trójmiasta wpisanych ręcznie
- [PÓŹNIEJ] Zarabianie: marża sklepu, wyróżnienia salonów, kursy

---

## Kolejność budowy

1. **Etap 1: sklep, który sprzedaje.** Marka, cechy i warianty w bazie, import z hurtowni (CSV),
   wyszukiwarka, filtry, sortowanie, karta produktu (skład, cena za kg, Omnibus), paczkomat z mapy,
   BLIK / Przelewy24, e-mail z potwierdzeniem, raporty i plik dla księgowego.
   Równolegle formalności: firma, rejestr paszowy, decyzja o VAT, regulamin, nazwa i domena.
2. **Etap 2: konto klienta do zakupów.** Historia, "Zamów ponownie", moje zwierzęta, przypomnienie o karmie,
   opinie o produktach.
3. **Etap 3: katalog groomerów i mapa** (wpisy dodaje admin; publicznie dopiero z salonami z Trójmiasta).
4. **Etap 4: opinie o salonach, ranking i odznaki, nowa strona główna** (sklep + salony, zapis do Akademii).
5. **Etap 5:** konta salonów (przejęcie profilu), odpowiedzi na opinie.
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
