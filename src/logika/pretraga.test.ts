import { describe, expect, it } from "vitest";
import { filtriraj, odgovaraUpitu, pripremiZaPretragu } from "./pretraga";
import { napraviUnos } from "./testPodaci";

describe("pretraga", () => {
  const lista = [
    napraviUnos({ naslov: "Čokolada torta", tip: "prompt", oznake: ["Recepti"] }),
    napraviUnos({ naslov: "Instrukcije za opsformu", tip: "instrukcije", projekatId: "p1" }),
    napraviUnos({ naslov: "Nastavak rada", tip: "nastavak", tekst: "Gde smo stali: ćevapi" }),
  ].map(pripremiZaPretragu);

  it("„cokolada” nalazi „Čokolada”", () => {
    const r = filtriraj(lista, { upit: "cokolada", tip: "svi", projekatId: "svi" });
    expect(r.map((x) => x.unos.naslov)).toEqual(["Čokolada torta"]);
  });

  it("traži i po oznakama i po tekstu", () => {
    expect(filtriraj(lista, { upit: "recepti", tip: "svi", projekatId: "svi" })).toHaveLength(1);
    expect(filtriraj(lista, { upit: "CEVAPI", tip: "svi", projekatId: "svi" })).toHaveLength(1);
  });

  it("sve reči moraju da postoje", () => {
    expect(odgovaraUpitu("cokolada torta", "torta cokolada")).toBe(true);
    expect(odgovaraUpitu("cokolada torta", "torta vanila")).toBe(false);
  });

  it("prazan upit vraća sve", () => {
    expect(filtriraj(lista, { upit: "   ", tip: "svi", projekatId: "svi" })).toHaveLength(3);
  });

  it("filtrira po tipu i projektu (null = Van projekta)", () => {
    expect(filtriraj(lista, { upit: "", tip: "instrukcije", projekatId: "svi" })).toHaveLength(1);
    expect(filtriraj(lista, { upit: "", tip: "svi", projekatId: "p1" })).toHaveLength(1);
    expect(filtriraj(lista, { upit: "", tip: "svi", projekatId: null })).toHaveLength(2);
  });

  it("1.000 unosa sa dugim tekstom: pretraga je brza", () => {
    const dugTekst = "lorem ipsum ".repeat(4_000); // ~48.000 znakova
    const velika = Array.from({ length: 1_000 }, (_, i) =>
      pripremiZaPretragu(napraviUnos({ naslov: `Unos ${i}`, tekst: dugTekst + (i === 777 ? " Čarobna reč" : "") })),
    );
    const pocetak = performance.now();
    const r = filtriraj(velika, { upit: "carobna", tip: "svi", projekatId: "svi" });
    const trajanje = performance.now() - pocetak;
    expect(r.map((x) => x.unos.naslov)).toEqual(["Unos 777"]);
    expect(trajanje).toBeLessThan(150);
  });
});
