// Sav rad sa bazom na jednom mestu: čitanje, čuvanje, brisanje, projekti i uvoz.
import { kljucNaziva } from "../logika/normalizacija";
import type { PlanUvoza } from "../logika/uvoz";
import type { Projekat, SviPodaci, Tip, Unos } from "../logika/tipovi";
import type { SqlKlijent } from "./klijent";

interface RedProjekta {
  id: string;
  naziv: string;
  boja: string;
  arhiviran: number;
  kreiran: number;
}

interface RedUnosa {
  id: string;
  tip: Tip;
  naslov: string;
  tekst: string;
  projekat_id: string | null;
  omiljen: number;
  kreiran: number;
  izmenjen: number;
  poslednje_kopiranje: number | null;
  broj_kopiranja: number;
}

export class GreskaSkladista extends Error {}

const noviId = () => crypto.randomUUID();

export class Skladiste {
  constructor(private readonly db: SqlKlijent) {}

  /** Baza ispod skladišta (treba za backup pre uvoza). */
  get baza(): SqlKlijent {
    return this.db;
  }

  // ---------- Čitanje ----------

  async ucitajProjekte(): Promise<Projekat[]> {
    const redovi = await this.db.select<RedProjekta>(
      "SELECT id, naziv, boja, arhiviran, kreiran FROM projekti ORDER BY kljuc",
    );
    return redovi.map((r) => ({ ...r, arhiviran: r.arhiviran === 1 }));
  }

  async ucitajUnose(): Promise<Unos[]> {
    const redovi = await this.db.select<RedUnosa>(
      `SELECT id, tip, naslov, tekst, projekat_id, omiljen, kreiran, izmenjen,
              poslednje_kopiranje, broj_kopiranja FROM unosi`,
    );
    const veze = await this.db.select<{ unos_id: string; naziv: string }>(
      `SELECT uo.unos_id, o.naziv FROM unos_oznake uo JOIN oznake o ON o.id = uo.oznaka_id
       ORDER BY o.kljuc`,
    );
    const oznakePoUnosu = new Map<string, string[]>();
    for (const v of veze) {
      const lista = oznakePoUnosu.get(v.unos_id) ?? [];
      lista.push(v.naziv);
      oznakePoUnosu.set(v.unos_id, lista);
    }
    return redovi.map((r) => ({
      id: r.id,
      tip: r.tip,
      naslov: r.naslov,
      tekst: r.tekst,
      projekatId: r.projekat_id,
      oznake: oznakePoUnosu.get(r.id) ?? [],
      omiljen: r.omiljen === 1,
      kreiran: r.kreiran,
      izmenjen: r.izmenjen,
      poslednjeKopiranje: r.poslednje_kopiranje,
      brojKopiranja: r.broj_kopiranja,
    }));
  }

  async ucitajSve(): Promise<SviPodaci> {
    return { projekti: await this.ucitajProjekte(), unosi: await this.ucitajUnose() };
  }

  // ---------- Unosi ----------

  /** Dodaje novi ili menja postojeći unos (prepoznaje se po id-ju), zajedno sa oznakama. */
  async sacuvajUnos(u: Unos): Promise<void> {
    await this.db.execute(
      `INSERT INTO unosi (id, tip, naslov, tekst, projekat_id, omiljen, kreiran, izmenjen,
                          poslednje_kopiranje, broj_kopiranja)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         tip = excluded.tip, naslov = excluded.naslov, tekst = excluded.tekst,
         projekat_id = excluded.projekat_id, omiljen = excluded.omiljen,
         kreiran = excluded.kreiran, izmenjen = excluded.izmenjen,
         poslednje_kopiranje = excluded.poslednje_kopiranje,
         broj_kopiranja = excluded.broj_kopiranja`,
      [
        u.id, u.tip, u.naslov, u.tekst, u.projekatId, u.omiljen ? 1 : 0, u.kreiran, u.izmenjen,
        u.poslednjeKopiranje, u.brojKopiranja,
      ],
    );
    await this.postaviOznake(u.id, u.oznake);
  }

