// Glavna komponenta: otvara bazu, drži podatke u memoriji i prebacuje ekrane.
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { pokreniMigracije } from "./baza/migracije";
import { Skladiste } from "./baza/skladiste";
import { pripremiZaPretragu, type Filter, type UnosZaPretragu } from "./logika/pretraga";
import { procitajUvoz } from "./logika/izvoz";
import { naslovKopije } from "./logika/sabloni";
import { opisPlana, planirajUvoz, type PlanUvoza } from "./logika/uvoz";
import type { Projekat, Unos } from "./logika/tipovi";
import {
  infoPodataka,
  izaberiJsonZaUvoz,
  kopirajUClipboard,
  napraviBackup,
  otvoriBazu,
  procitajFajl,
  tekstGreske,
  vratiBackupIRestartuj,
  zabelezi,
  zabeleziGresku,
  type InfoPodataka,
} from "./servisi/tauri";
import { proveriIAzuriraj, type StanjeAzuriranja } from "./servisi/azuriranje";
import { Editor } from "./ui/Editor";
import { GlavniEkran } from "./ui/GlavniEkran";
import { Potvrda } from "./ui/Potvrda";

type Ekran = { vrsta: "glavni" } | { vrsta: "editor"; unos: Unos | null; kljuc: number };

export default function App() {
  const [skladiste, setSkladiste] = useState<Skladiste | null>(null);
  const [info, setInfo] = useState<InfoPodataka | null>(null);
  const [greskaPokretanja, setGreskaPokretanja] = useState<string | null>(null);
  const [projekti, setProjekti] = useState<Projekat[]>([]);
  const [unosi, setUnosi] = useState<UnosZaPretragu[]>([]);
  const [ekran, setEkran] = useState<Ekran>({ vrsta: "glavni" });
  const [filter, setFilter] = useState<Filter>({ upit: "", tip: "svi", projekatId: "svi" });
  const [obavestenje, setObavestenje] = useState<string | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [potvrdaZatvaranja, setPotvrdaZatvaranja] = useState(false);
  const [planUvoza, setPlanUvoza] = useState<PlanUvoza | null>(null);
  const [azuriranje, setAzuriranje] = useState<StanjeAzuriranja>({ faza: "nema" });
  const izmenjenoRef = useRef(false);
  const tajmer = useRef<number | undefined>(undefined);

  /** Kratka poruka u donjem uglu (npr. „Kopirano”) koja nestaje posle 2 sekunde. */
  const obavesti = useCallback((tekst: string) => {
    setObavestenje(tekst);
    window.clearTimeout(tajmer.current);
    tajmer.current = window.setTimeout(() => setObavestenje(null), 2000);
  }, []);

  /** Svaka greška se prikazuje na srpskom i upisuje u log. Nema „tihih” grešaka. */
  const prijaviGresku = useCallback((radnja: string, e: unknown) => {
    const poruka = `Nije uspelo ${radnja}: ${tekstGreske(e)}`;
    setGreska(poruka);
    zabeleziGresku(poruka);
  }, []);

  const osvezi = useCallback(async (s: Skladiste) => {
    const podaci = await s.ucitajSve();
    setProjekti(podaci.projekti);
    setUnosi(podaci.unosi.map(pripremiZaPretragu));
  }, []);

  // Pokretanje: folder podataka → baza → migracije (uz backup) → učitavanje.
  useEffect(() => {
    (async () => {
      // Prvo provera nove verzije; ako je ima, aplikacija se ažurira i restartuje.
      await proveriIAzuriraj(setAzuriranje);
      try {
        const i = await infoPodataka();
        setInfo(i);
        const db = await otvoriBazu(i.bazaUrl);
        const primenjene = await pokreniMigracije(db, async () => {
          await napraviBackup(db, "pre-migracije");
        });
        if (primenjene.length) zabelezi(`Primenjene migracije: ${primenjene.join(", ")}`);
        const s = new Skladiste(db);
        await osvezi(s);
        setSkladiste(s);
        if (i.vracenoIz) obavesti(`Podaci su vraćeni iz backup-a ${i.vracenoIz}`);
      } catch (e) {
        const poruka = `Nije uspelo otvaranje baze: ${tekstGreske(e)}`;
        setGreskaPokretanja(poruka);
        zabeleziGresku(poruka);
      }
    })();
  }, [osvezi, obavesti]);

  // Zatvaranje prozora dok editor ima nesačuvane izmene traži potvrdu.
  useEffect(() => {
    let odjava: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested((dogadjaj) => {
        if (izmenjenoRef.current) {
          dogadjaj.preventDefault();
          setPotvrdaZatvaranja(true);
        }
      })
      .then((fn) => { odjava = fn; })
      .catch(() => {});
    return () => odjava?.();
  }, []);

  const postaviIzmenjeno = useCallback((v: boolean) => { izmenjenoRef.current = v; }, []);

  const kopiraj = useCallback(async (u: Unos) => {
    if (!skladiste) return;
    try {
      await kopirajUClipboard(u.tekst);
      const sada = Date.now();
      await skladiste.zabeleziKopiranje(u.id, sada);
      setUnosi((lista) =>
        lista.map((x) =>
          x.unos.id === u.id
            ? { ...x, unos: { ...x.unos, poslednjeKopiranje: sada, brojKopiranja: x.unos.brojKopiranja + 1 } }
            : x,
        ),
      );
      obavesti("Kopirano");
    } catch (e) {
      prijaviGresku("kopiranje", e);
    }
  }, [skladiste, obavesti, prijaviGresku]);

  const promeniOmiljen = useCallback(async (u: Unos) => {
    if (!skladiste) return;
    try {
      await skladiste.postaviOmiljen(u.id, !u.omiljen);
      setUnosi((lista) => lista.map((x) => (x.unos.id === u.id ? pripremiZaPretragu({ ...x.unos, omiljen: !u.omiljen }) : x)));
    } catch (e) {
      prijaviGresku("čuvanje", e);
    }
  }, [skladiste, prijaviGresku]);

  const sacuvaj = useCallback(async (u: Unos): Promise<boolean> => {
    if (!skladiste) return false;
    try {
      await skladiste.sacuvajUnos(u);
      await osvezi(skladiste);
      obavesti("Sačuvano");
      return true;
    } catch (e) {
      prijaviGresku("čuvanje", e);
      return false;
    }
  }, [skladiste, osvezi, obavesti, prijaviGresku]);

  const obrisi = useCallback(async (u: Unos) => {
    if (!skladiste) return;
    try {
      await skladiste.obrisiUnos(u.id);
      await osvezi(skladiste);
      setEkran({ vrsta: "glavni" });
      obavesti("Obrisano");
    } catch (e) {
      prijaviGresku("brisanje", e);
    }
  }, [skladiste, osvezi, obavesti, prijaviGresku]);

  const dupliraj = useCallback(async (u: Unos) => {
    if (!skladiste) return;
    const sada = Date.now();
    const kopija: Unos = {
      ...u,
      id: crypto.randomUUID(),
      naslov: naslovKopije(u.naslov),
      omiljen: false,
      kreiran: sada,
      izmenjen: sada,
      poslednjeKopiranje: null,
      brojKopiranja: 0,
    };
    try {
      await skladiste.sacuvajUnos(kopija);
      await osvezi(skladiste);
      setEkran({ vrsta: "editor", unos: kopija, kljuc: sada });
      obavesti("Napravljena kopija");
    } catch (e) {
      prijaviGresku("dupliranje", e);
    }
  }, [skladiste, osvezi, obavesti, prijaviGresku]);

  // Uvoz, korak 1: izbor fajla, provera i pregled. Ovde se još ništa ne upisuje u bazu.
  const pocniUvoz = useCallback(async () => {
    if (!skladiste) return;
    try {
      const putanja = await izaberiJsonZaUvoz();
      if (!putanja) return; // korisnik je odustao
      const procitano = procitajUvoz(await procitajFajl(putanja));
      if (!procitano.ok) {
        setGreska(`Uvoz nije moguć, ništa nije promenjeno. ${procitano.poruka}`);
        zabeleziGresku(`Uvoz odbijen: ${procitano.poruka}`);
        return;
      }
      setPlanUvoza(planirajUvoz(await skladiste.ucitajSve(), procitano.podaci));
    } catch (e) {
      prijaviGresku("čitanje fajla za uvoz", e);
    }
  }, [skladiste, prijaviGresku]);

  // Uvoz, korak 2 (posle potvrde): backup → upis. Ako upis pukne na pola,
  // aplikacija vraća bazu iz tog backup-a, pa je uvoz „sve ili ništa”.
  const potvrdiUvoz = useCallback(async () => {
    if (!skladiste || !planUvoza) return;
    const plan = planUvoza;
    setPlanUvoza(null);
    let backup: string | null = null;
    try {
      backup = await napraviBackup(skladiste.baza, "pre-uvoza");
      await skladiste.primeniUvoz(plan);
      await osvezi(skladiste);
      obavesti(`Uvezeno: ${plan.dodaje.length} novih, ${plan.menja.length} izmenjenih`);
      zabelezi(`Uvoz: ${opisPlana(plan)}`);
    } catch (e) {
      prijaviGresku("uvoz", e);
      if (backup) {
        zabeleziGresku(`Uvoz prekinut, vraćam bazu iz ${backup}`);
        try {
          await vratiBackupIRestartuj(backup);
        } catch (e2) {
          prijaviGresku(`vraćanje iz backup-a ${backup}`, e2);
        }
      }
    }
  }, [skladiste, planUvoza, osvezi, obavesti, prijaviGresku]);

  const nazad = useCallback(() => setEkran({ vrsta: "glavni" }), []);
  const novi = useCallback(() => setEkran({ vrsta: "editor", unos: null, kljuc: Date.now() }), []);
  const izmeni = useCallback((u: Unos) => setEkran({ vrsta: "editor", unos: u, kljuc: Date.now() }), []);

  if (greskaPokretanja) {
    return (
      <div className="ekran-greske">
        <h1>Aplikacija ne može da se pokrene</h1>
        <p>{greskaPokretanja}</p>
        {info && <p>Folder podataka: <code>{info.folder}</code><br />Detalji su u log fajlu: <code>{info.logFajl}</code></p>}
      </div>
    );
  }
  if (azuriranje.faza === "preuzimanje") {
    return (
      <div className="ucitavanje">
        <h2>Ažuriram na verziju {azuriranje.verzija}…</h2>
        <p>{azuriranje.procenat === null ? "Preuzimam" : `Preuzeto ${azuriranje.procenat}%`}. Aplikacija će se sama ponovo pokrenuti.</p>
      </div>
    );
  }
  if (!skladiste) return <div className="ucitavanje">Učitavam…</div>;

  return (
    <div className="aplikacija">
      {azuriranje.faza === "greska" && !greska && (
        <div className="traka-greske" role="alert">
          <span>{azuriranje.poruka}</span>
          <button type="button" onClick={() => setAzuriranje({ faza: "nema" })} aria-label="Zatvori poruku">×</button>
        </div>
      )}
      {greska && (
        <div className="traka-greske" role="alert">
          <span>{greska}</span>
          <button type="button" onClick={() => setGreska(null)} aria-label="Zatvori poruku">×</button>
        </div>
      )}

      {ekran.vrsta === "glavni" ? (
        <GlavniEkran
          unosi={unosi}
          projekti={projekti}
          filter={filter}
          onFilter={setFilter}
          onNovi={novi}
          onUvoz={pocniUvoz}
          onIzmeni={izmeni}
          onKopiraj={kopiraj}
          onOmiljen={promeniOmiljen}
        />
      ) : (
        <Editor
          key={ekran.kljuc}
          unos={ekran.unos}
          projekti={projekti}
          pocetniProjekatId={typeof filter.projekatId === "string" && filter.projekatId !== "svi" ? filter.projekatId : null}
          onSacuvaj={sacuvaj}
          onObrisi={obrisi}
          onDupliraj={dupliraj}
          onNazad={nazad}
          onIzmenjeno={postaviIzmenjeno}
        />
      )}

      {obavestenje && <div className="obavestenje" role="status">{obavestenje}</div>}

      {planUvoza && (
        <Potvrda
          naslov="Uvoz iz JSON fajla"
          poruka={`${opisPlana(planUvoza)} Pre uvoza aplikacija sama pravi backup.`}
          potvrdi="Uvezi"
          onPotvrdi={() => { void potvrdiUvoz(); }}
          onOtkazi={() => setPlanUvoza(null)}
        />
      )}

      {potvrdaZatvaranja && (
        <Potvrda
          naslov="Izmene nisu sačuvane"
          poruka="Ako zatvoriš aplikaciju sada, izmene u editoru će se izgubiti."
          potvrdi="Zatvori bez čuvanja"
          opasno
          onPotvrdi={() => { void getCurrentWindow().destroy(); }}
          onOtkazi={() => setPotvrdaZatvaranja(false)}
        />
      )}
    </div>
  );
}
