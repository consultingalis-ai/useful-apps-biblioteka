import { describe, expect, it } from "vitest";
import { naslovKopije, parsirajOznake, prvaTriReda, SABLON_NASTAVAK } from "./sabloni";

describe("šabloni i pomoćne funkcije", () => {
  it("šablon nastavka ima sva 4 naslova", () => {
    for (const n of ["## Gde smo stali", "## Sledeći korak", "## Otvorena pitanja", "## Važni linkovi i fajlovi"]) {
      expect(SABLON_NASTAVAK).toContain(n);
    }
  });
  it("naslov kopije ne prelazi 200 znakova", () => {
    expect(naslovKopije("Prompt")).toBe("Prompt (kopija)");
    const dug = naslovKopije("a".repeat(200));
    expect(dug).toHaveLength(200);
    expect(dug.endsWith(" (kopija)")).toBe(true);
  });
  it("prva 3 reda", () => {
    expect(prvaTriReda("a\nb\r\nc\nd")).toBe("a\nb\nc");
  });
  it("oznake bez duplikata i praznih", () => {
    expect(parsirajOznake(" ai, Rad ,, AI,  dugi   naziv ")).toEqual(["ai", "Rad", "dugi naziv"]);
    // „šablon” i „sablon” su ista oznaka
    expect(parsirajOznake("šablon, Sablon")).toEqual(["šablon"]);
  });
});
