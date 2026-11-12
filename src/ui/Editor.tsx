// Editor za novi unos ili izmenu postojećeg.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatBroj } from "../logika/format";
import { parsirajOznake, SABLON_NASTAVAK } from "../logika/sabloni";
import { MAX_NASLOV, MAX_TEKST, NAZIVI_TIPOVA, TIPOVI, type Projekat, type Tip, type Unos } from "../logika/tipovi";
import { jeIspravno, validirajUnos, type FormaUnosa } from "../logika/validacija";
import { Potvrda } from "./Potvrda";

interface Props {
  unos: Unos | null; // null = novi unos
  projekti: Projekat[];
  pocetniProjekatId: string | null;
  onSacuvaj: (u: Unos) => Promise<boolean>;
  onObrisi: (u: Unos) => Promise<void>;
  onDupliraj: (u: Unos) => Promise<void>;
  onNazad: () => void;
  onIzmenjeno: (izmenjeno: boolean) => void;
}

interface Stanje {
  naslov: string;
  tip: Tip;
  projekatId: string | null;
  oznake: string; // kako korisnik kuca: „ai, rad”
  tekst: string;
  omiljen: boolean;
}

function pocetnoStanje(unos: Unos | null, projekatId: string | null): Stanje {
  if (unos) {
    return {
      naslov: unos.naslov,
      tip: unos.tip,
      projekatId: unos.projekatId,
      oznake: unos.oznake.join(", "),
      tekst: unos.tekst,
      omiljen: unos.omiljen,
    };
  }
  return { naslov: "", tip: "prompt", projekatId, oznake: "", tekst: "", omiljen: false };
}

type Dijalog = null | "izlaz" | "brisanje";