  private async postaviOznake(unosId: string, oznake: string[]): Promise<void> {
    await this.db.execute("DELETE FROM unos_oznake WHERE unos_id = ?", [unosId]);
    for (const naziv of oznake) {
      const kljuc = kljucNaziva(naziv);
      await this.db.execute("INSERT OR IGNORE INTO oznake (id, naziv, kljuc) VALUES (?, ?, ?)", [
        noviId(), naziv.trim(), kljuc,
      ]);
      await this.db.execute(
        `INSERT OR IGNORE INTO unos_oznake (unos_id, oznaka_id)
         SELECT ?, id FROM oznake WHERE kljuc = ?`,
        [unosId, kljuc],
      );
    }
    await this.ocistiOznake();
  }

  /** Briše oznake koje više nijedan unos ne koristi. */
  private async ocistiOznake(): Promise<void> {
    await this.db.execute("DELETE FROM oznake WHERE id NOT IN (SELECT oznaka_id FROM unos_oznake)");
  }

  async obrisiUnos(id: string): Promise<void> {
    await this.db.execute("DELETE FROM unos_oznake WHERE unos_id = ?", [id]);
    await this.db.execute("DELETE FROM unosi WHERE id = ?", [id]);
    await this.ocistiOznake();
  }

  async zabeleziKopiranje(id: string, sada: number): Promise<void> {
    await this.db.execute(
      "UPDATE unosi SET poslednje_kopiranje = ?, broj_kopiranja = broj_kopiranja + 1 WHERE id = ?",
      [sada, id],
    );
  }

  async postaviOmiljen(id: string, omiljen: boolean): Promise<void> {
    await this.db.execute("UPDATE unosi SET omiljen = ? WHERE id = ?", [omiljen ? 1 : 0, id]);
  }

  // ---------- Projekti ----------

  async dodajProjekat(p: Projekat): Promise<void> {
    await this.db.execute(
      "INSERT INTO projekti (id, naziv, kljuc, boja, arhiviran, kreiran) VALUES (?, ?, ?, ?, ?, ?)",
      [p.id, p.naziv.trim(), kljucNaziva(p.naziv), p.boja, p.arhiviran ? 1 : 0, p.kreiran],
    );
  }

  async izmeniProjekat(p: Projekat): Promise<void> {
    await this.db.execute(
      "UPDATE projekti SET naziv = ?, kljuc = ?, boja = ?, arhiviran = ? WHERE id = ?",
      [p.naziv.trim(), kljucNaziva(p.naziv), p.boja, p.arhiviran ? 1 : 0, p.id],
    );
  }

  async brojUnosaProjekta(id: string): Promise<number> {
    const r = await this.db.select<{ broj: number }>(
      "SELECT COUNT(*) AS broj FROM unosi WHERE projekat_id = ?",
      [id],
    );
    return r[0]?.broj ?? 0;
  }

  /** Brisanje je dozvoljeno samo za projekat bez unosa; inače treba arhivirati. */
  async obrisiProjekat(id: string): Promise<void> {
    if ((await this.brojUnosaProjekta(id)) > 0) {
      throw new GreskaSkladista("Projekat ima unose, pa ne može da se obriše. Možeš da ga arhiviraš.");
    }
    await this.db.execute("DELETE FROM projekti WHERE id = ?", [id]);
  }

  // ---------- Uvoz ----------

  /** Upisuje unapred proveren plan uvoza. Backup se pravi PRE poziva ove funkcije. */
  async primeniUvoz(plan: PlanUvoza): Promise<void> {
    for (const p of plan.noviProjekti) await this.dodajProjekat(p);
    for (const p of plan.izmenjeniProjekti) await this.izmeniProjekat(p);
    for (const u of [...plan.dodaje, ...plan.menja]) await this.sacuvajUnos(u);
  }
}
