import { describe, expect, it } from "vitest";
import { izvozUCsv, izvozUJson, procitajUvoz, SCHEMA_VERZIJA } from "./izvoz";
import { napraviUnos } from "./testPodaci";
import type { SviPodaci } from "./tipovi";

const podaci: SviPodaci = {
  projekti: [{ id: "p1", naziv: "Ja Dušan", boja: "#C99A0E", arhiviran: false, kreiran: 1 }],
  unosi: [
    napraviUnos({ naslov: "Prvi; sa \"navodnicima\"", tekst: "red 1\nred 2; čćšžđ", projekatId: "p1", oznake: ["a", "b"] }),
    napraviUnos({ naslov: "Drugi", poslednjeKopiranje: 5, brojKopiranja: 3, omiljen: true }),
  ],
};

describe("JSON izvoz i čitanje", () => {
  it("izvoz ima schemaVersion i vraća iste podatke", () => {
    const json = izvozUJson(podaci, 123);
    expect(JSON.parse(json).schemaVersion).toBe(SCHEMA_VERZIJA);
    const r = procitajUvoz(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.podaci).toEqual(podaci);
  });

  it("prazna baza se izvozi i čita", () => {
    const r = procitajUvoz(izvozUJson({ projekti: [], unosi: [] }, 1));
    expect(r).toEqual({ ok: true, podaci: { projekti: [], unosi: [] }, schemaVersion: 1 });
  });

  it("prihvata fajl sa BOM-om", () => {
    expect(procitajUvoz("\uFEFF" + izvozUJson(podaci, 1)).ok).toBe(true);
  });
});

describe("oštećen ili neispravan uvoz daje jasnu poruku", () => {
  const dobar = izvozUJson(podaci, 1);
  const slucajevi: [string, string, RegExp][] = [
    ["nije JSON", "ovo nije json", /nije ispravan JSON/],
    ["prekinut fajl", dobar.slice(0, dobar.length / 2), /nije ispravan JSON/],
    ["prazan fajl", "", /nije ispravan JSON/],
    ["niz umesto objekta", "[]", /očekivani oblik/],
    ["bez schemaVersion", JSON.stringify({ projekti: [], unosi: [] }), /schemaVersion/],
    ["novija šema", JSON.stringify({ schemaVersion: 99, projekti: [], unosi: [] }), /novije verzije/],
    ["bez lista", JSON.stringify({ schemaVersion: 1 }), /projekti/],
  ];
  for (const [opis, tekst, poruka] of slucajevi) {
    it(opis, () => {
      const r = procitajUvoz(tekst);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.poruka).toMatch(poruka);
    });
  }

  function izmenjen(fn: (o: { projekti: Record<string, unknown>[]; unosi: Record<string, unknown>[] }) => void) {
    const o = JSON.parse(dobar);
    fn(o);
    return procitajUvoz(JSON.stringify(o));
  }

  it("unos bez naslova", () => {
    const r = izmenjen((o) => { o.unosi[0].naslov = ""; });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.poruka).toMatch(/Unos #1.*naslov/);
  });
  it("nepoznat tip", () => {
    const r = izmenjen((o) => { o.unosi[1].tip = "beleska"; });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.poruka).toMatch(/Unos #2.*nepoznat tip/);
  });
  it("projekat koji ne postoji", () => {
    expect(izmenjen((o) => { o.unosi[0].projekatId = "nema"; }).ok).toBe(false);
  });
  it("dupli id", () => {
    expect(izmenjen((o) => { o.unosi[1].id = o.unosi[0].id; }).ok).toBe(false);
  });
  it("predugačak tekst", () => {
    expect(izmenjen((o) => { o.unosi[0].tekst = "a".repeat(100_001); }).ok).toBe(false);
  });
  it("neispravna boja projekta", () => {
    expect(izmenjen((o) => { o.projekti[0].boja = "plava"; }).ok).toBe(false);
  });
  it("broj kao tekst", () => {
    expect(izmenjen((o) => { o.unosi[0].kreiran = "1.1.2026"; }).ok).toBe(false);
  });
});

describe("CSV izvoz", () => {
  const csv = izvozUCsv(podaci);
  it("počinje BOM-om (Excel ispravno prikazuje č, ć, š, ž, đ)", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("čćšžđ");
  });
  it("navodnici se dupliraju, separator je ;", () => {
    expect(csv).toContain('"Prvi; sa ""navodnicima"""');
    expect(csv.split("\r\n")[0]).toBe(
      '\uFEFF"id";"tip";"naslov";"projekat";"oznake";"omiljen";"kreiran";"izmenjen";"poslednje_kopiranje";"broj_kopiranja";"tekst"',
    );
  });
  it("projekat i Van projekta", () => {
    expect(csv).toContain('"Ja Dušan"');
    expect(csv).toContain('"Van projekta"');
  });
});
