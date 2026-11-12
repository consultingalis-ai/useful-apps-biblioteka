import { describe, expect, it } from "vitest";
import { izvozUJson, procitajUvoz } from "../logika/izvoz";
import { napraviUnos } from "../logika/testPodaci";
import { planirajUvoz } from "../logika/uvoz";
import type { SviPodaci } from "../logika/tipovi";
import { MIGRACIJE, pokreniMigracije, POSLEDNJA_VERZIJA, sqlZaBackup, trenutnaVerzija } from "./migracije";
import { napraviNodeKlijent } from "./nodeKlijent";
import { GreskaSkladista, Skladiste } from "./skladiste";

async function novaBaza() {
  const db = napraviNodeKlijent();
  await pokreniMigracije(db, async () => {});
  return { db, s: new Skladiste(db) };
}

const sortirano = (p: SviPodaci): SviPodaci => ({
  projekti: [...p.projekti].sort((a, b) => a.id.localeCompare(b.id)),
  unosi: [...p.unosi]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => ({ ...u, oznake: [...u.oznake].sort() })),
});

describe("migracije", () => {
  it("prazna baza dobija šemu i 9 početnih projekata", async () => {
    const { db, s } = await novaBaza();
    expect(await trenutnaVerzija(db)).toBe(POSLEDNJA_VERZIJA);
    const projekti = await s.ucitajProjekte();
    expect(projekti).toHaveLength(9);
    expect(projekti.map((p) => p.naziv)).toContain("Ja Dušan");
    expect(projekti.map((p) => p.naziv)).not.toContain("Van projekta");
    expect(await s.ucitajUnose()).toEqual([]);
  });

  it("ponovno pokretanje ne radi ništa i ne pravi backup", async () => {
    const { db } = await novaBaza();
    let backupa = 0;
    expect(await pokreniMigracije(db, async () => { backupa++; })).toEqual([]);
    expect(backupa).toBe(0);
  });

  it("naredbe migracije su bezbedne za ponavljanje (prekinuta migracija)", async () => {
    const db = napraviNodeKlijent();
    for (const n of MIGRACIJE[0].naredbe) await db.execute(n);
    await expect(pokreniMigracije(db, async () => {})).resolves.toEqual([1]);
    expect(await new Skladiste(db).ucitajProjekte()).toHaveLength(9);
  });

  it("postojeća baza sa podacima: backup PRE nove migracije", async () => {
    const { db, s } = await novaBaza();
    await s.sacuvajUnos(napraviUnos());
    // Dodajemo privremenu migraciju v2, pa baza (v1, sa podacima) treba da se migrira.
    MIGRACIJE.push({ verzija: 2, opis: "test", naredbe: ["CREATE TABLE IF NOT EXISTS test_tabela (x INTEGER)"] });
    try {
      const redosled: string[] = [];
      const primenjene = await pokreniMigracije(db, async (stara) => { redosled.push(`backup od v${stara}`); });
      expect(redosled).toEqual(["backup od v1"]);
      expect(primenjene).toEqual([2]);
      expect(await s.ucitajUnose()).toHaveLength(1); // podaci nisu obrisani
    } finally {
      MIGRACIJE.pop();
    }
  });

  it("SQL za backup ispravno escape-uje putanju", () => {
    expect(sqlZaBackup("C:\\Users\\D'Ana\\b.db")).toBe("VACUUM INTO 'C:\\Users\\D''Ana\\b.db'");
  });
});

describe("unosi", () => {
  it("sačuvan unos se vraća isti, sa oznakama", async () => {
    const { s } = await novaBaza();
    const [p] = await s.ucitajProjekte();
    const u = napraviUnos({ projekatId: p.id, oznake: ["Claude", "rad"], tekst: "čćšžđ ".repeat(10) });
    await s.sacuvajUnos(u);
    expect(await s.ucitajUnose()).toEqual([{ ...u, oznake: ["Claude", "rad"] }]);
  });

  it("izmena menja tekst i oznake, nekorišćene oznake nestaju", async () => {
    const { db, s } = await novaBaza();
    const u = napraviUnos({ oznake: ["a", "b"] });
    await s.sacuvajUnos(u);
    await s.sacuvajUnos({ ...u, naslov: "Novo", oznake: ["b"] });
    const [ucitan] = await s.ucitajUnose();
    expect(ucitan.naslov).toBe("Novo");
    expect(ucitan.oznake).toEqual(["b"]);
    expect(await db.select("SELECT naziv FROM oznake")).toEqual([{ naziv: "b" }]);
  });

  it("ista oznaka sa drugačijim slovima je jedna oznaka", async () => {
    const { db, s } = await novaBaza();
    await s.sacuvajUnos(napraviUnos({ oznake: ["Claude"] }));
    await s.sacuvajUnos(napraviUnos({ oznake: ["claude"] }));
    expect(await db.select("SELECT COUNT(*) AS n FROM oznake")).toEqual([{ n: 1 }]);
  });

  it("brisanje i kopiranje", async () => {
    const { s } = await novaBaza();
    const a = napraviUnos();
    const b = napraviUnos();
    await s.sacuvajUnos(a);
    await s.sacuvajUnos(b);
    await s.zabeleziKopiranje(a.id, 1000);
    await s.zabeleziKopiranje(a.id, 2000);
    await s.obrisiUnos(b.id);
    const lista = await s.ucitajUnose();
    expect(lista).toHaveLength(1);
    expect(lista[0].brojKopiranja).toBe(2);
    expect(lista[0].poslednjeKopiranje).toBe(2000);
  });
});

