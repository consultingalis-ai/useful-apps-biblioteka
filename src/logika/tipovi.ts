// Osnovni tipovi podataka aplikacije (isti oblik kao u bazi, ali u camelCase).

export const TIPOVI = ["prompt", "instrukcije", "nastavak"] as const;
export type Tip = (typeof TIPOVI)[number];

export const NAZIVI_TIPOVA: Record<Tip, string> = {
  prompt: "Prompt",
  instrukcije: "Instrukcije",
  nastavak: "Nastavak",
};

export interface Projekat {
  id: string;
  naziv: string;
  boja: string; // #RRGGBB
  arhiviran: boolean;
  kreiran: number; // Unix milisekunde
}

export interface Unos {
  id: string; // UUID
  tip: Tip;
  naslov: string;
  tekst: string;
  projekatId: string | null; // null = „Van projekta”
  oznake: string[];
  omiljen: boolean;
  kreiran: number;
  izmenjen: number;
  poslednjeKopiranje: number | null;
  brojKopiranja: number;
}

/** Ceo sadržaj baze, onako kako ide u izvoz. */
export interface SviPodaci {
  projekti: Projekat[];
  unosi: Unos[];
}

export const MAX_NASLOV = 200;
export const MAX_TEKST = 100_000;
export const MAX_OZNAKA = 50; // dužina jedne oznake
