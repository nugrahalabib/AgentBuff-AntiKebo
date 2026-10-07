//! Mesin alarm PC (docs/09 §6): server lebih dulu atau jadwal lokal sesudah tenggang, tidak
//! dobel, berhenti hanya oleh server atau soal luring, tahan dinyalakan ulang.

use antikebo_inti::alarm::{AlasanHenti, Mesin, Sumber, Tindakan};
use antikebo_inti::jadwal::{ItemJadwal, JawabanJadwal, TENGGANG_LOKAL_MS};
use std::path::PathBuf;
use time::macros::datetime;
use time::OffsetDateTime;

fn contoh() -> Vec<ItemJadwal> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/emas/jadwal-perangkat.json");
    serde_json::from_str::<JawabanJadwal>(&std::fs::read_to_string(p).unwrap()).unwrap().kejadian
}

fn ms(t: OffsetDateTime) -> i64 {
    (t.unix_timestamp_nanos() / 1_000_000) as i64
}

const ID: &str = "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5";

fn t0() -> i64 {
    ms(datetime!(2026-10-07 22:00 UTC))
}

fn dengan(status: &str) -> Vec<ItemJadwal> {
    let mut j = contoh();
    j[0].status = status.into();
    j
}

fn bunyi(t: &[Tindakan]) -> Vec<Sumber> {
    t.iter().filter_map(|x| if let Tindakan::Bunyikan(_, s) = x { Some(*s) } else { None }).collect()
}

fn henti(t: &[Tindakan]) -> Vec<AlasanHenti> {
    t.iter().filter_map(|x| if let Tindakan::Hentikan(a) = x { Some(*a) } else { None }).collect()
}

#[test]
fn server_lebih_dulu_tanpa_dobel_lalu_berhenti() {
    let mut m = Mesin::baru();
    assert!(m.jadwal_baru(contoh(), t0() - 60_000, m.generasi()).is_empty());
    let t = m.peristiwa("berbunyi", Some(ID), t0() + 300);
    assert_eq!(bunyi(&t), vec![Sumber::Server]);
    assert!(t.contains(&Tindakan::TarikJadwal));
    // Jadwal lokal tidak membunyikan lagi kejadian yang sama.
    assert!(bunyi(&m.detik(t0() + TENGGANG_LOKAL_MS + 1)).is_empty());
    assert!(m.jadwal_baru(dengan("berbunyi"), t0() + 1_000, m.generasi()).is_empty());
    // Berhenti hanya dari server (soal terjawab di perangkat mana pun).
    assert!(henti(&m.peristiwa("berhenti", Some("id-lain"), t0() + 9_000)).is_empty());
    assert!(m.berbunyi());
    assert_eq!(henti(&m.peristiwa("berhenti", Some(ID), t0() + 10_000)), vec![AlasanHenti::Selesai]);
    assert!(!m.berbunyi());
}

#[test]
fn server_diam_pc_berbunyi_sendiri_lalu_soal_luring() {
    let mut m = Mesin::baru();
    m.jadwal_baru(contoh(), t0() - 60_000, m.generasi());
    assert!(bunyi(&m.detik(t0() + TENGGANG_LOKAL_MS - 1)).is_empty());
    assert_eq!(bunyi(&m.detik(t0() + TENGGANG_LOKAL_MS)), vec![Sumber::Lokal]);
    assert!(bunyi(&m.detik(t0() + 60_000)).is_empty());
    let (d, t) = m.luring_lolos().unwrap();
    assert_eq!(t, Tindakan::Hentikan(AlasanHenti::LuringLolos));
    assert_eq!(d.kejadian_id.as_deref(), Some(ID));
    // Server belum menerima jawaban luring (masih berbunyi): PC tidak berbunyi lagi.
    assert!(bunyi(&m.jadwal_baru(dengan("berbunyi"), t0() + 120_000, m.generasi())).is_empty());
    assert!(bunyi(&m.detik(t0() + 121_000)).is_empty());
    // Jawaban diterima: kejadian hilang dari jadwal aktif.
    let mut j = contoh();
    j.remove(0);
    assert!(bunyi(&m.jadwal_baru(j, t0() + 130_000, m.generasi())).is_empty());
}

