# Izmene

Format: [verzija] – datum (dd.mm.gggg).

## [Neobjavljeno]
### Dodato
- Osnova aplikacije: Tauri 2 + React + TypeScript, SQLite baza sa numerisanim migracijama i backup-om pre migracije.
- Glavni ekran: tipovi i projekti levo, pretraga dok kucaš, kartice, kopiranje jednim klikom, prečice.
- Editor: naslov, tip, projekat, oznake, tekst, zvezdica, šablon za „nastavak”, „Dupliraj”, brojač znakova, potvrda pri izlasku i brisanju.
- Logika izvoza/uvoza (JSON sa `schemaVersion`, CSV sa BOM-om) i testovi.
- CI na svaki PR (windows-latest) sa installerom kao artifact.
- Dugme „Uvezi JSON”: provera fajla, pregled („dodaće se X, izmeniti Y”), potvrda, automatski backup pre uvoza; ako upis pukne na pola, baza se vraća iz tog backup-a.
