//! Proses utama AntiKebo untuk PC (docs/09-APLIKASI-PC.md §3 sampai §8): baki, sambung sekali
//! klik, SSE + salinan jadwal + pengatur waktu lokal (mesin di `antikebo_inti::alarm`), detak
//! 30 detik, unduh klip, pemutar, daya, penjaga, soal luring, dan pembaruan otomatis.

use crate::catat::catat;
use crate::jendela;
use crate::penjaga;
use crate::simpan::{self, KirimLuring};
use crate::sistem::{self, Daya, KeadaanDaya, StatusDaya};
use crate::suara::{self, OmelanPutar, Pemutar, Rencana};
use antikebo_inti::alarm::{AlasanHenti, Mesin, Sumber, Tindakan};
use antikebo_inti::api::{jalur_jendela_sah, Detak, HasilAmbil, Kemampuan};
use antikebo_inti::daya::AksiTutup;
use antikebo_inti::jadwal::{
    alarm_berikutnya, benih_kejadian, boleh_perbarui, kebutuhan_berkas, keluar_terkunci, naik_dtk, saat_bunyi, sedang_siaga, ItemJadwal, SoalJadwal,
    TundaJadwal,
};
use antikebo_inti::klip::{nama_berkas, rencanakan, BerkasKlip};
use antikebo_inti::soal::{jawaban_benar, sesudah_jawab, soal_luring, KeadaanUrutan, Tingkat};
use antikebo_inti::sse::{data_peristiwa, Peristiwa};
use antikebo_klien::{Galat, Klien};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::path::BaseDirectory;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, Wry};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

const VERSI: &str = env!("CARGO_PKG_VERSION");
const BUNYI: [&str; 8] = ["klasik", "digital", "sirene", "lonceng", "kebakaran", "ayam", "nuklir", "naik"];

// ------------------------------------------------------------------ kamus (salinan kamus web)

static KAMUS: LazyLock<Value> = LazyLock::new(|| serde_json::from_str(include_str!("../../ui/kamus.json")).expect("kamus.json"));

fn t(bahasa: &str, jalur: &str) -> String {
    let b = if bahasa == "en" { "en" } else { "id" };
    jalur.split('.').try_fold(&KAMUS[b], |v, k| v.get(k)).and_then(Value::as_str).unwrap_or(jalur).to_string()
}

fn isi(teks: String, kunci: &str, nilai: &str) -> String {
    teks.replace(&format!("{{{kunci}}}"), nilai)
}

/// Bahasa sebelum tersambung: Indonesia bila Windows berbahasa atau berwilayah Indonesia.
fn bahasa_sistem() -> String {
    let l = sys_locale::get_locale().unwrap_or_default().to_lowercase();
    if l.starts_with("id") || l.ends_with("-id") || l.is_empty() {
        "id".into()
    } else {
        "en".into()
    }
}

fn jam_tampil(jam: &str, bahasa: &str) -> String {
    if bahasa == "en" {
        jam.to_string()
    } else {
        jam.replace(':', ".")
    }
}

fn sekarang_lokal() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

// ------------------------------------------------------------------ keadaan

struct Sambung {
    kode: String,
    tautan: String,
}

