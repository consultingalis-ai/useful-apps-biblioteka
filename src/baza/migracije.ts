// Numerisane migracije šeme. Svaka je napisana tako da je bezbedno ponoviti je
// (IF NOT EXISTS, INSERT OR IGNORE), jer plugin ne garantuje transakciju kroz više poziva.
// Verzija šeme se čuva u PRAGMA user_version.
import { kljucNaziva } from "../logika/normalizacija";
import type { SqlKlijent } from "./klijent";

export interface Migracija {
  verzija: number;
  opis: string;
  naredbe: string[];
}

// Početni projekti (fiksni id-jevi, da se izvoz/uvoz između računara lepo poklapa).
const POCETNI_PROJEKTI: [string, string, string][] = [
  ["5a1f3c2e-0001-4c6e-9a10-000000000001", "opsforma", "#3347D6"],
  ["5a1f3c2e-0002-4c6e-9a10-000000000002", "AI Agency", "#E0603A"],
  ["5a1f3c2e-0003-4c6e-9a10-000000000003", "Useful Apps", "#0F8B8D"],
  ["5a1f3c2e-0004-4c6e-9a10-000000000004", "Dzimara", "#1E9E6E"],
  ["5a1f3c2e-0005-4c6e-9a10-000000000005", "Training Operations Coordinator", "#C2459A"],
  ["5a1f3c2e-0006-4c6e-9a10-000000000006", "Ja Dušan", "#C99A0E"],
  ["5a1f3c2e-0007-4c6e-9a10-000000000007", "Solo leveling", "#2F93C0"],
  ["5a1f3c2e-0008-4c6e-9a10-000000000008", "Side hustle", "#8A5CD6"],
  ["5a1f3c2e-0009-4c6e-9a10-000000000009", "Budzet", "#6E8B2A"],
];

// Fiksan datum kreiranja početnih projekata (12.11.2026), isti na svakom računaru.
const POCETAK = 1794441600000;

const sqlTekst = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const MIGRACIJE: Migracija[] = [
  {
    verzija: 1,
    opis: "Početna šema: projekti, unosi, oznake",
    naredbe: [
      `CREATE TABLE IF NOT EXISTS projekti (
        id TEXT PRIMARY KEY,
        naziv TEXT NOT NULL,
        kljuc TEXT NOT NULL UNIQUE,
        boja TEXT NOT NULL,
        arhiviran INTEGER NOT NULL DEFAULT 0,
        kreiran INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS unosi (
        id TEXT PRIMARY KEY,
        tip TEXT NOT NULL CHECK (tip IN ('prompt', 'instrukcije', 'nastavak')),
        naslov TEXT NOT NULL,
        tekst TEXT NOT NULL,
        projekat_id TEXT REFERENCES projekti(id),
        omiljen INTEGER NOT NULL DEFAULT 0,
        kreiran INTEGER NOT NULL,
        izmenjen INTEGER NOT NULL,
        poslednje_kopiranje INTEGER,
        broj_kopiranja INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS oznake (
        id TEXT PRIMARY KEY,
        naziv TEXT NOT NULL,
        kljuc TEXT NOT NULL UNIQUE
      )`,
      `CREATE TABLE IF NOT EXISTS unos_oznake (
        unos_id TEXT NOT NULL REFERENCES unosi(id) ON DELETE CASCADE,
        oznaka_id TEXT NOT NULL REFERENCES oznake(id) ON DELETE CASCADE,
        PRIMARY KEY (unos_id, oznaka_id)
      )`,
      `CREATE INDEX IF NOT EXISTS ix_unosi_projekat ON unosi(projekat_id)`,
      ...POCETNI_PROJEKTI.map(
        ([id, naziv, boja]) =>
          `INSERT OR IGNORE INTO projekti (id, naziv, kljuc, boja, arhiviran, kreiran) VALUES (` +
          `${sqlTekst(id)}, ${sqlTekst(naziv)}, ${sqlTekst(kljucNaziva(naziv))}, ${sqlTekst(boja)}, 0, ` +
          `${POCETAK})`,
      ),
    ],
  },
];

export const POSLEDNJA_VERZIJA = MIGRACIJE[MIGRACIJE.length - 1].verzija;

export async function trenutnaVerzija(klijent: SqlKlijent): Promise<number> {
  const red = await klijent.select<{ user_version: number }>("PRAGMA user_version");
  return red[0]?.user_version ?? 0;
}

/**
 * Pokreće migracije koje nedostaju. Ako baza već ima podatke (verzija > 0),
 * PRE prve migracije poziva `napraviBackup`, pa tek onda menja šemu.
 * Vraća spisak primenjenih verzija.
 */
export async function pokreniMigracije(
  klijent: SqlKlijent,
  napraviBackup: (staraVerzija: number) => Promise<void>,
): Promise<number[]> {
  const pocetna = await trenutnaVerzija(klijent);
  const preostale = MIGRACIJE.filter((m) => m.verzija > pocetna);
  if (preostale.length === 0) return [];
  if (pocetna > 0) await napraviBackup(pocetna);
  const primenjene: number[] = [];
  for (const m of preostale) {
    for (const naredba of m.naredbe) await klijent.execute(naredba);
    await klijent.execute(`PRAGMA user_version = ${m.verzija}`);
    primenjene.push(m.verzija);
  }
  return primenjene;
}

/** SQL koji pravi doslednu kopiju cele baze u zadati fajl (radi i dok je baza otvorena). */
export function sqlZaBackup(putanja: string): string {
  return `VACUUM INTO ${sqlTekst(putanja)}`;
}
