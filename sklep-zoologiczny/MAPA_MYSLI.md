# Mapa myśli serwisu: sklep + salony + Akademia

Wersja graficzna (tablica): https://claude.ai/artifact/9yrgVbMTMZvu52PGc9Zd5Y
Ten plik jest wersją tekstową tej samej mapy. Przy zmianach planu aktualizować oba.

Legenda: [GOTOWE] zrobione · [ETAP 1-4] budujemy teraz · [PÓŹNIEJ] plan na przyszłość

Obecny priorytet: budujemy INFRASTRUKTURĘ. Liczba groomerów i treść na start nie są teraz problemem.

---

## Powiązania między obszarami

```
Sklep <──> Katalog miejsc ──> Mapa i szukanie
  ^              │                  ^
  │              v                  │
Konta ───────> Opinie ──────> Ranking <── Akademia

Fundament (prawo, nazwa, płatności, hosting) leży pod wszystkim.
```

- **Konta -> Sklep:** zamówienia przypisane do klienta.
- **Sklep <-> Katalog:** produkty polecane przez groomerów; salony mogą polecać produkty.
- **Katalog -> Mapa:** każdy salon ma punkt na mapie.
- **Katalog -> Opinie:** opinie dotyczą konkretnego miejsca.
- **Konta -> Opinie:** opinię wystawia tylko zalogowany klient.
- **Opinie -> Ranking:** ranking liczony z opinii.
- **Ranking -> Mapa:** kolejność wyników wyszukiwania.
- **Akademia -> Ranking:** absolwent dostaje odznakę "Certyfikowany przez Akademię".

---

## 1. Sklep
- [GOTOWE] Produkty, kategorie, wyszukiwarka (nacisk na psy i koty, pozostałe kategorie zostają)
- [GOTOWE] Koszyk, zamówienie, dostawa
- [GOTOWE] Panel: produkty, zamówienia, stany
- [PÓŹNIEJ] Polecane przez groomerów (produkty z profilu salonu)
- [PÓŹNIEJ] Opinie o produktach po zakupie

## 2. Katalog miejsc (salony)
- [ETAP 1] Miejsce ma typ: groomer; furtka na później: weterynarz, hotel, behawiorysta
- [ETAP 1] Profil: zdjęcia, opis, godziny otwarcia, telefon
- [ETAP 1] Usługi i cennik: pies / kot, rasa, wielkość
- [ETAP 1] Adres zamieniony na punkt na mapie (współrzędne)
- [ETAP 1] Status: zgłoszony -> zweryfikowany
- [ETAP 4] Właściciel przejmuje profil ("To mój salon")

## 3. Mapa i szukanie w okolicy
- [ETAP 1] "Użyj mojej lokalizacji" albo miasto / kod pocztowy
- [ETAP 1] Najbliżsi w promieniu X km (PostGIS w Supabase)
- [ETAP 1] Filtry: pies / kot, usługa, ocena, cena
- [ETAP 1] Mapa OpenStreetMap (Leaflet, darmowa)
- [PÓŹNIEJ] Strony miast, np. "Groomer Gdynia" (ruch z Google)
- [PÓŹNIEJ] "Otwarte teraz", rezerwacja online

## 4. Konta i role
- [ETAP 2] Logowanie e-mailem i przez Google
- [ETAP 2] Role: klient, właściciel salonu, admin
- [PÓŹNIEJ] Moje zwierzęta (imię, rasa) -> dopasowane produkty i salony
- [PÓŹNIEJ] Ulubione salony, historia zamówień
- [PÓŹNIEJ] Kolejne role: kursant, instruktor, weterynarz

## 5. Opinie
- [ETAP 2] Tylko zalogowani, 1 opinia na salon (można edytować)
- [ETAP 2] Gwiazdki: jakość, podejście do zwierzęcia, czystość, cena
- [ETAP 2] Tekst i zdjęcie efektu
- [ETAP 2] Admin zatwierdza, zgłaszanie nadużyć
- [ETAP 2] Informacja, jak sprawdzamy opinie (wymóg prawa)
- [ETAP 4] Odpowiedź właściciela salonu

## 6. Ranking i odznaki
- [ETAP 2] Średnia ocen ważona liczbą opinii (jedna ocena 5/5 nie wygrywa z 50 ocenami 4,8)
- [ETAP 2] Nowsze opinie ważą więcej
- [ETAP 2] Bonus za pełny i zweryfikowany profil
- [ETAP 2] Odznaki: Polecany, Top w mieście
- [PÓŹNIEJ] Certyfikowany przez Akademię
- [PÓŹNIEJ] Płatne wyróżnienie, zawsze oznaczone "Promowane"

## 7. Akademia (później)
- [ETAP 3] Zapis na listę chętnych (na stronie głównej)
- [PÓŹNIEJ] Kursy pielęgnacji psów i kotów
- [PÓŹNIEJ] Egzaminy i certyfikaty
- [PÓŹNIEJ] Zestawy startowe w sklepie

## Fundament pod wszystko
- Nazwa serwisu i domena (do ustalenia)
- Firma, regulaminy (sklep, katalog, opinie), polityka prywatności (RODO), cookies
- Vercel: plan Hobby tylko niekomercyjnie, przy sprzedaży plan Pro
- [ETAP 5] Płatności online (Przelewy24 / PayU), e-maile z potwierdzeniem
- [PÓŹNIEJ] Zarabianie: marża sklepu, wyróżnienia salonów, kursy

---

## Kolejność budowy

1. **Etap 1:** Katalog salonów + mapa i szukanie w okolicy (wpisy dodaje admin z panelu)
2. **Etap 2:** Konta klientów, opinie, ranking i odznaki
3. **Etap 3:** Nowa strona główna łącząca sklep i salony (+ zapis do Akademii)
4. **Etap 4:** Konta salonów (przejęcie profilu), odpowiedzi na opinie
5. **Etap 5:** Płatności online, e-maile
6. **Etap 6:** Akademia: kursy, egzaminy, certyfikaty

## Strona główna (etap 3), od góry
1. Nagłówek: logo, wyszukiwarka, koszyk, menu Sklep / Groomerzy / Akademia
2. Baner: czym jest serwis + przyciski "Zakupy dla pupila" i "Znajdź groomera w pobliżu" + lokalizacja
3. Pasek zaufania: darmowa dostawa od 200 zł, wysyłka, zwroty 14 dni, bezpieczne płatności
4. Kafelki "Dla psa" i "Dla kota" (+ pozostałe kategorie)
5. Polecani groomerzy w okolicy: mapka + 3 karty z oceną
6. Bestsellery / nowości
7. Akademia: zapis na listę chętnych
8. "Prowadzisz salon? Dołącz za darmo"
9. Stopka: dane firmy, regulamin, prywatność, zwroty, kontakt
