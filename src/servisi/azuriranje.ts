// Automatsko ažuriranje: pri pokretanju proveri GitHub Release.
// Ako postoji novija verzija, preuzme je, instalira i restartuje aplikaciju,
// pre nego što korisnik počne da kuca (pa se ništa ne gubi).
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { tekstGreske, zabelezi, zabeleziGresku } from "./tauri";

export type StanjeAzuriranja =
  | { faza: "nema" }
  | { faza: "preuzimanje"; verzija: string; procenat: number | null }
  | { faza: "greska"; poruka: string };

/** Obećanje koje se završi posle `ms` milisekundi sa vrednošću `null` (da spora mreža ne blokira start). */
function istek(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

/**
 * Proverava i instalira novu verziju. `javi` dobija stanje za prikaz na ekranu.
 * Vraća tek kad je jasno da nema ažuriranja (ili da nije uspelo), pa aplikacija nastavlja normalno.
 * Ako ažuriranje uspe, aplikacija se restartuje i ova funkcija se praktično ne vraća.
 */
export async function proveriIAzuriraj(javi: (s: StanjeAzuriranja) => void): Promise<void> {
  // U razvoju (npm run tauri dev) ne ažuriramo.
  if (import.meta.env.DEV) return;

  let azuriranje;
  try {
    azuriranje = await Promise.race([check(), istek(8000)]);
  } catch (e) {
    // Bez interneta ili GitHub nedostupan: to nije greška za korisnika, samo zapis u log.
    zabelezi(`Provera ažuriranja nije uspela (aplikacija radi normalno): ${tekstGreske(e)}`);
    return;
  }
  if (!azuriranje) return;

  const verzija = azuriranje.version;
  zabelezi(`Pronađena nova verzija ${verzija}, počinje ažuriranje`);
  let ukupno = 0;
  let preuzeto = 0;
  javi({ faza: "preuzimanje", verzija, procenat: null });
  try {
    await azuriranje.downloadAndInstall((dogadjaj) => {
      if (dogadjaj.event === "Started") ukupno = dogadjaj.data.contentLength ?? 0;
      if (dogadjaj.event === "Progress") {
        preuzeto += dogadjaj.data.chunkLength;
        javi({ faza: "preuzimanje", verzija, procenat: ukupno ? Math.min(100, Math.round((preuzeto / ukupno) * 100)) : null });
      }
    });
    zabelezi(`Ažuriranje na ${verzija} instalirano, restart`);
    await relaunch();
  } catch (e) {
    const poruka = `Nije uspelo ažuriranje na verziju ${verzija}: ${tekstGreske(e)}`;
    zabeleziGresku(poruka);
    javi({ faza: "greska", poruka });
  }
}