export function Editor({ unos, projekti, pocetniProjekatId, onSacuvaj, onObrisi, onDupliraj, onNazad, onIzmenjeno }: Props) {
  const [pocetno] = useState(() => pocetnoStanje(unos, pocetniProjekatId));
  const [s, setS] = useState<Stanje>(pocetno);
  const [dodirnuto, setDodirnuto] = useState<Set<string>>(new Set());
  const [dijalog, setDijalog] = useState<Dijalog>(null);
  const [cuva, setCuva] = useState(false);
  const naslovRef = useRef<HTMLInputElement>(null);

  const forma: FormaUnosa = useMemo(
    () => ({ naslov: s.naslov, tip: s.tip, projekatId: s.projekatId, oznake: parsirajOznake(s.oznake), tekst: s.tekst }),
    [s],
  );
  const greske = validirajUnos(forma, projekti);
  const ispravno = jeIspravno(greske);
  const izmenjeno = JSON.stringify(s) !== JSON.stringify(pocetno);

  useEffect(() => onIzmenjeno(izmenjeno), [izmenjeno, onIzmenjeno]);
  useEffect(() => naslovRef.current?.focus(), []);

  const postavi = <K extends keyof Stanje>(polje: K, vrednost: Stanje[K]) => {
    setS((st) => ({ ...st, [polje]: vrednost }));
    setDodirnuto((d) => new Set(d).add(polje));
  };

  // Kad se izabere tip „nastavak”, prazan tekst se popuni šablonom.
  const promeniTip = (tip: Tip) => {
    setS((st) => ({
      ...st,
      tip,
      tekst: tip === "nastavak" && st.tekst.trim() === "" ? SABLON_NASTAVAK : st.tekst,
    }));
  };

  const sacuvaj = useCallback(async () => {
    if (!ispravno || cuva) return;
    setCuva(true);
    const sada = Date.now();
    const novi: Unos = {
      id: unos?.id ?? crypto.randomUUID(),
      tip: s.tip,
      naslov: s.naslov.trim(),
      tekst: s.tekst,
      projekatId: s.projekatId,
      oznake: forma.oznake,
      omiljen: s.omiljen,
      kreiran: unos?.kreiran ?? sada,
      izmenjen: sada,
      poslednjeKopiranje: unos?.poslednjeKopiranje ?? null,
      brojKopiranja: unos?.brojKopiranja ?? 0,
    };
    const uspeh = await onSacuvaj(novi);
    setCuva(false);
    if (uspeh) {
      onIzmenjeno(false);
      onNazad();
    }
  }, [ispravno, cuva, unos, s, forma.oznake, onSacuvaj, onIzmenjeno, onNazad]);

  const nazad = useCallback(() => {
    if (izmenjeno) setDijalog("izlaz");
    else onNazad();
  }, [izmenjeno, onNazad]);

  // Prečice u editoru: Ctrl+S čuva, Esc vraća nazad.
  useEffect(() => {
    const tastatura = (e: KeyboardEvent) => {
      if (dijalog) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void sacuvaj();
      } else if (e.key === "Escape") {
        e.preventDefault();
        nazad();
      }
    };
    window.addEventListener("keydown", tastatura);
    return () => window.removeEventListener("keydown", tastatura);
  }, [dijalog, sacuvaj, nazad]);

  const prikaziGresku = (polje: keyof FormaUnosa) =>
    (dodirnuto.has(polje) || unos !== null) && greske[polje] ? <p className="greska">{greske[polje]}</p> : null;

  // Arhiviran projekat se prikazuje samo ako mu ovaj unos već pripada.
  const ponudjeniProjekti = projekti.filter((p) => !p.arhiviran || p.id === s.projekatId);

  return (
    <div className="editor">
      <div className="traka">
        <button type="button" onClick={nazad} title="Esc">← Nazad</button>
        <h2>{unos ? "Izmena unosa" : "Novi unos"}</h2>
        <div className="dugmad">
          {unos && (
            <>
              <button
                type="button"
                onClick={() => onDupliraj(unos)}
                disabled={izmenjeno}
                title={izmenjeno ? "Prvo sačuvaj izmene" : "Napravi kopiju ovog unosa"}
              >
                Dupliraj
              </button>
              <button type="button" className="opasno-tekst" onClick={() => setDijalog("brisanje")}>Obriši</button>
            </>
          )}
          <button type="button" className="glavno" onClick={sacuvaj} disabled={!ispravno || cuva} title="Ctrl+S">
            {cuva ? "Čuvam…" : "Sačuvaj"}
          </button>
        </div>
      </div>

      <div className="polja">
        <div className="red">
          <label className="polje rasiri">
            <span>Naslov <span className="brojac">{s.naslov.trim().length}/{MAX_NASLOV}</span></span>
            <input ref={naslovRef} value={s.naslov} onChange={(e) => postavi("naslov", e.target.value)} />
            {prikaziGresku("naslov")}
          </label>
          <label className="polje zvezda-polje" title="Omiljen unos je uvek na vrhu liste">
            <span>Omiljen</span>
            <button
              type="button"
              className={"zvezdica velika" + (s.omiljen ? " ukljucena" : "")}
              onClick={() => postavi("omiljen", !s.omiljen)}
            >
              {s.omiljen ? "★" : "☆"}
            </button>
          </label>
        </div>
        <div className="red">
          <label className="polje">
            <span>Tip</span>
            <select value={s.tip} onChange={(e) => promeniTip(e.target.value as Tip)}>
              {TIPOVI.map((t) => <option key={t} value={t}>{NAZIVI_TIPOVA[t]}</option>)}
            </select>
          </label>
          <label className="polje">
            <span>Projekat</span>
            <select value={s.projekatId ?? ""} onChange={(e) => postavi("projekatId", e.target.value || null)}>
              <option value="">Van projekta</option>
              {ponudjeniProjekti.map((p) => (
                <option key={p.id} value={p.id}>{p.naziv}{p.arhiviran ? " (arhiviran)" : ""}</option>
              ))}
            </select>
            {prikaziGresku("projekatId")}
          </label>
          <label className="polje rasiri">
            <span>Oznake (odvojene zarezom)</span>
            <input value={s.oznake} placeholder="npr. claude, rad, šablon" onChange={(e) => postavi("oznake", e.target.value)} />
            {prikaziGresku("oznake")}
          </label>
        </div>
        <label className="polje tekst-polje">
          <span>
            Tekst <span className="brojac">{formatBroj(s.tekst.length)} / {formatBroj(MAX_TEKST)} znakova</span>
          </span>
          <textarea value={s.tekst} spellCheck={false} onChange={(e) => postavi("tekst", e.target.value)} />
          {prikaziGresku("tekst")}
        </label>
      </div>

      {dijalog === "izlaz" && (
        <Potvrda
          naslov="Izmene nisu sačuvane"
          poruka="Ako izađeš sada, izmene u ovom unosu će se izgubiti."
          potvrdi="Izađi bez čuvanja"
          opasno
          onPotvrdi={() => { setDijalog(null); onIzmenjeno(false); onNazad(); }}
          onOtkazi={() => setDijalog(null)}
        />
      )}
      {dijalog === "brisanje" && unos && (
        <Potvrda
          naslov="Obrisati unos?"
          poruka={`Unos „${unos.naslov}” biće trajno obrisan.`}
          potvrdi="Obriši"
          opasno
          onPotvrdi={() => { setDijalog(null); onIzmenjeno(false); void onObrisi(unos); }}
          onOtkazi={() => setDijalog(null)}
        />
      )}
    </div>
  );
}
