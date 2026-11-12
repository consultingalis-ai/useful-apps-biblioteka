// Prozorčić za potvrdu („Da li si siguran?”). Enter potvrđuje, Esc otkazuje.
import { useEffect, useRef } from "react";

export interface PotvrdaProps {
  naslov: string;
  poruka: string;
  potvrdi: string;
  opasno?: boolean;
  onPotvrdi: () => void;
  onOtkazi: () => void;
}

export function Potvrda({ naslov, poruka, potvrdi, opasno, onPotvrdi, onOtkazi }: PotvrdaProps) {
  const dugme = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dugme.current?.focus();
    const tastatura = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onOtkazi();
      }
    };
    window.addEventListener("keydown", tastatura, true);
    return () => window.removeEventListener("keydown", tastatura, true);
  }, [onOtkazi]);

  return (
    <div className="pozadina-modala" role="presentation" onMouseDown={onOtkazi}>
      <div className="modal" role="alertdialog" aria-labelledby="naslov-potvrde" onMouseDown={(e) => e.stopPropagation()}>
        <h2 id="naslov-potvrde">{naslov}</h2>
        <p>{poruka}</p>
        <div className="dugmad desno">
          <button type="button" onClick={onOtkazi}>Otkaži</button>
          <button type="button" ref={dugme} className={opasno ? "opasno" : "glavno"} onClick={onPotvrdi}>
            {potvrdi}
          </button>
        </div>
      </div>
    </div>
  );
}
