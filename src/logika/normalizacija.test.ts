import { describe, expect, it } from "vitest";
import { kljucNaziva, normalizuj } from "./normalizacija";

describe("normalizuj", () => {
  it("uklanja kvačice i velika slova", () => {
    expect(normalizuj("Čokolada")).toBe("cokolada");
    expect(normalizuj("ĆEVAP Šuma Žaba")).toBe("cevap suma zaba");
  });
  it("đ, dj i d su isto", () => {
    expect(normalizuj("Đorđe")).toBe("dorde");
    expect(normalizuj("Djordje")).toBe("dorde");
    expect(normalizuj("Dzimara")).toBe(normalizuj("Džimara"));
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
