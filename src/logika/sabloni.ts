// Šablon za tip „nastavak” i pomoćne funkcije za editor.
import { kljucNaziva } from "./normalizacija";

export const SABLON_NASTAVAK = [
  "## Gde smo stali",
  "",
  "",
  "## Sledeći korak",
  "",
  "",
  "## Otvorena pitanja",
  "",
  "",
  "## Važni linkovi i fajlovi",
  "",
].join("\n");

/** Naslov kopije pri dupliranju, skraćen tako da ne pređe dozvoljenu dužinu. */
export function naslovKopije(naslov: string, max = 200): string {
  const sufiks = " (kopija)";
  // Ako je naslov predugačak, skraćujemo ga, a „(kopija)” uvek ostaje na kraju.
  return naslov.slice(0, max - sufiks.length) + sufiks;
}

/** Prva 3 reda teksta za prikaz na kartici. */
export function prvaTriReda(tekst: string): string {
  return tekst.split(/\r?\n/).slice(0, 3).join("\n");
}

/** Pretvara unos oznaka „ai, rad,  Claude” u listu bez duplikata. */
export function parsirajOznake(unos: string): string[] {
  const rezultat: string[] = [];
  const vidjeno = new Set<string>();
  for (const deo of unos.split(",")) {
    const oznaka = deo.trim().replace(/\s+/g, " ");
    // „Šablon” i „sablon” su ista oznaka: poredimo bez kvačica i velikih slova.
    const kljuc = kljucNaziva(oznaka);
    if (oznaka && !vidjeno.has(kljuc)) {
      vidjeno.add(kljuc);
      rezultat.push(oznaka);
    }
  }
  return rezultat;
}