#[test]
fn dering_lokal_dikenali_server_tanpa_bunyi_kedua() {
    let mut j = contoh();
    let t13 = ms(j[1].jadwal_utc);
    j.remove(0);
    let mut m = Mesin::baru();
    m.jadwal_baru(j.clone(), t13 - 60_000, m.generasi());
    assert_eq!(bunyi(&m.detik(t13 + TENGGANG_LOKAL_MS)), vec![Sumber::Lokal]);
    assert_eq!(m.dering.as_ref().unwrap().kejadian_id, None);
    j[0].status = "berbunyi".into();
    j[0].kejadian_id = Some("baru".into());
    let t = m.jadwal_baru(j, t13 + 7_000, m.generasi());
    assert_eq!(t, vec![Tindakan::KenaliKejadian("baru".into())]);
    assert!(m.berbunyi());
}

#[test]
fn dinyalakan_ulang_saat_berbunyi() {
    let mut m = Mesin::baru();
    assert_eq!(bunyi(&m.jadwal_baru(dengan("berbunyi"), t0() + 30_000, m.generasi())), vec![Sumber::Server]);
}

#[test]
fn ditunda_lalu_berbunyi_lagi() {
    let mut m = Mesin::baru();
    m.jadwal_baru(dengan("berbunyi"), t0() + 1_000, m.generasi());
    assert_eq!(henti(&m.peristiwa("tunda", Some(ID), t0() + 20_000)), vec![AlasanHenti::Ditunda]);
    let mut j = dengan("ditunda");
    j[0].tunda_sampai = Some(datetime!(2026-10-07 22:05 UTC));
    assert!(m.jadwal_baru(j.clone(), t0() + 21_000, m.generasi()).is_empty());
    let saat = t0() + 300_000;
    assert!(bunyi(&m.detik(saat + TENGGANG_LOKAL_MS - 1)).is_empty());
    assert_eq!(bunyi(&m.detik(saat + TENGGANG_LOKAL_MS)), vec![Sumber::Lokal]);
    // Server masih "ditunda" dengan saat yang sama: tetap berbunyi (bukan tunda baru).
    assert!(henti(&m.jadwal_baru(j, saat + 6_000, m.generasi())).is_empty());
    assert!(m.berbunyi());
}

#[test]
fn masih_bangun_tampil_pada_waktunya() {
    let mut m = Mesin::baru();
    m.jadwal_baru(dengan("berbunyi"), t0() + 1_000, m.generasi());
    assert_eq!(henti(&m.peristiwa("cek", Some(ID), t0() + 60_000)), vec![AlasanHenti::Cek]);
    let mut j = dengan("cek_bangun");
    j[0].cek_pada = Some(datetime!(2026-10-07 22:06 UTC));
    j[0].cek_batas = Some(datetime!(2026-10-07 22:07 UTC));
    let t = m.jadwal_baru(j, t0() + 61_000, m.generasi());
    assert!(t.is_empty(), "{t:?}");
    assert!(m.detik(t0() + 359_000).is_empty());
    let t = m.detik(t0() + 360_000);
    assert!(matches!(t.as_slice(), [Tindakan::TanyaMasihBangun(_)]), "{t:?}");
    assert!(m.detik(t0() + 361_000).is_empty());
    let t = m.peristiwa("berhenti", Some(ID), t0() + 365_000);
    assert!(t.contains(&Tindakan::TutupMasihBangun));
}

#[test]
fn jadwal_basi_diabaikan() {
    let mut m = Mesin::baru();
    m.jadwal_baru(dengan("berbunyi"), t0() + 1_000, m.generasi());
    let g = m.generasi();
    m.peristiwa("berhenti", Some(ID), t0() + 10_000);
    // Jawaban jadwal yang diminta sebelum "berhenti" masih menyebut berbunyi: diabaikan.
    assert!(m.jadwal_baru(dengan("berbunyi"), t0() + 10_100, g).is_empty());
    assert!(!m.berbunyi());
}

#[test]
fn selesai_di_perangkat_lain_saat_sse_putus() {
    let mut m = Mesin::baru();
    m.jadwal_baru(dengan("berbunyi"), t0() + 1_000, m.generasi());
    let mut j = contoh();
    j.remove(0);
    assert_eq!(henti(&m.jadwal_baru(j, t0() + 50_000, m.generasi())), vec![AlasanHenti::Selesai]);
}
