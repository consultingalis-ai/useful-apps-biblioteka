// Izvoz u JSON i CSV, i bezbedno čitanje uvoznog JSON fajla.
// Čitanje proverava SVAKO polje pre nego što se bilo šta upiše u bazu.
import { formatDatumVreme } from "./format";
import {
  MAX_BROJ_OZNAKA,
  MAX_NASLOV,
  MAX_OZNAKA,
  MAX_TEKST,
  NAZIVI_TIPOVA,
  TIPOVI,
  type Projekat,
  type SviPodaci,
  type Tip,
  type Unos,
} from "./tipovi";

export const SCHEMA_VERZIJA = 1;
export const IME_APLIKACIJE = "biblioteka-promptova";

export interface IzvozniFajl extends SviPodaci {
  schemaVersion: number;
  aplikacija: string;
  izvezeno: number;
}

// ---------- JSON ----------

export function napraviIzvoz(podaci: SviPodaci, sada: number): IzvozniFajl {
  return {
    schemaVersion: SCHEMA_VERZIJA,
    aplikacija: IME_APLIKACIJE,
    izvezeno: sada,
    projekti: podaci.projekti,
    unosi: podaci.unosi,
  };
}

export function izvozUJson(podaci: SviPodaci, sada: number): string {
  return JSON.stringify(napraviIzvoz(podaci, sada), null, 2);
}

// ---------- CSV ----------

const BOM = "\uFEFF";

/** Polje u navodnicima; navodnik unutar teksta se duplira (CSV pravilo). */
function csvPolje(vrednost: string): string {
  return `"${vrednost.replace(/"/g, '""')}"`;
}

/**
 * CSV za Excel: UTF-8 sa BOM-om i tačka-zarez kao separator
 * (Excel sa srpskim podešavanjima očekuje „;”, jer je zarez decimalni znak).
 */
export function izvozUCsv(podaci: SviPodaci): string {
  const nazivProjekta = new Map(podaci.projekti.map((p) => [p.id, p.naziv]));
  const zaglavlje = [
    "id", "tip", "naslov", "projekat", "oznake", "omiljen",
    "kreiran", "izmenjen", "poslednje_kopiranje", "broj_kopiranja", "tekst",
  ];
  const redovi = podaci.unosi.map((u) =>
    [
      u.id,
      NAZIVI_TIPOVA[u.tip],
      u.naslov,
      u.projekatId ? (nazivProjekta.get(u.projekatId) ?? "") : "Van projekta",
      u.oznake.join(", "),
      u.omiljen ? "da" : "ne",
      formatDatumVreme(u.kreiran),
      formatDatumVreme(u.izmenjen),
      u.poslednjeKopiranje === null ? "" : formatDatumVreme(u.poslednjeKopiranje),
      String(u.brojKopiranja),
      u.tekst,
    ]
      .map(csvPolje)
      .join(";"),
  );
  return BOM + [zaglavlje.map(csvPolje).join(";"), ...redovi].join("\r\n") + "\r\n";
}

// ---------- Čitanje uvoza ----------

export type RezultatCitanja =
  | { ok: true; podaci: SviPodaci; schemaVersion: number }
  | { ok: false; poruka: string };

class GreskaUvoza extends Error {}

function je(uslov: boolean, poruka: string): asserts uslov {
  if (!uslov) throw new GreskaUvoza(poruka);
}

const jeObjekat = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const jeVreme = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

