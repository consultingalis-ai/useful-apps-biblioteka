// Plan uvoza: šta će se dodati, a šta izmeniti. Ništa se ne upisuje dok korisnik ne potvrdi.
import { kljucNaziva } from "./normalizacija";
import type { Projekat, SviPodaci, Unos } from "./tipovi";

export interface PlanUvoza {
  noviProjekti: Projekat[];
  izmenjeniProjekti: Projekat[]; // postojeći projekat, nova boja ili status arhive
  dodaje: Unos[];
  menja: Unos[];
  nepromenjeno: number;
}

function istaLista(a: string[], b: string[]): boolean {
  const ka = a.map(kljucNaziva).sort();
  const kb = b.map(kljucNaziva).sort();
  return ka.length === kb.length && ka.every((x, i) => x === kb[i]);
}

function istiUnos(a: Unos, b: Unos): boolean {
  return (
    a.tip === b.tip &&
    a.naslov === b.naslov &&
    a.tekst === b.tekst &&
    a.projekatId === b.projekatId &&
    a.omiljen === b.omiljen &&
    a.kreiran === b.kreiran &&
    a.izmenjen === b.izmenjen &&
    a.poslednjeKopiranje === b.poslednjeKopiranje &&
    a.brojKopiranja === b.brojKopiranja &&
    istaLista(a.oznake, b.oznake)
  );
}

export function planirajUvoz(trenutno: SviPodaci, uvoz: SviPodaci): PlanUvoza {
  const poKljucu = new Map(trenutno.projekti.map((p) => [kljucNaziva(p.naziv), p]));
  const poId = new Map(trenutno.projekti.map((p) => [p.id, p]));
  // Projekat iz fajla → id projekta u ovoj bazi. Prvo se traži isti naziv, pa isti id.
  const mapa = new Map<string, string>();
  const noviProjekti: Projekat[] = [];
  const izmenjeniProjekti: Projekat[] = [];

  for (const p of uvoz.projekti) {
    const postojeci = poKljucu.get(kljucNaziva(p.naziv)) ?? poId.get(p.id);
    if (postojeci) {
      mapa.set(p.id, postojeci.id);
      if (postojeci.boja !== p.boja || postojeci.arhiviran !== p.arhiviran) {
        izmenjeniProjekti.push({ ...postojeci, boja: p.boja, arhiviran: p.arhiviran });
      }
    } else {
      mapa.set(p.id, p.id);
      noviProjekti.push(p);
      poKljucu.set(kljucNaziva(p.naziv), p);
      poId.set(p.id, p);
    }
  }

  const postojeciUnosi = new Map(trenutno.unosi.map((u) => [u.id, u]));
  const dodaje: Unos[] = [];
  const menja: Unos[] = [];
  let nepromenjeno = 0;

  for (const u of uvoz.unosi) {
    const prilagodjen: Unos = { ...u, projekatId: u.projekatId === null ? null : (mapa.get(u.projekatId) ?? null) };
    const stari = postojeciUnosi.get(u.id);
    if (!stari) dodaje.push(prilagodjen);
    else if (!istiUnos(stari, prilagodjen)) menja.push(prilagodjen);
    else nepromenjeno++;
  }

  return { noviProjekti, izmenjeniProjekti, dodaje, menja, nepromenjeno };
}

/** Rečenica za ekran potvrde, npr. „Dodaće se 3, izmeniti 1 (bez promene: 10). Novi projekti: 1.” */
export function opisPlana(plan: PlanUvoza): string {
  let tekst = `Dodaće se ${plan.dodaje.length}, izmeniti ${plan.menja.length} (bez promene: ${plan.nepromenjeno}).`;
  if (plan.noviProjekti.length) tekst += ` Novi projekti: ${plan.noviProjekti.length}.`;
  if (plan.izmenjeniProjekti.length) tekst += ` Izmenjeni projekti: ${plan.izmenjeniProjekti.length}.`;
  return tekst;
}
