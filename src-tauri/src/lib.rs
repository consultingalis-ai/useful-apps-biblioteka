//! Rust deo aplikacije: pluginovi, folder podataka i komande za backup i fajlove.
//! Sam rad sa bazom (SQL) ide kroz zvanični Tauri SQL plugin iz TypeScript dela.

mod podaci;

use podaci::InfoBackupa;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

/// Folder podataka se određuje jednom, pri pokretanju.
static FOLDER: OnceLock<PathBuf> = OnceLock::new();

fn folder() -> &'static PathBuf {
    FOLDER.get_or_init(podaci::folder_podataka)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InfoPodataka {
    folder: String,
    baza_url: String,
    log_fajl: String,
    vraceno_iz: Option<String>,
}

/// Vraćanje iz backup-a koje se desilo pri ovom pokretanju (da aplikacija to prikaže).
static VRACENO_IZ: OnceLock<Option<String>> = OnceLock::new();

#[tauri::command]
fn info_podataka() -> InfoPodataka {
    let f = folder();
    InfoPodataka {
        folder: f.display().to_string(),
        baza_url: format!("sqlite:{}", podaci::putanja_baze(f).display()),
        log_fajl: f.join("biblioteka.log").display().to_string(),
        vraceno_iz: VRACENO_IZ.get().cloned().flatten(),
    }
}

#[tauri::command]
fn nova_putanja_backupa(oznaka: String, razlog: String) -> Result<String, String> {
    podaci::nova_putanja_backupa(folder(), &oznaka, &razlog).map(|p| p.display().to_string())
}

#[tauri::command]
fn lista_backupa() -> Result<Vec<InfoBackupa>, String> {
    podaci::lista_backupa(folder())
}

#[tauri::command]
fn ocisti_backupe() -> Result<usize, String> {
    podaci::ocisti_backupe(folder(), podaci::ZADRZI_BACKUPA)
}

/// Zakazuje vraćanje i restartuje aplikaciju (baza mora biti zatvorena dok se fajl menja).
#[tauri::command]
fn vrati_backup_i_restartuj(app: tauri::AppHandle, ime: String) -> Result<(), String> {
    podaci::zakazi_vracanje(folder(), &ime)?;
    log::info!("Zakazano vraćanje iz backup-a {ime}, restart aplikacije");
    app.restart();
}

#[tauri::command]
fn sacuvaj_fajl(putanja: String, sadrzaj: String) -> Result<(), String> {
    podaci::upisi_fajl(&PathBuf::from(putanja), &sadrzaj)
}

#[tauri::command]
fn procitaj_fajl(putanja: String) -> Result<String, String> {
    podaci::procitaj_fajl(&PathBuf::from(putanja))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let f = folder().clone();
    let _ = std::fs::create_dir_all(&f);

    // Pre otvaranja baze: ako je korisnik zatražio vraćanje iz backup-a, uradi ga sad.
    let vraceno = match podaci::primeni_zakazano_vracanje(&f) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Vraćanje iz backup-a nije uspelo: {e}");
            None
        }
    };
    let _ = VRACENO_IZ.set(vraceno);

    let mut builder = tauri::Builder::default();

    // Jedna instanca: drugo pokretanje samo prikaže već otvoren prozor (da se baza ne zaključa).
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(prozor) = app.get_webview_window("main") {
                let _ = prozor.unminimize();
                let _ = prozor.show();
                let _ = prozor.set_focus();
            }
        }));
        // Automatsko ažuriranje: provera i instalacija nove verzije sa GitHub Release-a.
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Folder { path: f.clone(), file_name: Some("biblioteka".into()) }),
                    Target::new(TargetKind::Stdout),
                ])
                .level(log::LevelFilter::Info)
                .max_file_size(1_000_000)
                .rotation_strategy(RotationStrategy::KeepSome(3))
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            log::info!("Pokrenuta aplikacija, folder podataka: {}", folder().display());
            if let Some(Some(ime)) = VRACENO_IZ.get() {
                log::info!("Baza vraćena iz backup-a {ime}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            info_podataka,
            nova_putanja_backupa,
            lista_backupa,
            ocisti_backupe,
            vrati_backup_i_restartuj,
            sacuvaj_fajl,
            procitaj_fajl
        ])
        .run(tauri::generate_context!())
        .expect("greška pri pokretanju aplikacije");
}
