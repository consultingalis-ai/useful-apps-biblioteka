// Glavni ekran: tipovi i projekti levo, pretraga gore, kartice u sredini.
import { useEffect, useMemo, useRef, useState } from "react";
import { filtriraj, type Filter, type UnosZaPretragu } from "../logika/pretraga";
import { sortiraj } from "../logika/redosled";
import { prvaTriReda } from "../logika/sabloni";
import { NAZIVI_TIPOVA, TIPOVI, type Projekat, type Tip, type Unos } from "../logika/tipovi";

interface Props {
  unosi: UnosZaPretragu[];
  projekti: Projekat[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  onNovi: () => void;
  onUvoz: () => void;
  onIzmeni: (u: Unos) => void;
  onKopiraj: (u: Unos) => void;
  onOmiljen: (u: Unos) => void;
}

const NAZIVI_GRUPA: Record<Tip | "svi", string> = {
  svi: "Svi",
  prompt: "Promptovi",
  instrukcije: "Instrukcije",
  nastavak: "Nastavci",
};

export function GlavniEkran({ unosi, projekti, filter, onFilter, onNovi, onUvoz, onIzmeni, onKopiraj, onOmiljen }: Props) {
  const pretraga = useRef<HTMLInputElement>(null);
  const [izabran, setIzabran] = useState(0);

  const prikaz = useMemo(() => sortiraj(filtriraj(unosi, filter), Date.now()), [unosi, filter]);
  const projektiPoId = useMemo(() => new Map(projekti.map((p) => [p.id, p])), [projekti]);

  // Brojevi za levu stranu (računaju se nad svim unosima, bez pretrage).
  const brojPoTipu = useMemo(() => {
    const m = new Map<string, number>([["svi", unosi.length]]);
    for (const { unos } of unosi) m.set(unos.tip, (m.get(unos.tip) ?? 0) + 1);
    return m;
  }, [unosi]);
  const brojPoProjektu = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const { unos } of unosi) m.set(unos.projekatId, (m.get(unos.projekatId) ?? 0) + 1);
    return m;
  }, [unosi]);

  // Posle promene pretrage ili filtera izbor se vraća na prvu karticu.
  useEffect(() => setIzabran(0), [filter]);
  const indeks = Math.min(izabran, Math.max(prikaz.length - 1, 0));

  // Prečice: Ctrl+F pretraga, Ctrl+N novi, strelice biraju karticu, Enter kopira.
  useEffect(() => {
    const tastatura = (e: KeyboardEvent) => {
      if (document.querySelector(".pozadina-modala")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        pretraga.current?.focus();
        pretraga.current?.select();
      } else if (ctrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNovi();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (prikaz.length === 0) return;
        e.preventDefault();
        setIzabran((i) => {
          const tren = Math.min(i, prikaz.length - 1);
          return e.key === "ArrowDown" ? Math.min(tren + 1, prikaz.length - 1) : Math.max(tren - 1, 0);
        });
      } else if (e.key === "Enter" && !ctrl) {
        const meta = e.target as HTMLElement;
        if (meta.tagName === "BUTTON" || meta.tagName === "SELECT" || meta.tagName === "TEXTAREA") return;
        const u = prikaz[Math.min(izabran, prikaz.length - 1)];
        if (u) {
          e.preventDefault();
          onKopiraj(u.unos);
        }
      }
    };
    window.addEventListener("keydown", tastatura);
    return () => window.removeEventListener("keydown", tastatura);
  }, [prikaz, izabran, onNovi, onKopiraj]);

  // Izabrana kartica uvek ostaje vidljiva.
  useEffect(() => {
    document.querySelector(".kartica.izabrana")?.scrollIntoView({ block: "nearest" });
  }, [indeks]);

  const aktivniProjekti = projekti.filter((p) => !p.arhiviran);

  return (
    <div className="glavni">
      <aside className="leva-strana">
        <h3>Tip</h3>
        {(["svi", ...TIPOVI] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={"stavka" + (filter.tip === t ? " aktivna" : "")}
            onClick={() => onFilter({ ...filter, tip: t })}
          >
            <span>{NAZIVI_GRUPA[t]}</span>
            <span className="broj">{brojPoTipu.get(t) ?? 0}</span>
          </button>
        ))}
        <h3>Projekti</h3>
        <button
          type="button"
          className={"stavka" + (filter.projekatId === "svi" ? " aktivna" : "")}
          onClick={() => onFilter({ ...filter, projekatId: "svi" })}
        >
          <span>Svi projekti</span>
          <span className="broj">{unosi.length}</span>
        </button>
        {aktivniProjekti.map((p) => (
          <button
            key={p.id}
            type="button"
            className={"stavka" + (filter.projekatId === p.id ? " aktivna" : "")}
            onClick={() => onFilter({ ...filter, projekatId: p.id })}
          >
            <span><span className="tacka" style={{ background: p.boja }} />{p.naziv}</span>
            <span className="broj">{brojPoProjektu.get(p.id) ?? 0}</span>
          </button>
        ))}
        <button
          type="button"
          className={"stavka" + (filter.projekatId === null ? " aktivna" : "")}
          onClick={() => onFilter({ ...filter, projekatId: null })}
        >
          <span><span className="tacka prazna" />Van projekta</span>
          <span className="broj">{brojPoProjektu.get(null) ?? 0}</span>
        </button>
      </aside>

      <section className="sredina">
        <div className="traka">
          <input
            ref={pretraga}
            className="pretraga"
            type="search"
            placeholder="Pretraga po naslovu, tekstu i oznakama (Ctrl+F)"
            value={filter.upit}
            onChange={(e) => onFilter({ ...filter, upit: e.target.value })}
            autoFocus
          />
          <button type="button" onClick={onUvoz} title="Uvoz unosa iz JSON fajla">Uvezi JSON</button>
          <button type="button" className="glavno" onClick={onNovi} title="Ctrl+N">+ Novi</button>
        </div>

        {unosi.length === 0 ? (
          <div className="prazno">
            <p>Još nema unosa.</p>
            <p>Klikni <strong>+ Novi</strong> (ili Ctrl+N) da dodaš prvi prompt, instrukcije ili nastavak.</p>
            <p>Imaš izvoz ili početni fajl? Klikni <strong>Uvezi JSON</strong>.</p>
          </div>
        ) : prikaz.length === 0 ? (
          <div className="prazno">
            <p>Ništa ne odgovara izboru{filter.upit.trim() ? ` i pretrazi „${filter.upit.trim()}”` : ""}.</p>
            <p>Probaj drugu reč ili izaberi „Svi” levo.</p>
          </div>
        ) : (
          <div className="kartice" role="listbox" aria-label="Unosi">
            {prikaz.map(({ unos }, i) => {
              const projekat = unos.projekatId ? projektiPoId.get(unos.projekatId) : undefined;
              return (
                <article
                  key={unos.id}
                  className={"kartica" + (i === indeks ? " izabrana" : "")}
                  role="option"
                  aria-selected={i === indeks}
                  onClick={() => setIzabran(i)}
                  onDoubleClick={() => onIzmeni(unos)}
                >
                  <header>
                    <button
                      type="button"
                      className={"zvezdica" + (unos.omiljen ? " ukljucena" : "")}
                      title={unos.omiljen ? "Ukloni iz omiljenih" : "Dodaj u omiljene"}
                      onClick={(e) => { e.stopPropagation(); onOmiljen(unos); }}
                    >
                      {unos.omiljen ? "★" : "☆"}
                    </button>
                    <h4 title={unos.naslov}>{unos.naslov}</h4>
                    <span className="tip">{NAZIVI_TIPOVA[unos.tip]}</span>
                  </header>
                  <div className="meta">
                    {projekat ? (
                      <span className="projekat"><span className="tacka" style={{ background: projekat.boja }} />{projekat.naziv}</span>
                    ) : (
                      <span className="projekat bled">Van projekta</span>
                    )}
                    {unos.oznake.map((o) => <span key={o} className="oznaka">{o}</span>)}
                  </div>
                  <pre className="pregled">{prvaTriReda(unos.tekst)}</pre>
                  <footer>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onIzmeni(unos); }}>Izmeni</button>
                    <button type="button" className="glavno" onClick={(e) => { e.stopPropagation(); onKopiraj(unos); }}>
                      Kopiraj
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
        {prikaz.length > 0 && <p className="pomoc">↑ ↓ biraju karticu · Enter kopira · dvoklik otvara izmenu</p>}
      </section>
    </div>
  );
}
