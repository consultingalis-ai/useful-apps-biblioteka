import { describe, expect, it } from "vitest";
import { jeNedavnoKopiran, sortiraj } from "./redosled";
import { napraviUnos } from "./testPodaci";

const DAN = 24 * 60 * 60 * 1000;

describe("redosled kartica", () => {
  const sada = new Date(2026, 10, 12, 18, 0).getTime();

  it("omiljeni, pa nedavno kopirani, pa ostali po izmeni", () => {
    const stari = napraviUnos({ naslov: "stari", izmenjen: sada - 100 * DAN });
    const nov = napraviUnos({ naslov: "nov", izmenjen: sada - DAN });
    const kopiran = napraviUnos({ naslov: "kopiran", izmenjen: sada - 200 * DAN, poslednjeKopiranje: sada - 2 * DAN });
    const kopiranJuce = napraviUnos({ naslov: "kopiranJuce", izmenjen: sada - 300 * DAN, poslednjeKopiranje: sada - DAN });
    const omiljen = napraviUnos({ naslov: "omiljen", omiljen: true, izmenjen: sada - 500 * DAN });
    const r = sortiraj([stari, nov, kopiran, kopiranJuce, omiljen].map((unos) => ({ unos })), sada);
    expect(r.map((x) => x.unos.naslov)).toEqual(["omiljen", "kopiranJuce", "kopiran", "nov", "stari"]);
  });

  it("granica od 14 dana", () => {
    expect(jeNedavnoKopiran(napraviUnos({ poslednjeKopiranje: sada - 14 * DAN }), sada)).toBe(true);
    expect(jeNedavnoKopiran(napraviUnos({ poslednjeKopiranje: sada - 14 * DAN - 1 }), sada)).toBe(false);
    expect(jeNedavnoKopiran(napraviUnos({ poslednjeKopiranje: null }), sada)).toBe(false);
  });

  it("radi preko prelaza godine", () => {
    const noveGodine = new Date(2027, 0, 2, 9, 0).getTime();
    const kopiran = napraviUnos({ poslednjeKopiranje: new Date(2026, 11, 22, 20, 0).getTime() });
    expect(jeNedavnoKopiran(kopiran, noveGodine)).toBe(true);
  });
});