struct SesiLuring {
    kunci: String,
    target: u32,
    keadaan: KeadaanUrutan,
    jawaban: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemTampil {
    kunci: String,
    judul: String,
    detail: Option<String>,
    jam: String,
    uji: bool,
    soal: SoalJadwal,
    tunda: TundaJadwal,
    cek_pada: Option<String>,
    cek_batas: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "mode", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Layar {
    Berbunyi { item: ItemTampil, kejadian_id: Option<String>, lokal: bool },
    Cek { item: ItemTampil, kejadian_id: Option<String> },
    Selesai { item: ItemTampil, alasan: String, lagi: Option<String> },
}

#[derive(Default)]
struct Keadaan {
    mesin: Mesin,
    token: Option<String>,
    sambung: Option<Sambung>,
    galat_sambung: Option<String>,
    daring: bool,
    nama: String,
    bahasa: String,
    /// Selisih jam server dan jam PC (md), dari jawaban jadwal.
    selisih_ms: i64,
    layar: Option<Layar>,
    omelan: Option<String>,
    luring: Option<SesiLuring>,
    antrean: Vec<KirimLuring>,
    dengar: Option<bool>,
    penjaga: Option<u32>,
    daya: KeadaanDaya,
    status_daya: StatusDaya,
    tutup: Option<AksiTutup>,
    tutup_gagal: bool,
    klip_siap: bool,
    jadwal_pada: Option<i64>,
    teks_baki: String,
    notif_dicas: bool,
}

impl Keadaan {
    fn sekarang(&self) -> i64 {
        sekarang_lokal() + self.selisih_ms
    }
}

pub struct Aplikasi {
    k: Mutex<Keadaan>,
    klien: Klien,
    pemutar: Pemutar,
    daya: Daya,
    folder: PathBuf,
    baki: Mutex<Option<MenuItem<Wry>>>,
}

fn kunci_k(app: &AppHandle) -> std::sync::MutexGuard<'_, Keadaan> {
    // Racun mutex (utas lain panik) tidak boleh mematikan alarm: lanjutkan dengan isinya.
    apl_ref(app).k.lock().unwrap_or_else(|e| e.into_inner())
}

fn apl_ref(app: &AppHandle) -> &Aplikasi {
    // `State` meminjam dari AppHandle yang hidup sepanjang aplikasi.
    let s: tauri::State<'_, Aplikasi> = app.state::<Aplikasi>();
    s.inner()
}

fn item_tampil(i: &ItemJadwal, bahasa: &str) -> ItemTampil {
    let rfc = |t: Option<time::OffsetDateTime>| t.and_then(|x| x.format(&time::format_description::well_known::Rfc3339).ok());
    ItemTampil {
        kunci: i.kunci.clone(),
        judul: i.judul.clone(),
        detail: i.detail.clone(),
        jam: jam_tampil(&i.jam, bahasa),
        uji: i.uji,
        soal: i.soal.clone(),
        tunda: i.tunda.clone(),
        cek_pada: rfc(i.cek_pada),
        cek_batas: rfc(i.cek_batas),
    }
}

// ------------------------------------------------------------------ tampilan pengaturan

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Periksa {
    autostart: bool,
    suara: bool,
    /// None = bukan laptop / tidak diketahui; true = perlu diperbaiki.
    tutup_laptop: Option<bool>,
    tutup_gagal: bool,
    dicas: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeadaanTampil {
    bahasa: String,
    versi: &'static str,
    tersambung: bool,
    nama: String,
    kode: Option<String>,
    galat_sambung: Option<String>,
    daring: bool,
    alarm_berikut: Option<String>,
    judul_berikut: Option<String>,
    periksa: Periksa,
    dengar: Option<bool>,
    /// "komitmen" | "berbunyi" | null
    keluar_terkunci: Option<&'static str>,
}

fn alasan_terkunci(k: &Keadaan) -> Option<&'static str> {
    if k.mesin.berbunyi() || matches!(k.layar, Some(Layar::Cek { .. })) {
        Some("berbunyi")
    } else if keluar_terkunci(&k.mesin.jadwal, k.sekarang()) {
        Some("komitmen")
    } else {
        None
    }
}

fn keadaan_tampil(app: &AppHandle) -> KeadaanTampil {
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    let suara = suara::ada_keluaran();
    let k = kunci_k(app);
    let b = alarm_berikutnya(&k.mesin.jadwal, k.sekarang());
    KeadaanTampil {
        bahasa: k.bahasa.clone(),
        versi: VERSI,
        tersambung: k.token.is_some(),
        nama: k.nama.clone(),
        kode: k.sambung.as_ref().map(|s| s.kode.clone()),
        galat_sambung: k.galat_sambung.clone(),
        daring: k.daring,
        alarm_berikut: b.map(|i| jam_tampil(&i.jam, &k.bahasa)),
        judul_berikut: b.map(|i| i.judul.clone()),
        periksa: Periksa {
            autostart,
            suara,
            tutup_laptop: if k.status_daya.dicas.is_some() { k.tutup.map(|a| a.perlu_diperbaiki()) } else { None },
            tutup_gagal: k.tutup_gagal,
            dicas: k.status_daya.dicas,
        },
        dengar: k.dengar,
        keluar_terkunci: alasan_terkunci(&k),
    }
}

fn kabari(app: &AppHandle) {
    let _ = app.emit("keadaan", ());
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmTampil {
    layar: Option<Layar>,
    daring: bool,
    nama: String,
    bahasa: String,
    omelan: Option<String>,
}

fn kabari_alarm(app: &AppHandle) {
    let _ = app.emit("alarm", ());
}

// ------------------------------------------------------------------ perintah (dipanggil tampilan)

#[tauri::command]
fn keadaan(app: AppHandle) -> KeadaanTampil {
    keadaan_tampil(&app)
}

#[tauri::command]
async fn mulai_sambung(app: AppHandle) -> Result<(), String> {
    let klien = apl_ref(&app).klien.clone();
    {
        let mut k = kunci_k(&app);
        k.galat_sambung = None;
        k.sambung = None;
    }
    let j = match klien.minta_kode(&simpan::nama_pc()).await {
        Ok(j) => j,
        Err(g) => {
            kunci_k(&app).galat_sambung = Some(g.pesan().map(String::from).unwrap_or_default());
            kabari(&app);
            return Err(String::new());
        }
    };
    {
        let mut k = kunci_k(&app);
        k.sambung = Some(Sambung { kode: j.kode.clone(), tautan: j.tautan.clone() });
    }
    kabari(&app);
    let _ = app.opener().open_url(&j.tautan, None::<&str>);
    let h = app.clone();
    tauri::async_runtime::spawn(async move { tunggu_persetujuan(h, j.kode, j.rahasia).await });
    Ok(())
}

/// Polling 2 detik sampai pengguna menekan Sambungkan di browser (kode berlaku 10 menit).
async fn tunggu_persetujuan(app: AppHandle, kode: String, rahasia: String) {
    let klien = apl_ref(&app).klien.clone();
    loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        if kunci_k(&app).sambung.as_ref().is_none_or(|s| s.kode != kode) {
            return;
        }
        match klien.ambil_kode(&kode, &rahasia).await {
            Ok(HasilAmbil::Menunggu) | Err(Galat::Jaringan) => {}
            Ok(HasilAmbil::Tersambung { token, .. }) => {
                simpan::simpan_token(&token);
                let bahasa = {
                    let mut k = kunci_k(&app);
                    k.token = Some(token);
                    k.sambung = None;
                    k.bahasa.clone()
                };
                let _ = app.notification().builder().title(t(&bahasa, "pc.notif.tersambungJudul")).body(t(&bahasa, "pc.notif.tersambungIsi")).show();
                kabari(&app);
                return;
            }
            Ok(HasilAmbil::Kedaluwarsa) | Err(_) => {
                let mut k = kunci_k(&app);
                k.sambung = None;
                k.galat_sambung = Some("kodeHabis".into());
                drop(k);
                kabari(&app);
                return;
            }
        }
    }
}

#[tauri::command]
fn batal_sambung(app: AppHandle) {
    kunci_k(&app).sambung = None;
    kabari(&app);
}

#[tauri::command]
fn buka_tautan_sambung(app: AppHandle) {
    let tautan = kunci_k(&app).sambung.as_ref().map(|s| s.tautan.clone());
    if let Some(u) = tautan {
        let _ = app.opener().open_url(&u, None::<&str>);
    }
}

fn berkas_bunyi(app: &AppHandle, id: &str) -> PathBuf {
    let id = if BUNYI.contains(&id) { id } else { "klasik" };
    app.path().resolve(format!("bunyi/{id}.wav"), BaseDirectory::Resource).unwrap_or_default()
}

#[tauri::command]
fn tes_bunyi(app: AppHandle) {
    if kunci_k(&app).mesin.berbunyi() {
        return;
    }
    apl_ref(&app).pemutar.tes(berkas_bunyi(&app, "klasik"), Duration::from_secs(5));
}

#[tauri::command]
fn jawab_dengar(app: AppHandle, ya: bool) {
    kunci_k(&app).dengar = Some(ya);
    kabari(&app);
}

#[tauri::command]
fn nyalakan_autostart(app: AppHandle) {
    let _ = app.autolaunch().enable();
    kabari(&app);
}

#[tauri::command]
fn perbaiki_tutup(app: AppHandle) {
    let ok = sistem::perbaiki_tutup();
    let a = sistem::aksi_tutup();
    let mut k = kunci_k(&app);
    k.tutup = a;
    k.tutup_gagal = !ok || a.is_some_and(|x| x.perlu_diperbaiki());
    drop(k);
    kabari(&app);
}

fn boleh_keluar(app: &AppHandle) -> bool {
    let (alasan, bahasa) = {
        let k = kunci_k(app);
        (alasan_terkunci(&k), k.bahasa.clone())
    };
    if let Some(a) = alasan {
        let isi = t(&bahasa, if a == "komitmen" { "pc.terkunci" } else { "pc.terkunciBerbunyi" });
        let _ = app.notification().builder().title(t(&bahasa, "pc.notif.terkunciJudul")).body(isi).show();
        jendela::tampilkan_utama(app);
        return false;
    }
    true
}

#[tauri::command]
fn putuskan(app: AppHandle) -> Result<(), String> {
    if !boleh_keluar(&app) {
        return Err(String::new());
    }
    putus(&app);
    Ok(())
}

/// Token dicabut (dari web) atau PC diputus: kembali ke layar Sambungkan.
fn putus(app: &AppHandle) {
    catat("putus sambung");
    simpan::hapus_token();
    let folder = apl_ref(app).folder.clone();
    let mut k = kunci_k(app);
    let berbunyi = k.mesin.berbunyi();
    k.token = None;
    k.mesin = Mesin::baru();
    k.daring = false;
    k.layar = None;
    k.luring = None;
    if let Some(_p) = k.penjaga.take() {
        penjaga::hentikan_penjaga(&folder);
    }
    drop(k);
    if berbunyi {
        apl_ref(app).pemutar.henti();
    }
    jendela::tutup_alarm(app);
    jendela::tampilkan_utama(app);
    kabari(app);
}

#[tauri::command]
fn keluar(app: AppHandle) -> Result<(), String> {
    if !boleh_keluar(&app) {
        return Err(String::new());
    }
    let folder = apl_ref(&app).folder.clone();
    penjaga::tandai_keluar_sah(&folder);
    penjaga::hentikan_penjaga(&folder);
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn layar_alarm(app: AppHandle) -> AlarmTampil {
    let k = kunci_k(&app);
    AlarmTampil { layar: k.layar.clone(), daring: k.daring, nama: k.nama.clone(), bahasa: k.bahasa.clone(), omelan: k.omelan.clone() }
}

/// Soal dari server untuk jendela alarm. Hanya jalur soal kejadian (token tidak sampai ke WebView).
#[tauri::command]
async fn api_alarm(app: AppHandle, metode: String, jalur: String, isi: Option<Value>) -> Result<Value, String> {
    if !jalur_jendela_sah(&metode, &jalur) {
        return Err("ditolak".into());
    }
    let token = kunci_k(&app).token.clone().ok_or_else(|| "jaringan".to_string())?;
    match apl_ref(&app).klien.api(&token, &metode, &jalur, isi).await {
        Ok((status, v)) => {
            // Soal terjawab atau ditunda: baca ulang jadwal supaya bunyi berhenti walau SSE terlambat.
            if jalur.ends_with("/jawab") && matches!(v.get("hasil").and_then(Value::as_str), Some("selesai" | "ditunda")) {
                let h = app.clone();
                tauri::async_runtime::spawn(async move { tarik_jadwal(h).await });
            }
            Ok(serde_json::json!({ "status": status, "isi": v }))
        }
        Err(Galat::TokenTidakBerlaku) => {
            putus(&app);
            Err("token".into())
        }
        Err(_) => Err("jaringan".into()),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoalLuringTampil {
    teks: String,
    target: u32,
    benar_beruntun: u32,
}

fn soal_luring_sekarang(s: &SesiLuring) -> SoalLuringTampil {
    let soal = soal_luring(&s.kunci, s.jawaban.len() as u32, s.keadaan.tingkat);
    SoalLuringTampil { teks: soal.teks, target: s.target, benar_beruntun: s.keadaan.benar_beruntun }
}

/// Soal hitungan luring (PRD D8): benih dari kunci kejadian, server memeriksa ulang jawabannya.
#[tauri::command]
fn soal_luring_alarm(app: AppHandle) -> Option<SoalLuringTampil> {
    let mut k = kunci_k(&app);
    let d = k.mesin.dering.clone()?;
    let item = k.mesin.jadwal.iter().find(|i| i.kunci == d.kunci).cloned()?;
    if k.luring.as_ref().is_none_or(|s| s.kunci != d.kunci) {
        let tingkat = Tingkat::dari_teks(&item.soal.tingkat).unwrap_or(Tingkat::Sedang);
        k.luring = Some(SesiLuring {
            kunci: d.kunci,
            target: item.soal.benar.max(1),
            keadaan: KeadaanUrutan { tingkat, benar_beruntun: 0, salah_beruntun: 0 },
            jawaban: Vec::new(),
        });
    }
    k.luring.as_ref().map(soal_luring_sekarang)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HasilLuringTampil {
    benar: bool,
    lolos: bool,
    soal: Option<SoalLuringTampil>,
}

#[tauri::command]
fn jawab_luring(app: AppHandle, jawaban: String) -> Option<HasilLuringTampil> {
    let jawaban: String = jawaban.chars().take(12).collect();
    let mut k = kunci_k(&app);
    let s = k.luring.as_mut()?;
    let soal = soal_luring(&s.kunci, s.jawaban.len() as u32, s.keadaan.tingkat);
    let benar = jawaban_benar(&soal, &jawaban);
    s.jawaban.push(jawaban);
    s.keadaan = sesudah_jawab(s.keadaan, benar);
    if s.keadaan.benar_beruntun < s.target && s.jawaban.len() < 200 {
        let berikut = soal_luring_sekarang(s);
        return Some(HasilLuringTampil { benar, lolos: false, soal: Some(berikut) });
    }
    let jawaban = s.jawaban.clone();
    k.luring = None;
    let (d, tindakan) = k.mesin.luring_lolos()?;
    k.antrean.push(KirimLuring { kunci: d.kunci, kejadian_id: d.kejadian_id, jawaban });
    simpan::simpan_antrean(&apl_ref(&app).folder, &k.antrean);
    drop(k);
    laksanakan(&app, vec![tindakan]);
    let h = app.clone();
    tauri::async_runtime::spawn(async move { kirim_antrean(h).await });
    Some(HasilLuringTampil { benar, lolos: true, soal: None })
}

/// "Oke" di layar Selamat pagi / ditunda / selesai di perangkat lain.
#[tauri::command]
fn tutup_alarm(app: AppHandle) -> Result<(), String> {
    let mut k = kunci_k(&app);
    if k.mesin.berbunyi() || matches!(k.layar, Some(Layar::Cek { .. })) {
        return Err(String::new());
    }
    k.layar = None;
    drop(k);
    jendela::tutup_alarm(&app);
    Ok(())
}

// ------------------------------------------------------------------ tindakan mesin

fn rencana_suara(app: &AppHandle, i: &ItemJadwal, bahasa: &str, sekarang: i64) -> Rencana {
    let folder = simpan::folder_klip(&apl_ref(app).folder);
    let omelan = i
        .omelan
        .iter()
        .map(|o| OmelanPutar {
            jenis: o.jenis.clone(),
            menit: o.menit,
            teks: o.teks.clone(),
            klip: o.klip.as_deref().and_then(nama_berkas).map(|n| folder.join(n)).filter(|p| p.exists()),
        })
        .collect();
    let mulai = saat_bunyi(i).unwrap_or(sekarang);
    Rencana {
        bunyi: berkas_bunyi(app, &i.bunyi),
        naik_dtk: naik_dtk(&i.bunyi),
        omelan,
        benih: benih_kejadian(i.kejadian_id.as_deref().unwrap_or(&i.kunci)),
        sudah_ms: (sekarang - mulai).clamp(0, 6 * 3_600_000) as u64,
        bahasa: bahasa.to_string(),
    }
}

fn laksanakan(app: &AppHandle, tindakan: Vec<Tindakan>) {
    let mut tarik = false;
    for x in tindakan {
        match x {
            Tindakan::Bunyikan(item, sumber) => {
                catat(&format!("berbunyi {} sumber={sumber:?} omelan={}", item.kunci, item.omelan.len()));
                let (bahasa, sekarang) = {
                    let k = kunci_k(app);
                    (k.bahasa.clone(), k.sekarang())
                };
                let r = rencana_suara(app, &item, &bahasa, sekarang);
                {
                    let mut k = kunci_k(app);
                    k.layar =
                        Some(Layar::Berbunyi { item: item_tampil(&item, &bahasa), kejadian_id: item.kejadian_id.clone(), lokal: sumber == Sumber::Lokal });
                    k.luring = None;
                }
                apl_ref(app).pemutar.mulai(r);
                atur_daya(app);
                let h = app.clone();
                let _ = app.run_on_main_thread(move || jendela::buka_alarm(&h));
                kabari_alarm(app);
            }
            Tindakan::KenaliKejadian(id) => {
                let mut k = kunci_k(app);
                if let Some(Layar::Berbunyi { kejadian_id, lokal, .. }) = k.layar.as_mut() {
                    *kejadian_id = Some(id);
                    *lokal = false;
                }
                drop(k);
                kabari_alarm(app);
            }
            Tindakan::Hentikan(alasan) => {
                catat(&format!("berhenti {alasan:?}"));
                apl_ref(app).pemutar.henti();
                let mut k = kunci_k(app);
                let bahasa = k.bahasa.clone();
                let lagi = k.layar.as_ref().and_then(|l| match l {
                    Layar::Berbunyi { item, .. } => k.mesin.jadwal.iter().find(|i| i.kunci == item.kunci).and_then(|i| i.tunda_sampai),
                    _ => None,
                });
                if let Some(Layar::Berbunyi { item, .. }) = k.layar.clone() {
                    let alasan = match alasan {
                        AlasanHenti::Selesai => "selesai",
                        AlasanHenti::Ditunda => "ditunda",
                        AlasanHenti::Cek => "cek",
                        AlasanHenti::LuringLolos => "luring",
                    };
                    let lagi = lagi.and_then(|t| jam_lokal(t, &bahasa));
                    k.layar = Some(Layar::Selesai { item, alasan: alasan.into(), lagi });
                }
                k.luring = None;
                k.omelan = None;
                drop(k);
                atur_daya(app);
                let h = app.clone();
                let _ = app.run_on_main_thread(move || jendela::lepas_alarm(&h));
                kabari_alarm(app);
                kabari(app);
            }
            Tindakan::TanyaMasihBangun(item) => {
                catat(&format!("masih bangun {}", item.kunci));
                {
                    let mut k = kunci_k(app);
                    let bahasa = k.bahasa.clone();
                    k.layar = Some(Layar::Cek { item: item_tampil(&item, &bahasa), kejadian_id: item.kejadian_id.clone() });
                }
                let h = app.clone();
                let _ = app.run_on_main_thread(move || jendela::buka_alarm(&h));
                kabari_alarm(app);
            }
            Tindakan::TutupMasihBangun => {
                let mut k = kunci_k(app);
                if matches!(k.layar, Some(Layar::Cek { .. })) {
                    k.layar = None;
                    drop(k);
                    let h = app.clone();
                    let _ = app.run_on_main_thread(move || jendela::tutup_alarm(&h));
                }
            }
            Tindakan::TarikJadwal => tarik = true,
        }
    }
    if tarik {
        let h = app.clone();
        tauri::async_runtime::spawn(async move { tarik_jadwal(h).await });
    }
}

/// Jam lokal PC ("05.05") untuk pesan "berbunyi lagi" sesudah tunda.
fn jam_lokal(t: time::OffsetDateTime, bahasa: &str) -> Option<String> {
    let o = time::UtcOffset::current_local_offset().unwrap_or(time::UtcOffset::UTC);
    let l = t.to_offset(o);
    Some(jam_tampil(&format!("{:02}:{:02}", l.hour(), l.minute()), bahasa))
}

fn atur_daya(app: &AppHandle) {
    let mut k = kunci_k(app);
    let berbunyi = k.mesin.berbunyi();
    let baru = KeadaanDaya { siaga: berbunyi || sedang_siaga(&k.mesin.jadwal, k.sekarang()), berbunyi };
    if baru != k.daya {
        k.daya = baru;
        drop(k);
        apl_ref(app).daya.atur(baru);
    }
}

// ------------------------------------------------------------------ server

async fn tarik_jadwal(app: AppHandle) {
    let (token, generasi) = {
        let k = kunci_k(&app);
        (k.token.clone(), k.mesin.generasi())
    };
    let Some(token) = token else { return };
    match apl_ref(&app).klien.jadwal(&token).await {
        Ok(j) => {
            let tindakan = {
                let mut k = kunci_k(&app);
                k.selisih_ms = (j.waktu_server.unix_timestamp_nanos() / 1_000_000) as i64 - sekarang_lokal();
                if !j.nama.is_empty() {
                    k.nama = j.nama.clone();
                }
                k.bahasa = if j.bahasa == "en" { "en".into() } else { "id".into() };
                k.jadwal_pada = Some(k.sekarang());
                let s = k.sekarang();
                k.mesin.jadwal_baru(j.kejadian, s, generasi)
            };
            laksanakan(&app, tindakan);
            segarkan_layar(&app);
            atur_daya(&app);
            kabari(&app);
            sinkron_klip(&app, &token).await;
        }
        Err(Galat::TokenTidakBerlaku) => putus(&app),
        Err(_) => {}
    }
}

/// Layar Selamat pagi memakai data terbaru (mis. kapan "Masih bangun?" muncul).
fn segarkan_layar(app: &AppHandle) {
    let mut k = kunci_k(app);
    let bahasa = k.bahasa.clone();
    let segar = match &k.layar {
        Some(Layar::Selesai { item, .. }) => k.mesin.jadwal.iter().find(|i| i.kunci == item.kunci).map(|i| item_tampil(i, &bahasa)),
        _ => None,
    };
    if let (Some(baru), Some(Layar::Selesai { item, .. })) = (segar, k.layar.as_mut()) {
        if baru.cek_pada != item.cek_pada {
            *item = baru;
            drop(k);
            kabari_alarm(app);
        }
    }
}

/// Klip omelan 24 jam ke depan diunduh sebelum malam; yang tidak dipakai 7 hari dibuang.
async fn sinkron_klip(app: &AppHandle, token: &str) {
    let folder = simpan::folder_klip(&apl_ref(app).folder);
    let _ = std::fs::create_dir_all(&folder);
    let perlu = kebutuhan_berkas(&kunci_k(app).mesin.jadwal).0;
    let ada: Vec<BerkasKlip> = std::fs::read_dir(&folder)
        .map(|d| {
            d.filter_map(Result::ok)
                .filter_map(|e| {
                    let umur = e.metadata().ok()?.modified().ok()?.elapsed().map(|d| d.as_secs()).unwrap_or(0);
                    Some(BerkasKlip { nama: e.file_name().to_string_lossy().into_owned(), umur_detik: umur })
                })
                .collect()
        })
        .unwrap_or_default();
    let r = rencanakan(&ada, &perlu);
    for n in &r.buang {
        let _ = std::fs::remove_file(folder.join(n));
    }
    for n in &r.sentuh {
        if let Ok(f) = std::fs::File::options().write(true).open(folder.join(n)) {
            let _ = f.set_modified(SystemTime::now());
        }
    }
    let mut lengkap = true;
    for h in &r.unduh {
        let Some(nama) = nama_berkas(h) else { continue };
        match apl_ref(app).klien.klip(token, h).await {
            Ok(b) => {
                let sementara = folder.join(format!("{h}.sementara"));
                if std::fs::write(&sementara, &b).is_err() || std::fs::rename(&sementara, folder.join(nama)).is_err() {
                    lengkap = false;
                }
            }
            Err(_) => lengkap = false,
        }
    }
    kunci_k(app).klip_siap = lengkap;
}

async fn kirim_antrean(app: AppHandle) {
    let (token, antrean) = {
        let k = kunci_k(&app);
        (k.token.clone(), k.antrean.clone())
    };
    let Some(token) = token else { return };
    let mut sisa = Vec::new();
    for mut a in antrean {
        if a.kejadian_id.is_none() {
            a.kejadian_id = kunci_k(&app).mesin.id_untuk(&a.kunci);
        }
        let Some(id) = a.kejadian_id.clone() else {
            sisa.push(a);
            continue;
        };
        match apl_ref(&app).klien.luring(&token, &id, &a.jawaban).await {
            // Diterima (atau ditolak karena sudah tidak berlaku): tidak dikirim lagi.
            Ok(_) | Err(Galat::Server { .. }) => {}
            Err(Galat::TokenTidakBerlaku) => return putus(&app),
            Err(Galat::Jaringan) => sisa.push(a),
        }
    }
    {
        let mut k = kunci_k(&app);
        k.antrean = sisa;
        simpan::simpan_antrean(&apl_ref(&app).folder, &k.antrean);
    }
    tarik_jadwal(app).await;
}

async fn proses_peristiwa(app: &AppHandle, e: Peristiwa) {
    match e.nama.as_str() {
        "halo" => {}
        "cabut" => putus(app),
        nama => {
            let d = data_peristiwa(&e);
            let tindakan = {
                let mut k = kunci_k(app);
                let s = k.sekarang();
                k.mesin.peristiwa(nama, d.k.as_deref(), s)
            };
            laksanakan(app, tindakan);
        }
    }
}

/// SSE: selama tersambung, satu aliran terbuka; putus = sambung ulang dengan jeda bertambah.
async fn putaran_daring(app: AppHandle) {
    let mut jeda = 1_000u64;
    loop {
        let token = kunci_k(&app).token.clone();
        let Some(token) = token else {
            tokio::time::sleep(Duration::from_secs(1)).await;
            continue;
        };
        match apl_ref(&app).klien.peristiwa(&token).await {
            Ok(mut aliran) => {
                catat("sse tersambung");
                kunci_k(&app).daring = true;
                kabari(&app);
                kabari_alarm(&app);
                jeda = 1_000;
                tarik_jadwal(app.clone()).await;
                kirim_antrean(app.clone()).await;
                while let Some(e) = aliran.berikut().await {
                    proses_peristiwa(&app, e).await;
                    if kunci_k(&app).token.is_none() {
                        break;
                    }
                }
                if let Some(ms) = aliran.jeda_ulang_ms() {
                    jeda = ms.clamp(1_000, 30_000);
                }
            }
            Err(Galat::TokenTidakBerlaku) => putus(&app),
            Err(_) => {}
        }
        if std::mem::replace(&mut kunci_k(&app).daring, false) {
            catat("sse putus");
            kabari(&app);
            kabari_alarm(&app);
        }
        tokio::time::sleep(Duration::from_millis(jeda)).await;
        jeda = (jeda * 2).min(30_000);
    }
}

async fn detak(app: AppHandle) {
    let (token, d) = {
        let k = kunci_k(&app);
        let siap = k.klip_siap.then(|| k.jadwal_pada.map(|t| t + 24 * 3_600_000)).flatten();
        let siap = siap
            .and_then(|t| time::OffsetDateTime::from_unix_timestamp_nanos(t as i128 * 1_000_000).ok())
            .and_then(|t| t.format(&time::format_description::well_known::Rfc3339).ok());
        let kemampuan = Kemampuan { dicas: k.status_daya.dicas, baterai: k.status_daya.baterai, suara: Some(suara::ada_keluaran()), layar_menyala: None };
        (k.token.clone(), Detak { versi: VERSI.into(), kemampuan, siap_sampai: siap })
    };
    let Some(token) = token else { return };
    if let Err(Galat::TokenTidakBerlaku) = apl_ref(&app).klien.detak(&token, &d).await {
        putus(&app);
    }
}

fn perbarui_baki(app: &AppHandle) {
    let teks = {
        let k = kunci_k(app);
        let b = &k.bahasa;
        if k.token.is_none() {
            t(b, "pc.baki.belum")
        } else if !k.daring {
            t(b, "pc.baki.putus")
        } else if let Some(i) = alarm_berikutnya(&k.mesin.jadwal, k.sekarang()) {
            isi(t(b, "pc.baki.siaga"), "jam", &jam_tampil(&i.jam, b))
        } else {
            t(b, "pc.baki.tanpaAlarm")
        }
    };
    let mut k = kunci_k(app);
    if k.teks_baki != teks {
        k.teks_baki = teks.clone();
        drop(k);
        if let Some(m) = apl_ref(app).baki.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
            let _ = m.set_text(teks);
        }
    }
}

/// Tiap detik: pengatur waktu lokal, kunci jendela alarm, daya, penjaga, baki.
async fn putaran_detik(app: AppHandle) {
    let mut n: u64 = 0;
    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
        n += 1;
        let tindakan = {
            let mut k = kunci_k(&app);
            if k.token.is_none() {
                Vec::new()
            } else {
                let s = k.sekarang();
                k.mesin.detik(s)
            }
        };
        laksanakan(&app, tindakan);
        atur_daya(&app);
        let (berbunyi, cek, siaga, punya_token, penjaga_pid) = {
            let k = kunci_k(&app);
            (k.mesin.berbunyi(), matches!(k.layar, Some(Layar::Cek { .. })), k.daya.siaga, k.token.is_some(), k.penjaga)
        };
        if berbunyi || cek {
            let h = app.clone();
            let _ = app.run_on_main_thread(move || {
                if jendela::ada_alarm(&h) {
                    jendela::kunci_alarm(&h);
                } else {
                    jendela::buka_alarm(&h);
                }
            });
        }
        // Penjaga hanya hidup selama siaga.
        let folder = apl_ref(&app).folder.clone();
        if siaga && punya_token && penjaga_pid.is_none_or(|p| !penjaga::hidup(p)) {
            kunci_k(&app).penjaga = penjaga::nyalakan_penjaga(&folder);
        } else if !siaga && penjaga_pid.is_some() {
            penjaga::hentikan_penjaga(&folder);
            kunci_k(&app).penjaga = None;
        }
        if n % 30 == 1 {
            tauri::async_runtime::spawn(detak(app.clone()));
            let s = sistem::status_daya();
            let mut k = kunci_k(&app);
            k.status_daya = s;
            // PC belum dicas saat siaga dimulai: kabari sekali per malam.
            if siaga && s.dicas == Some(false) && !k.notif_dicas {
                k.notif_dicas = true;
                let jam = alarm_berikutnya(&k.mesin.jadwal, k.sekarang()).map(|i| jam_tampil(&i.jam, &k.bahasa)).unwrap_or_default();
                let b = k.bahasa.clone();
                drop(k);
                let _ = app.notification().builder().title(t(&b, "pc.notif.belumDicasJudul")).body(isi(t(&b, "pc.notif.belumDicasIsi"), "jam", &jam)).show();
            } else if !siaga {
                k.notif_dicas = false;
            }
        }
        if n % 300 == 0 {
            tauri::async_runtime::spawn(tarik_jadwal(app.clone()));
            tauri::async_runtime::spawn(kirim_antrean(app.clone()));
        }
        if n % 600 == 2 {
            let a = sistem::aksi_tutup();
            kunci_k(&app).tutup = a;
        }
        perbarui_baki(&app);
    }
}

/// Pembaruan otomatis bertanda tangan (docs/09 §8): saat mulai dan sehari sekali, tidak pernah
/// saat berbunyi atau kurang dari 1 jam sebelum alarm. Aktif sesudah kunci publik diisi (L3).
async fn putaran_pembaruan(app: AppHandle) {
    let kunci = app.config().plugins.0.get("updater").and_then(|u| u.get("pubkey")).and_then(Value::as_str).unwrap_or_default().to_string();
    if kunci.is_empty() {
        return;
    }
    tokio::time::sleep(Duration::from_secs(60)).await;
    loop {
        let boleh = {
            let k = kunci_k(&app);
            boleh_perbarui(&k.mesin.jadwal, k.sekarang(), k.mesin.berbunyi())
        };
        if let (true, Ok(p)) = (boleh, app.updater()) {
            if let Ok(Some(u)) = p.check().await {
                let folder = apl_ref(&app).folder.clone();
                penjaga::tandai_keluar_sah(&folder);
                penjaga::hentikan_penjaga(&folder);
                if u.download_and_install(|_, _| {}, || {}).await.is_ok() {
                    app.restart();
                }
                penjaga::hapus_tanda_keluar(&folder);
            }
        }
        tokio::time::sleep(Duration::from_secs(24 * 3600)).await;
    }
}

// ------------------------------------------------------------------ mulai

fn pasang_baki(app: &AppHandle, bahasa: &str) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "status", t(bahasa, "pc.baki.belum"), false, None::<&str>)?;
    let buka = MenuItem::with_id(app, "buka", t(bahasa, "pc.baki.buka"), true, None::<&str>)?;
    let tes = MenuItem::with_id(app, "tes", t(bahasa, "pc.baki.tes"), true, None::<&str>)?;
    let keluar_ = MenuItem::with_id(app, "keluar", t(bahasa, "pc.baki.keluar"), true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&status, &PredefinedMenuItem::separator(app)?, &buka, &tes, &PredefinedMenuItem::separator(app)?, &keluar_])?;
    let mut b = TrayIconBuilder::with_id("baki")
        .tooltip("AntiKebo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id().as_ref() {
            "buka" => jendela::tampilkan_utama(app),
            "tes" => tes_bunyi(app.clone()),
            "keluar" => {
                let _ = keluar(app.clone());
            }
            _ => {}
        })
        .on_tray_icon_event(|baki, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                jendela::tampilkan_utama(baki.app_handle());
            }
        });
    if let Some(ikon) = app.default_window_icon() {
        b = b.icon(ikon.clone());
    }
    b.build(app)?;
    *apl_ref(app).baki.lock().unwrap_or_else(|e| e.into_inner()) = Some(status);
    Ok(())
}

