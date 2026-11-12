import { describe, expect, it } from "vitest";
import { jeIspravno, validirajNazivProjekta, validirajUnos, type FormaUnosa } from "./validacija";
import type { Projekat } from "./tipovi";

const projekti: Projekat[] = [
  { id: "p1", naziv: "Ja Dušan", boja: "#3347D6", arhiviran: false, kreiran: 0 },
];
const ispravna: FormaUnosa = { naslov: "Naslov", tip: "prompt", projekatId: null, oznake: [], tekst: "tekst" };

describe("validirajUnos", () => {
  it("ispravna forma", () => {
    expect(jeIspravno(validirajUnos(ispravna, projekti))).toBe(true);
  });
  it("obavezna polja", () => {
    const g = validirajUnos({ ...ispravna, naslov: "  ", tekst: "" }, projekti);
    expect(g.naslov).toBeDefined();
    expect(g.tekst).toBeDefined();
  });
  it("granice dužine", () => {
    expect(validirajUnos({ ...ispravna, naslov: "a".repeat(200) }, projekti).naslov).toBeUndefined();
    expect(validirajUnos({ ...ispravna, naslov: "a".repeat(201) }, projekti).naslov).toBeDefined();
    expect(validirajUnos({ ...ispravna, tekst: "a".repeat(100_000) }, projekti).tekst).toBeUndefined();
    expect(validirajUnos({ ...ispravna, tekst: "a".repeat(100_001) }, projekti).tekst).toBeDefined();
  });
  it("tekst od 50.000 znakova je ispravan", () => {
    expect(jeIspravno(validirajUnos({ ...ispravna, tekst: "č".repeat(50_000) }, projekti))).toBe(true);
  });
  it("oznake: najviše 20, svaka do 40 znakova", () => {
    const oznake = (n: number) => Array.from({ length: n }, (_, i) => `o${i}`);
    expect(validirajUnos({ ...ispravna, oznake: oznake(20) }, projekti).oznake).toBeUndefined();
    expect(validirajUnos({ ...ispravna, oznake: oznake(21) }, projekti).oznake).toBeDefined();
    expect(validirajUnos({ ...ispravna, oznake: ["a".repeat(40)] }, projekti).oznake).toBeUndefined();
    expect(validirajUnos({ ...ispravna, oznake: ["a".repeat(41)] }, projekti).oznake).toBeDefined();
  });
  it("nepoznat tip i projekat", () => {
    expect(validirajUnos({ ...ispravna, tip: "x" }, projekti).tip).toBeDefined();
    expect(validirajUnos({ ...ispravna, projekatId: "nema" }, projekti).projekatId).toBeDefined();
    expect(validirajUnos({ ...ispravna, projekatId: "p1" }, projekti).projekatId).toBeUndefined();
  });
});

describe("validirajNazivProjekta", () => {
  it("jedinstven bez obzira na slova i kvačice", () => {
    expect(validirajNazivProjekta("ja dusan", projekti)).not.toBeNull();
    expect(validirajNazivProjekta("JA DUŠAN", projekti, "p1")).toBeNull();
    expect(validirajNazivProjekta("Novi", projekti)).toBeNull();
    expect(validirajNazivProjekta("", projekti)).not.toBeNull();
  });
});
