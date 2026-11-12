//! Rad sa fajlovima: folder podataka, backup kopije, zakazano vraćanje i izvoz/uvoz fajlova.
//! Sve funkcije ovde su „čiste” (primaju putanju), pa se lako testiraju sa `cargo test`.

use serde::Serialize;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

pub const IME_APLIKACIJE: &str = "biblioteka-promptova";
pub const IME_BAZE: &str = "biblioteka.db";
pub const FOLDER_BACKUPA: &str = "backup";
pub const ZADRZI_BACKUPA: usize = 10;
const MARKER_VRACANJA: &str = "vracanje-zakazano.txt";
const PREFIKS: &str = "biblioteka_";
const RAZLOZI: [&str; 4] = ["rucni", "pre-uvoza", "pre-vracanja", "pre-migracije"];
const MAX_UVOZ_BAJTOVA: u64 = 200 * 1024 * 1024;

/// Folder podataka: %APPDATA%\biblioteka-promptova na Windows-u.
/// Na Linux-u (testovi, CI) koristi ~/.local/share/biblioteka-promptova.
pub fn folder_podataka() -> PathBuf {
    folder_iz(
        std::env::var_os("APPDATA"),
        std::env::var_os("XDG_DATA_HOME"),
        std::env::var_os("HOME"),
    )
}

pub fn folder_iz(appdata: Option<OsString>, xdg: Option<OsString>, home: Option<OsString>) -> PathBuf {
    let osnova = if let Some(a) = appdata.filter(|a| !a.is_empty()) {
        PathBuf::from(a)
    } else if let Some(x) = xdg.filter(|x| !x.is_empty()) {
        PathBuf::from(x)
    } else if let Some(h) = home {
        PathBuf::from(h).join(".local").join("share")
    } else {
        std::env::temp_dir()
    };
    osnova.join(IME_APLIKACIJE)
}

pub fn putanja_baze(folder: &Path) -> PathBuf {
    folder.join(IME_BAZE)
}

pub fn folder_backupa(folder: &Path) -> PathBuf {
    folder.join(FOLDER_BACKUPA)
}

/// Dozvoljeno ime backup fajla: biblioteka_GGGG-MM-DD_ss-mm-ss-razlog[-N].db, bez putanje.
pub fn ime_je_ispravno(ime: &str) -> bool {
    let Some(srednji) = ime.strip_prefix(PREFIKS).and_then(|s| s.strip_suffix(".db")) else {
        return false;
    };
    srednji.len() >= 19
        && srednji
            .chars()
            .all(|c| c.is_ascii_digit() || c.is_ascii_lowercase() || c == '-' || c == '_')
}

/// Vraća putanju za novi backup. `oznaka` je lokalno vreme iz aplikacije (npr. 2026-11-12_18-31-05).
pub fn nova_putanja_backupa(folder: &Path, oznaka: &str, razlog: &str) -> Result<PathBuf, String> {
    let oznaka_ok = oznaka.len() == 19 && oznaka.chars().all(|c| c.is_ascii_digit() || c == '-' || c == '_');
    if !oznaka_ok {
        return Err(format!("Neispravna oznaka vremena za backup: {oznaka}"));
    }
    if !RAZLOZI.contains(&razlog) {
        return Err(format!("Nepoznat razlog za backup: {razlog}"));
    }
    let dir = folder_backupa(folder);
    fs::create_dir_all(&dir).map_err(|e| format!("Nije uspelo pravljenje foldera za backup: {e}"))?;
    let mut putanja = dir.join(format!("{PREFIKS}{oznaka}-{razlog}.db"));
    let mut n = 2;
    while putanja.exists() {
        putanja = dir.join(format!("{PREFIKS}{oznaka}-{razlog}-{n}.db"));
        n += 1;
    }
    Ok(putanja)
}

#[derive(Serialize, Debug, PartialEq)]
pub struct InfoBackupa {
    pub ime: String,
    pub velicina: u64,
}

