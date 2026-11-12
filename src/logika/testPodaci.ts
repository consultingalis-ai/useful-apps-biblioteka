// Pomoćne funkcije za testove: izmišljeni podaci.
import type { Unos } from "./tipovi";

let brojac = 0;

export function napraviUnos(izmene: Partial<Unos> = {}): Unos {
  brojac++;
  return {
    id: `00000000-0000-4000-8000-${String(brojac).padStart(12, "0")}`,
    tip: "prompt",
    naslov: `Test unos ${brojac}`,
    tekst: `Tekst test unosa ${brojac}`,
    projekatId: null,
    oznake: [],
    omiljen: false,
    kreiran: Date.UTC(2026, 0, 1),
    izmenjen: Date.UTC(2026, 0, 1),
    poslednjeKopiranje: null,
    brojKopiranja: 0,
    ...izmene,
  };
}
