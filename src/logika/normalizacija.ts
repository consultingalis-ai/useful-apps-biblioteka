// Pretvara tekst u oblik za pretragu: mala slova, bez kvačica.
// Tako „Čokolada”, „cokolada” i „ČOKOLADA” postaju isto: „cokolada”.

const ZAMENE: Record<string, string> = {
  č: "c",
  ć: "c",
  š: "s",
  ž: "z",
  đ: "d",
};

export function normalizuj(tekst: string): string {
  const mala = tekst.toLowerCase();
  let rezultat = "";
  for (const znak of mala) {
    rezultat += ZAMENE[znak] ?? znak;
  }
  // Ostale kvačice (npr. é, ü) uklanjamo standardnim Unicode rastavljanjem.
  // „dj” pretvaramo u „d”, da bi „Đorđe”, „Djordje” i „Dordje” bili isto.
  return rezultat.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/dj/g, "d");
}

/** Ključ za poređenje naziva (projekti, oznake): bez razlike u slovima i razmacima. */
export function kljucNaziva(naziv: string): string {
  return normalizuj(naziv).trim().replace(/\s+/g, " ");
}