/// Lista backup-ova, najnoviji prvi (ime počinje datumom, pa je abecedni red i vremenski).
pub fn lista_backupa(folder: &Path) -> Result<Vec<InfoBackupa>, String> {
    let dir = folder_backupa(folder);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut lista = vec![];
    for stavka in fs::read_dir(&dir).map_err(|e| format!("Nije uspelo čitanje liste backup-ova: {e}"))? {
        let stavka = stavka.map_err(|e| e.to_string())?;
        let ime = stavka.file_name().to_string_lossy().to_string();
        if ime_je_ispravno(&ime) {
            let velicina = stavka.metadata().map(|m| m.len()).unwrap_or(0);
            lista.push(InfoBackupa { ime, velicina });
        }
    }
    lista.sort_by(|a, b| b.ime.cmp(&a.ime));
    Ok(lista)
}

/// Briše najstarije backup-ove tako da ostane najviše `zadrzi`. Vraća broj obrisanih.
pub fn ocisti_backupe(folder: &Path, zadrzi: usize) -> Result<usize, String> {
    let lista = lista_backupa(folder)?;
    let mut obrisano = 0;
    for stari in lista.iter().skip(zadrzi) {
        fs::remove_file(folder_backupa(folder).join(&stari.ime))
            .map_err(|e| format!("Nije uspelo brisanje starog backup-a {}: {e}", stari.ime))?;
        obrisano += 1;
    }
    Ok(obrisano)
}

/// Upisuje oznaku da se pri sledećem pokretanju baza vrati iz izabranog backup-a.
pub fn zakazi_vracanje(folder: &Path, ime: &str) -> Result<(), String> {
    if !ime_je_ispravno(ime) || !folder_backupa(folder).join(ime).is_file() {
        return Err(format!("Backup „{ime}” ne postoji."));
    }
    fs::write(folder.join(MARKER_VRACANJA), ime).map_err(|e| format!("Nije uspelo zakazivanje vraćanja: {e}"))
}

/// Pri pokretanju (pre otvaranja baze): ako je vraćanje zakazano, kopira backup preko baze.
/// Vraća ime vraćenog backup-a ili None ako ništa nije bilo zakazano.
pub fn primeni_zakazano_vracanje(folder: &Path) -> Result<Option<String>, String> {
    let marker = folder.join(MARKER_VRACANJA);
    if !marker.exists() {
        return Ok(None);
    }
    let ime = fs::read_to_string(&marker).map_err(|e| e.to_string())?.trim().to_string();
    // Marker brišemo odmah, da greška ne bi ponavljala vraćanje pri svakom pokretanju.
    let _ = fs::remove_file(&marker);
    if !ime_je_ispravno(&ime) {
        return Err(format!("Neispravno ime backup-a za vraćanje: {ime}"));
    }
    let izvor = folder_backupa(folder).join(&ime);
    let baza = putanja_baze(folder);
    let privremena = folder.join(format!("{IME_BAZE}.vracanje"));
    fs::copy(&izvor, &privremena).map_err(|e| format!("Nije uspelo kopiranje backup-a: {e}"))?;
    // Stari WAL/SHM fajlovi pripadaju staroj bazi i moraju da se uklone.
    for sufiks in ["-wal", "-shm"] {
        let _ = fs::remove_file(folder.join(format!("{IME_BAZE}{sufiks}")));
    }
    fs::rename(&privremena, &baza).map_err(|e| format!("Nije uspelo vraćanje baze: {e}"))?;
    Ok(Some(ime))
}

/// Upis izvoza u fajl koji je korisnik izabrao u prozoru „Sačuvaj kao”.
pub fn upisi_fajl(putanja: &Path, sadrzaj: &str) -> Result<(), String> {
    fs::write(putanja, sadrzaj).map_err(|e| format!("Nije uspelo čuvanje fajla: {e}"))
}

/// Čitanje uvoznog fajla (sa ograničenjem veličine, da ogroman fajl ne zaguši aplikaciju).
pub fn procitaj_fajl(putanja: &Path) -> Result<String, String> {
    let velicina = fs::metadata(putanja).map_err(|e| format!("Fajl ne postoji ili nije dostupan: {e}"))?.len();
    if velicina > MAX_UVOZ_BAJTOVA {
        return Err("Fajl je prevelik za uvoz (najviše 200 MB).".into());
    }
    let bajtovi = fs::read(putanja).map_err(|e| format!("Nije uspelo čitanje fajla: {e}"))?;
    String::from_utf8(bajtovi).map_err(|_| "Fajl nije tekstualni UTF-8 fajl.".into())
}

