// Pretraga i filtriranje liste unosa. Radi u memoriji, dovoljno brzo i za hiljade unosa.
import { normalizuj } from "./normalizacija";
import type { Tip, Unos } from "./tipovi";

/** Unos sa unapred pripremljenim tekstom za pretragu (računa se jednom, pri učitavanju). */
export interface UnosZaPretragu {
  unos: Unos;
  zaPretragu: string;
}

export function pripremiZaPretragu(unos: Unos): UnosZaPretragu {
  const zaPretragu = normalizuj(
    [unos.naslov, unos.oznake.join(" "), unos.tekst].join("\n"),
  );
  return { unos, zaPretragu };
}

export interface Filter {
  upit: string;
  tip: Tip | "svi";
  /** "svi" = svi projekti, null = samo „Van projekta”, inače id projekta */
  projekatId: string | null | "svi";
}

/** Svaka reč iz upita mora da postoji negde u naslovu, oznakama ili tekstu. */
export function odgovaraUpitu(zaPretragu: string, upit: string): boolean {
  const reci = normalizuj(upit).split(/\s+/).filter(Boolean);
  return reci.every((rec) => zaPretragu.includes(rec));
}

export function filtriraj(lista: UnosZaPretragu[], filter: Filter): UnosZaPretragu[] {
  return lista.filter(({ unos, zaPretragu }) => {
    if (filter.tip !== "svi" && unos.tip !== filter.tip) return false;
    if (filter.projekatId !== "svi" && unos.projekatId !== filter.projekatId) return false;
    return odgovaraUpitu(zaPretragu, filter.upit);
  });
}
