import { describe, expect, it } from "vitest";
import { formatBroj, formatDatum, formatDatumVreme, oznakaZaFajl } from "./format";

describe("formatDatum (dd.mm.gggg)", () => {
  it("31. u mesecu", () => {
    expect(formatDatum(new Date(2026, 0, 31, 12).getTime())).toBe("31.01.2026");
  });
  it("februar i prestupna godina", () => {
    expect(formatDatum(new Date(2026, 1, 28, 12).getTime())).toBe("28.02.2026");
    expect(formatDatum(new Date(2028, 1, 29, 12).getTime())).toBe("29.02.2028");
    // 29. februar 2026. ne postoji, pa JS prelazi na 1. mart
    expect(formatDatum(new Date(2026, 1, 29, 12).getTime())).toBe("01.03.2026");
  });
  it("prelaz godine u lokalnoj zoni (Beograd)", () => {
    // 31.12.2026. u 23:30 UTC je već 01.01.2027. u Beogradu
    expect(formatDatum(Date.UTC(2026, 11, 31, 23, 30))).toBe("01.01.2027");
    expect(formatDatum(Date.UTC(2026, 11, 31, 22, 59))).toBe("31.12.2026");
  });
  it("datum i vreme", () => {
    expect(formatDatumVreme(new Date(2026, 4, 5, 9, 7).getTime())).toBe("05.05.2026. 09:07");
  });
  it("oznaka za naziv fajla", () => {
    expect(oznakaZaFajl(new Date(2026, 1, 5, 14, 7, 9).getTime())).toBe("2026-02-05_14-07-09");
  });
});

describe("formatBroj (1.234,56)", () => {
  it("hiljade i decimale", () => {
    expect(formatBroj(1234.56, 2)).toBe("1.234,56");
    expect(formatBroj(1000000)).toBe("1.000.000");
    expect(formatBroj(0)).toBe("0");
    expect(formatBroj(-9876.5, 1)).toBe("-9.876,5");
  });
});