#[cfg(test)]
mod testovi {
    use super::*;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn folder_na_windowsu_je_u_appdata() {
        let f = folder_iz(Some("C:\\Users\\D\\AppData\\Roaming".into()), None, None);
        assert!(f.ends_with(IME_APLIKACIJE));
        assert!(f.starts_with("C:\\Users\\D\\AppData\\Roaming"));
    }

    #[test]
    fn folder_bez_appdata_koristi_home() {
        let f = folder_iz(None, None, Some("/home/d".into()));
        assert_eq!(f, PathBuf::from("/home/d/.local/share/biblioteka-promptova"));
    }

    #[test]
    fn provera_imena() {
        assert!(ime_je_ispravno("biblioteka_2026-11-12_18-31-05-rucni.db"));
        assert!(ime_je_ispravno("biblioteka_2026-11-12_18-31-05-pre-uvoza-2.db"));
        assert!(!ime_je_ispravno("../biblioteka_2026-11-12_18-31-05-rucni.db"));
        assert!(!ime_je_ispravno("biblioteka_..\\x.db"));
        assert!(!ime_je_ispravno("nesto.db"));
    }

    #[test]
    fn nova_putanja_ne_prepisuje_postojeci() {
        let d = tmp();
        let p1 = nova_putanja_backupa(d.path(), "2026-11-12_18-31-05", "rucni").unwrap();
        fs::write(&p1, "x").unwrap();
        let p2 = nova_putanja_backupa(d.path(), "2026-11-12_18-31-05", "rucni").unwrap();
        assert_ne!(p1, p2);
        assert!(nova_putanja_backupa(d.path(), "../../x", "rucni").is_err());
        assert!(nova_putanja_backupa(d.path(), "2026-11-12_18-31-05", "bilo-sta").is_err());
    }

    #[test]
    fn cuva_se_poslednjih_10() {
        let d = tmp();
        for dan in 1..=13 {
            let p = nova_putanja_backupa(d.path(), &format!("2026-11-{dan:02}_10-00-00"), "rucni").unwrap();
            fs::write(p, "x").unwrap();
        }
        assert_eq!(ocisti_backupe(d.path(), ZADRZI_BACKUPA).unwrap(), 3);
        let lista = lista_backupa(d.path()).unwrap();
        assert_eq!(lista.len(), 10);
        assert_eq!(lista[0].ime, "biblioteka_2026-11-13_10-00-00-rucni.db");
        assert_eq!(lista[9].ime, "biblioteka_2026-11-04_10-00-00-rucni.db");
    }

    #[test]
    fn prazan_folder_nema_backupa() {
        let d = tmp();
        assert_eq!(lista_backupa(d.path()).unwrap(), vec![]);
        assert_eq!(primeni_zakazano_vracanje(d.path()).unwrap(), None);
    }

    #[test]
    fn vracanje_iz_backupa() {
        let d = tmp();
        fs::write(putanja_baze(d.path()), "stara baza").unwrap();
        fs::write(d.path().join("biblioteka.db-wal"), "stari wal").unwrap();
        let p = nova_putanja_backupa(d.path(), "2026-11-12_18-31-05", "rucni").unwrap();
        fs::write(&p, "backup sadrzaj").unwrap();
        let ime = p.file_name().unwrap().to_string_lossy().to_string();

        assert!(zakazi_vracanje(d.path(), "biblioteka_2026-01-01_00-00-00-rucni.db").is_err());
        zakazi_vracanje(d.path(), &ime).unwrap();
        assert_eq!(primeni_zakazano_vracanje(d.path()).unwrap(), Some(ime));
        assert_eq!(fs::read_to_string(putanja_baze(d.path())).unwrap(), "backup sadrzaj");
        assert!(!d.path().join("biblioteka.db-wal").exists());
        // Drugi put nema ničeg zakazanog.
        assert_eq!(primeni_zakazano_vracanje(d.path()).unwrap(), None);
    }

    #[test]
    fn upis_i_citanje_fajla_sa_kvacicama() {
        let d = tmp();
        let p = d.path().join("izvoz.json");
        upisi_fajl(&p, "čćšžđ").unwrap();
        assert_eq!(procitaj_fajl(&p).unwrap(), "čćšžđ");
        fs::write(&p, [0xff, 0xfe, 0x00]).unwrap();
        assert!(procitaj_fajl(&p).is_err());
        assert!(procitaj_fajl(&d.path().join("nema.json")).is_err());
    }
}
