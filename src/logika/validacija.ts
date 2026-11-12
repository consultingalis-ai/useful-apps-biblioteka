// Provera forme pre čuvanja. Vraća poruke na srpskom po polju; prazan objekat = sve je ispravno.
import { kljucNaziva } from "./normalizacija";
import { MAX_BROJ_OZNAKA, MAX_NASLOV, MAX_OZNAKA, MAX_TEKST, TIPOVI, type Projekat } from "./tipovi";

export interface FormaUnosa {
  naslov: string;
  tip: string;
  projekatId: string | null;
  oznake: string[];
  tekst: string;
}

export type Greske = Partial<Record<keyof FormaUnosa, string>>;

export function validirajUnos(forma: FormaUnosa, projekti: Projekat[]): Greske {
  const g: Greske = {};
  const naslov = forma.naslov.trim();
  if (!naslov) g.naslov = "Naslov je obavezan.";
  else if (naslov.length > MAX_NASLOV) g.naslov = `Naslov može imati najviše ${MAX_NASLOV} znakova.`;

  if (!(TIPOVI as readonly string[]).includes(forma.tip)) g.tip = "Izaberi tip.";

  if (!forma.tekst.trim()) g.tekst = "Tekst je obavezan.";
  else if (forma.tekst.length > MAX_TEKST)
    g.tekst = `Tekst može imati najviše ${MAX_TEKST.toLocaleString("sr-Latn")} znakova.`;

  if (forma.projekatId !== null && !projekti.some((p) => p.id === forma.projekatId))
    g.projekatId = "Izabrani projekat ne postoji.";

  const predugacka = forma.oznake.find((o) => o.length > MAX_OZNAKA);
  if (predugacka) g.oznake = `Oznaka može imati najviše ${MAX_OZNAKA} znakova.`;
  else if (forma.oznake.length > MAX_BROJ_OZNAKA) g.oznake = `Unos može imati najviše ${MAX_BROJ_OZNAKA} oznaka.`;

  return g;
}

export function jeIspravno(g: Greske): boolean {
  return Object.keys(g).length === 0;
}

/** Naziv projekta: obavezan, do 60 znakova, jedinstven (bez obzira na slova i kvačice). */
export function validirajNazivProjekta(
  naziv: string,
  projekti: Projekat[],
  idKojiSeMenja?: string,
): string | null {
  const cist = naziv.trim();
  if (!cist) return "Naziv projekta je obavezan.";
  if (cist.length > 60) return "Naziv može imati najviše 60 znakova.";
  const kljuc = kljucNaziva(cist);
  const postoji = projekti.some((p) => p.id !== idKojiSeMenja && kljucNaziva(p.naziv) === kljuc);
  if (postoji) return "Projekat sa tim nazivom već postoji.";
  return null;
}