function procitajProjekat(v: unknown, i: number): Projekat {
  const gde = `Projekat #${i + 1}`;
  je(jeObjekat(v), `${gde} nije ispravan zapis.`);
  je(typeof v.id === "string" && v.id.length > 0 && v.id.length <= 100, `${gde}: nedostaje id.`);
  je(
    typeof v.naziv === "string" && v.naziv.trim().length > 0 && v.naziv.length <= 60,
    `${gde}: naziv mora imati 1–60 znakova.`,
  );
  je(typeof v.boja === "string" && /^#[0-9a-fA-F]{6}$/.test(v.boja), `${gde}: neispravna boja.`);
  je(typeof v.arhiviran === "boolean", `${gde}: polje „arhiviran” mora biti da/ne.`);
  je(jeVreme(v.kreiran), `${gde}: neispravan datum kreiranja.`);
  return { id: v.id, naziv: v.naziv.trim(), boja: v.boja, arhiviran: v.arhiviran, kreiran: v.kreiran };
}

function procitajUnos(v: unknown, i: number, idProjekata: Set<string>): Unos {
  let gde = `Unos #${i + 1}`;
  je(jeObjekat(v), `${gde} nije ispravan zapis.`);
  if (typeof v.naslov === "string" && v.naslov.trim()) gde += ` („${v.naslov.slice(0, 40)}”)`;
  je(typeof v.id === "string" && v.id.length > 0 && v.id.length <= 100, `${gde}: nedostaje id.`);
  je(typeof v.tip === "string" && (TIPOVI as readonly string[]).includes(v.tip), `${gde}: nepoznat tip.`);
  je(
    typeof v.naslov === "string" && v.naslov.trim().length > 0 && v.naslov.trim().length <= MAX_NASLOV,
    `${gde}: naslov mora imati 1–${MAX_NASLOV} znakova.`,
  );
  je(
    typeof v.tekst === "string" && v.tekst.trim().length > 0 && v.tekst.length <= MAX_TEKST,
    `${gde}: tekst je prazan ili predugačak.`,
  );
  je(
    v.projekatId === null || (typeof v.projekatId === "string" && idProjekata.has(v.projekatId)),
    `${gde}: pominje projekat koji ne postoji u fajlu.`,
  );
  je(
    Array.isArray(v.oznake) &&
      v.oznake.length <= MAX_BROJ_OZNAKA &&
      v.oznake.every((o) => typeof o === "string" && o.trim().length > 0 && o.length <= MAX_OZNAKA && !o.includes(",")),
    `${gde}: neispravne oznake.`,
  );
  je(typeof v.omiljen === "boolean", `${gde}: polje „omiljen” mora biti da/ne.`);
  je(jeVreme(v.kreiran) && jeVreme(v.izmenjen), `${gde}: neispravan datum.`);
  je(v.poslednjeKopiranje === null || jeVreme(v.poslednjeKopiranje), `${gde}: neispravan datum kopiranja.`);
  je(jeVreme(v.brojKopiranja), `${gde}: neispravan broj kopiranja.`);
  return {
    id: v.id,
    tip: v.tip as Tip,
    naslov: v.naslov.trim(),
    tekst: v.tekst,
    projekatId: v.projekatId as string | null,
    oznake: (v.oznake as string[]).map((o) => o.trim()),
    omiljen: v.omiljen,
    kreiran: v.kreiran,
    izmenjen: v.izmenjen,
    poslednjeKopiranje: v.poslednjeKopiranje as number | null,
    brojKopiranja: v.brojKopiranja,
  };
}

/** Čita i proverava uvozni fajl. Ništa ne upisuje; samo kaže da li je fajl ispravan. */
export function procitajUvoz(tekst: string): RezultatCitanja {
  try {
    let sirovo: unknown;
    try {
      sirovo = JSON.parse(tekst.replace(/^\uFEFF/, ""));
    } catch {
      throw new GreskaUvoza("Fajl nije ispravan JSON (možda je oštećen ili nije do kraja sačuvan).");
    }
    je(jeObjekat(sirovo), "Fajl nema očekivani oblik izvoza ove aplikacije.");
    je(typeof sirovo.schemaVersion === "number", "U fajlu nedostaje „schemaVersion”. Ovo nije izvoz ove aplikacije.");
    je(
      sirovo.schemaVersion <= SCHEMA_VERZIJA && sirovo.schemaVersion >= 1,
      `Fajl je iz novije verzije aplikacije (šema ${sirovo.schemaVersion}). Prvo ažuriraj aplikaciju.`,
    );
    je(Array.isArray(sirovo.projekti) && Array.isArray(sirovo.unosi), "U fajlu nedostaju liste „projekti” i „unosi”.");

    const projekti = (sirovo.projekti as unknown[]).map(procitajProjekat);
    const idProjekata = new Set(projekti.map((p) => p.id));
    je(idProjekata.size === projekti.length, "Dva projekta u fajlu imaju isti id.");

    const unosi = (sirovo.unosi as unknown[]).map((u, i) => procitajUnos(u, i, idProjekata));
    je(new Set(unosi.map((u) => u.id)).size === unosi.length, "Dva unosa u fajlu imaju isti id.");

    return { ok: true, podaci: { projekti, unosi }, schemaVersion: sirovo.schemaVersion };
  } catch (e) {
    if (e instanceof GreskaUvoza) return { ok: false, poruka: e.message };
    return { ok: false, poruka: `Neočekivana greška pri čitanju fajla: ${String(e)}` };
  }
}
