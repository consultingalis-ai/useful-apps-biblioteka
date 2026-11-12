// Veza sa Tauri-jem: baza (SQL plugin), Rust komande, clipboard i log.
// Sve što zavisi od Windows aplikacije je ovde, a logika ostaje u src/logika i src/baza.
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { error as logGreska, info as logInfo } from "@tauri-apps/plugin-log";
import type { SqlKlijent, Vrednost } from "../baza/klijent";
import { sqlZaBackup } from "../baza/migracije";
import { oznakaZaFajl } from "../logika/format";

export interface InfoPodataka {
  folder: string;
  bazaUrl: string;
  logFajl: string;
  vracenoIz: string | null;
}

export type RazlogBackupa = "rucni" | "pre-uvoza" | "pre-vracanja" | "pre-migracije";

export async function infoPodataka(): Promise<InfoPodataka> {
  return invoke<InfoPodataka>("info_podataka");
}

/** Otvara bazu preko zvaničnog SQL plugina i vraća je kao SqlKlijent. */
export async function otvoriBazu(url: string): Promise<SqlKlijent> {
  const db = await Database.load(url);
  return {
    async execute(sql: string, parametri: Vrednost[] = []) {
      const r = await db.execute(sql, parametri);
      return { rowsAffected: r.rowsAffected };
    },
    async select<T>(sql: string, parametri: Vrednost[] = []) {
      return db.select<T[]>(sql, parametri);
    },
  };
}

/** Pravi doslednu kopiju baze u folderu backup i briše najstarije preko 10. Vraća putanju. */
export async function napraviBackup(db: SqlKlijent, razlog: RazlogBackupa): Promise<string> {
  const putanja = await invoke<string>("nova_putanja_backupa", { oznaka: oznakaZaFajl(Date.now()), razlog });
  await db.execute(sqlZaBackup(putanja));
  await invoke<number>("ocisti_backupe");
  zabelezi(`Napravljen backup (${razlog}): ${putanja}`);
  return putanja;
}

/** Otvara Windows prozor „Otvori” za JSON fajl. Vraća putanju ili null ako je korisnik odustao. */
export async function izaberiJsonZaUvoz(): Promise<string | null> {
  const izbor = await open({ multiple: false, directory: false, filters: [{ name: "JSON izvoz", extensions: ["json"] }] });
  return typeof izbor === "string" ? izbor : null;
}

/** Čita tekstualni fajl preko Rust komande (sa ograničenjem veličine). */
export async function procitajFajl(putanja: string): Promise<string> {
  return invoke<string>("procitaj_fajl", { putanja });
}

/** Vraća bazu iz backup-a (ime fajla, bez foldera) i restartuje aplikaciju. */
export async function vratiBackupIRestartuj(putanjaIliIme: string): Promise<void> {
  const ime = putanjaIliIme.split(/[\\/]/).pop() ?? putanjaIliIme;
  await invoke("vrati_backup_i_restartuj", { ime });
}

export async function kopirajUClipboard(tekst: string): Promise<void> {
  await writeText(tekst);
}

/** Upisuje grešku u log fajl u folderu podataka. Nikad ne baca grešku. */
export function zabeleziGresku(poruka: string): void {
  logGreska(poruka).catch(() => console.error(poruka));
}

export function zabelezi(poruka: string): void {
  logInfo(poruka).catch(() => console.info(poruka));
}

/** Pretvara bilo koju grešku u čitljiv tekst. */
export function tekstGreske(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
