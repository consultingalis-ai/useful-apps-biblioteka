// Redosled kartica: omiljeni, pa nedavno kopirani, pa ostali po datumu izmene.
import type { Unos } from "./tipovi";

export const DANA_NEDAVNO = 14;
const DAN_MS = 24 * 60 * 60 * 1000;

export function jeNedavnoKopiran(unos: Unos, sada: number): boolean {
  return (
    unos.poslednjeKopiranje !== null &&
    sada - unos.poslednjeKopiranje <= DANA_NEDAVNO * DAN_MS
  );
}

function grupa(unos: Unos, sada: number): number {
  if (unos.omiljen) return 0;
  if (jeNedavnoKopiran(unos, sada)) return 1;
  return 2;
}

export function uporedi(a: Unos, b: Unos, sada: number): number {
  const ga = grupa(a, sada);
  const gb = grupa(b, sada);
  if (ga !== gb) return ga - gb;
  if (ga === 1) {
    // Nedavno kopirani: najsvežije kopiran prvi.
    return (b.poslednjeKopiranje ?? 0) - (a.poslednjeKopiranje ?? 0);
  }
  // Omiljeni i ostali: najskorije izmenjen prvi, pa naslov abecedno.
  if (b.izmenjen !== a.izmenjen) return b.izmenjen - a.izmenjen;
  return a.naslov.localeCompare(b.naslov, "sr-Latn");
}

export function sortiraj<T extends { unos: Unos }>(lista: T[], sada: number): T[] {
  return [...lista].sort((a, b) => uporedi(a.unos, b.unos, sada));
}
