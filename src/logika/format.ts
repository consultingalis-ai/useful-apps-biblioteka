// Prikaz datuma (dd.mm.gggg) i brojeva (1.234,56) po srpskom formatu.

function dve(n: number): string {
  return String(n).padStart(2, "0");
}

/** Datum u lokalnoj vremenskoj zoni, npr. 05.02.2026. */
export function formatDatum(ms: number): string {
  const d = new Date(ms);
  return `${dve(d.getDate())}.${dve(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Datum i vreme, npr. 05.02.2026. 14:07 */
export function formatDatumVreme(ms: number): string {
  const d = new Date(ms);
  return `${formatDatum(ms)}. ${dve(d.getHours())}:${dve(d.getMinutes())}`;
}

/** Oznaka za naziv backup fajla, npr. 2026-02-05_14-07-09 (lokalno vreme). */
export function oznakaZaFajl(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${dve(d.getMonth() + 1)}-${dve(d.getDate())}_` +
    `${dve(d.getHours())}-${dve(d.getMinutes())}-${dve(d.getSeconds())}`
  );
}

/** Broj sa tačkom za hiljade i zarezom za decimale: 1234.5 → "1.234,50" (decimale = 2). */
export function formatBroj(broj: number, decimale = 0): string {
  const znak = broj < 0 ? "-" : "";
  const [ceo, dec] = Math.abs(broj).toFixed(decimale).split(".");
  const saTackama = ceo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return znak + saTackama + (dec ? "," + dec : "");
}