pub fn jalankan(diam: bool) {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| jendela::tampilkan_utama(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--diam"])))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let h = app.handle().clone();
            let folder = h.path().app_local_data_dir()?;
            std::fs::create_dir_all(&folder)?;
            crate::catat::pasang(&folder);
            catat(&format!("mulai versi {VERSI} diam={diam}"));
            penjaga::hapus_tanda_keluar(&folder);
            let token = simpan::baca_token();
            let pertama = !folder.join("pertama").exists();
            let mut k =
                Keadaan { bahasa: bahasa_sistem(), antrean: simpan::baca_antrean(&folder), token, status_daya: sistem::status_daya(), ..Default::default() };
            k.tutup = sistem::aksi_tutup();
            let h2 = h.clone();
            let pemutar = Pemutar::nyalakan(Box::new(move |teks| {
                if let Some(a) = h2.try_state::<Aplikasi>() {
                    a.k.lock().unwrap_or_else(|e| e.into_inner()).omelan = teks.clone();
                }
                let _ = h2.emit("omelan", teks);
            }));
            let bahasa = k.bahasa.clone();
            let tersambung = k.token.is_some();
            app.manage(Aplikasi { k: Mutex::new(k), klien: Klien::baru(), pemutar, daya: Daya::nyalakan(), folder: folder.clone(), baki: Mutex::new(None) });
            // Pertama jalan: menyala saat Windows hidup (docs/09 §7).
            if pertama {
                let _ = h.autolaunch().enable();
                let _ = std::fs::write(folder.join("pertama"), b"1");
            }
            // Baki gagal (mis. tanpa area notifikasi) tidak boleh mematikan alarm.
            if let Err(e) = pasang_baki(&h, &bahasa) {
                catat(&format!("baki gagal: {e}"));
            }
            if !diam || !tersambung {
                jendela::tampilkan_utama(&h);
            }
            tauri::async_runtime::spawn(putaran_daring(h.clone()));
            tauri::async_runtime::spawn(putaran_detik(h.clone()));
            tauri::async_runtime::spawn(putaran_pembaruan(h));
            Ok(())
        })
        .on_window_event(jendela::peristiwa_jendela)
        .invoke_handler(tauri::generate_handler![
            keadaan,
            mulai_sambung,
            batal_sambung,
            buka_tautan_sambung,
            tes_bunyi,
            jawab_dengar,
            nyalakan_autostart,
            perbaiki_tutup,
            putuskan,
            keluar,
            layar_alarm,
            api_alarm,
            soal_luring_alarm,
            jawab_luring,
            tutup_alarm
        ])
        .build(tauri::generate_context!())
        .expect("AntiKebo gagal dimulai")
        .run(|_app, e| {
            // Jendela terakhir ditutup = tetap hidup di baki. Keluar hanya lewat `keluar`.
            if let RunEvent::ExitRequested { code: None, api, .. } = e {
                api.prevent_exit();
            }
        });
}
