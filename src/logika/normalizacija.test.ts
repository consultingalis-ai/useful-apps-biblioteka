import { describe, expect, it } from "vitest";
import { kljucNaziva, normalizuj } from "./normalizacija";

describe("normalizuj", () => {
  it("uklanja kvačice i velika slova", () => {
    expect(normalizuj("Čokolada")).toBe("cokolada");
    expect(normalizuj("ĆEVAP Šuma Žaba")).toBe("cevap suma zaba");
  });
  it("đ pretvara u dj", () => {
    expect(normalizuj("Đorđe")).toBe("djordje");
  });
  it("uklanja i strane kvačice", () => {
    expect(normalizuj("Café Über")).toBe("cafe uber");
  });
});

describe("kljucNaziva", () => {
  it("izjednačava razmake i slova", () => {
    expect(kljucNaziva("  Ja   Dušan ")).toBe("ja dusan");
  });
});
