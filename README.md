# Biblioteka promptova i nastavaka

Desktop aplikacija za Windows u kojoj čuvam tekstove koje stalno koristim u Claude-u: **promptove**, **instrukcije projekata** i **beleške za nastavak rada** između chatova. Svaki tekst se nađe za par sekundi i kopira jednim klikom.

> Status: u izradi (faza 1). Ovaj README se dopunjava do verzije v0.1.0.

## Šta radi
- Lista kartica sa pretragom dok kucaš, po naslovu, tekstu i oznakama. Pretraga ne pravi razliku između velikih i malih slova ni između „č” i „c” („cokolada” nalazi „Čokolada”).
- Filter po tipu (Promptovi / Instrukcije / Nastavci) i po projektu.
- Redosled: omiljeni, pa kopirani u poslednjih 14 dana, pa ostali po datumu izmene.
- Dugme „Kopiraj” stavlja tekst u clipboard i beleži broj i vreme kopiranja.
- Editor sa brojačem znakova, šablonom za „nastavak” i dugmetom „Dupliraj”.
- Prečice: **Ctrl+F** pretraga, **Ctrl+N** novi unos, **↑/↓** izbor kartice, **Enter** kopira, **Ctrl+S** čuva, **Esc** nazad.

## Instalacija
1. Na stranici **Releases** ovog repoa preuzmi `Biblioteka promptova_…_x64-setup.exe`.
2. Pokreni ga. Windows može da prikaže plavi prozor „Windows protected your PC” (SmartScreen), jer aplikacija nije potpisana. Klikni **More info → Run anyway**.
3. Aplikacija se instalira samo za tvog korisnika i pojavi se u Start meniju kao „Biblioteka promptova”.

## Automatsko ažuriranje
Pri svakom pokretanju aplikacija proveri da li na GitHub Release-u postoji novija verzija. Ako postoji, sama je preuzme, instalira i ponovo se pokrene (traje nekoliko sekundi, pre nego što počneš da kucaš, pa se ništa ne gubi). Bez interneta aplikacija radi normalno i proverava sledeći put. Nove verzije su potpisane, pa aplikacija prihvata samo installer napravljen u ovom repou.

## Gde su podaci
Svi podaci su lokalno, u folderu:

```
%APPDATA%\biblioteka-promptova
```

(npr. `C:\Users\Dusan\AppData\Roaming\biblioteka-promptova`). U njemu su:
- `biblioteka.db` – baza (SQLite),
- `backup\` – kopije baze (čuva se poslednjih 10),
- `biblioteka.log` – log grešaka.

Nema slanja podataka na internet.

## Backup
- Pre svake promene šeme baze aplikacija sama pravi kopiju u `backup\`.
- Dugme „Backup sada”, izvoz/uvoz (JSON i CSV) i vraćanje iz backup-a stižu u Podešavanjima (faza 2).

## Za razvoj
```
npm ci
npm run tauri dev     # pokretanje u razvoju
npm test              # Vitest testovi
cd src-tauri && cargo test
```
Installer gradi GitHub Actions (`.github/workflows/ci.yml` na svaki PR, `release.yml` na tag `v*`).