describe("projekti", () => {
  it("brisanje samo bez unosa", async () => {
    const { s } = await novaBaza();
    const [p1, p2] = await s.ucitajProjekte();
    await s.sacuvajUnos(napraviUnos({ projekatId: p1.id }));
    await expect(s.obrisiProjekat(p1.id)).rejects.toBeInstanceOf(GreskaSkladista);
    await s.obrisiProjekat(p2.id);
    expect(await s.ucitajProjekte()).toHaveLength(8);
  });

  it("arhiviranje i preimenovanje", async () => {
    const { s } = await novaBaza();
    const [p] = await s.ucitajProjekte();
    await s.izmeniProjekat({ ...p, naziv: "Novi naziv", arhiviran: true });
    const izmenjen = (await s.ucitajProjekte()).find((x) => x.id === p.id);
    expect(izmenjen).toMatchObject({ naziv: "Novi naziv", arhiviran: true });
  });
});

describe("izvoz → uvoz", () => {
  it("izvoz pa uvoz u praznu bazu daje identične podatke (1.000 unosa, tekst 50.000 znakova)", async () => {
    const izvor = await novaBaza();
    const projekti = await izvor.s.ucitajProjekte();
    const sopstveni = { id: "aaaaaaaa-0000-4000-8000-000000000001", naziv: "Moj projekat", boja: "#123456", arhiviran: true, kreiran: 42 };
    await izvor.s.dodajProjekat(sopstveni);
    for (let i = 0; i < 1_000; i++) {
      await izvor.s.sacuvajUnos(
        napraviUnos({
          tip: (["prompt", "instrukcije", "nastavak"] as const)[i % 3],
          projekatId: i % 4 === 0 ? null : i % 4 === 1 ? sopstveni.id : projekti[i % 9].id,
          oznake: i % 2 ? ["parni", `oznaka ${i % 7}`] : [],
          tekst: i === 500 ? "ž".repeat(50_000) : `Tekst ${i} čćšžđ`,
          omiljen: i % 10 === 0,
          poslednjeKopiranje: i % 5 === 0 ? 1_700_000_000_000 + i : null,
          brojKopiranja: i % 5,
        }),
      );
    }
    const izvezeno = await izvor.s.ucitajSve();
    const json = izvozUJson(izvezeno, Date.now());

    const cilj = await novaBaza();
    const procitano = procitajUvoz(json);
    expect(procitano.ok).toBe(true);
    if (!procitano.ok) return;
    const plan = planirajUvoz(await cilj.s.ucitajSve(), procitano.podaci);
    expect(plan.dodaje).toHaveLength(1_000);
    expect(plan.menja).toHaveLength(0);
    expect(plan.noviProjekti).toHaveLength(1);
    await cilj.s.primeniUvoz(plan);

    expect(sortirano(await cilj.s.ucitajSve())).toEqual(sortirano(izvezeno));
  });

  it("ponovni uvoz istog fajla ne menja ništa", async () => {
    const { s } = await novaBaza();
    await s.sacuvajUnos(napraviUnos({ oznake: ["x"] }));
    const podaci = await s.ucitajSve();
    const plan = planirajUvoz(podaci, podaci);
    expect(plan).toMatchObject({ dodaje: [], menja: [], noviProjekti: [], izmenjeniProjekti: [], nepromenjeno: 1 });
  });

  it("plan prepoznaje izmenu i projekat po nazivu", async () => {
    const { s } = await novaBaza();
    const projekti = await s.ucitajProjekte();
    const u = napraviUnos();
    await s.sacuvajUnos(u);
    const uvoz: SviPodaci = {
      projekti: [{ ...projekti[0], id: "drugi-id", naziv: projekti[0].naziv.toUpperCase() }],
      unosi: [{ ...u, naslov: "Izmenjen", projekatId: "drugi-id" }, napraviUnos()],
    };
    const plan = planirajUvoz(await s.ucitajSve(), uvoz);
    expect(plan.noviProjekti).toHaveLength(0);
    expect(plan.menja).toHaveLength(1);
    expect(plan.menja[0].projekatId).toBe(projekti[0].id);
    expect(plan.dodaje).toHaveLength(1);
  });

  it("oštećen uvozni fajl ne menja ništa u bazi", async () => {
    const { s } = await novaBaza();
    await s.sacuvajUnos(napraviUnos());
    const pre = await s.ucitajSve();
    const r = procitajUvoz('{"schemaVersion":1,"projekti":[],"unosi":[{"id":"x"');
    expect(r.ok).toBe(false);
    // Aplikacija primenjuje uvoz samo kad je r.ok === true, pa baza ostaje ista.
    expect(await s.ucitajSve()).toEqual(pre);
  });

  it("prazna baza: izvoz sadrži samo početne projekte i nijedan unos", async () => {
    const { s } = await novaBaza();
    const r = procitajUvoz(izvozUJson(await s.ucitajSve(), 1));
    expect(r.ok && r.podaci.unosi.length === 0 && r.podaci.projekti.length === 9).toBe(true);
  });
});
