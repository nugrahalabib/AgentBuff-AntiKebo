//! Salinan jadwal (`tests/emas/jadwal-perangkat.json`, bentuknya dijaga tes TypeScript) dan aturan
//! siaga, tombol Keluar, pembaruan, pengatur waktu lokal.

use antikebo_inti::jadwal::*;
use std::path::PathBuf;
use time::macros::datetime;
use time::OffsetDateTime;

fn contoh() -> JawabanJadwal {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/emas/jadwal-perangkat.json");
    serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap()
}

fn ms(t: OffsetDateTime) -> i64 {
    (t.unix_timestamp_nanos() / 1_000_000) as i64
}

#[test]
fn baca_bentuk_server() {
    let j = contoh();
    assert_eq!((j.nama.as_str(), j.bahasa.as_str()), ("Nugi", "id"));
    assert_eq!(j.kejadian.len(), 2);
    let a = &j.kejadian[0];
    assert_eq!(a.jadwal_utc, datetime!(2026-10-07 22:00 UTC));
    assert_eq!(a.kejadian_id.as_deref(), Some("7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5"));
    assert!(a.komitmen);
    assert_eq!(a.kunci_mulai, Some(datetime!(2026-10-07 15:00 UTC)));
    assert_eq!(a.omelan[2].menit, Some(3));
    assert_eq!(a.soal.benar, 2);
    let b = &j.kejadian[1];
    assert_eq!(b.kejadian_id, None);
    assert_eq!(b.kunci_mulai, None);
    let (klip, bunyi) = kebutuhan_berkas(&j.kejadian);
    assert_eq!(klip, vec!["9f2c1a0b3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8".to_string()]);
    assert_eq!(bunyi, vec!["klasik".to_string(), "naik".to_string()]);
}

#[test]
fn jagaan_lokal_tenggang_lima_detik_dan_tanda() {
    let j = contoh().kejadian;
    let t = ms(datetime!(2026-10-07 22:00 UTC));
    let g = jagaan_berikutnya(&j, t - 60_000, &[]).unwrap();
    assert_eq!(g.item.jam, "05:00");
    assert_eq!(g.pada, t + TENGGANG_LOKAL_MS);
    let sudah = vec![tanda(&j[0]).unwrap()];
    assert_eq!(jagaan_berikutnya(&j, t + 6_000, &sudah).unwrap().item.jam, "13:00");
    // Terlambat lebih dari 30 menit: tidak dibunyikan lagi.
    assert_eq!(jagaan_berikutnya(&j[..1], t + BATAS_TERLAMBAT_MS + 1, &[]), None);
    // Ditunda: berbunyi lagi pada saat tunda (tanda baru).
    let mut d = j[0].clone();
    d.status = "ditunda".into();
    d.tunda_sampai = Some(datetime!(2026-10-07 22:05 UTC));
    assert_ne!(tanda(&d), tanda(&j[0]));
    assert_eq!(jagaan_berikutnya(std::slice::from_ref(&d), t + 60_000, &sudah).unwrap().pada, t + 300_000 + TENGGANG_LOKAL_MS);
}

#[test]
fn siaga_keluar_terkunci_pembaruan() {
    let j = contoh().kejadian;
    let alarm = ms(datetime!(2026-10-07 22:00 UTC));
    // Siaga mulai 14.00 UTC (21.00 WIB), Komitmen mengunci Keluar mulai 15.00 UTC (jam tidur 22.00 WIB).
    assert!(!sedang_siaga(&j, ms(datetime!(2026-10-07 13:59 UTC))));
    assert!(sedang_siaga(&j, ms(datetime!(2026-10-07 14:00 UTC))));
    assert!(!keluar_terkunci(&j, ms(datetime!(2026-10-07 14:30 UTC))));
    assert!(keluar_terkunci(&j, ms(datetime!(2026-10-07 15:00 UTC))));
    assert!(keluar_terkunci(&j, alarm + 60_000));
    // Tanpa Komitmen: Keluar bebas, kecuali alarm sedang berbunyi.
    let mut tanpa = j.clone();
    tanpa[0].komitmen = false;
    assert!(!keluar_terkunci(&tanpa, ms(datetime!(2026-10-07 21:00 UTC))));
    tanpa[0].status = "berbunyi".into();
    assert!(keluar_terkunci(&tanpa, alarm + 1000));
    // Pembaruan: tidak saat berbunyi, tidak kurang dari 1 jam sebelum alarm.
    assert!(boleh_perbarui(&j, alarm - 2 * 3_600_000, false));
    assert!(!boleh_perbarui(&j, alarm - 3_599_000, false));
    assert!(!boleh_perbarui(&j, alarm - 2 * 3_600_000, true));
    assert!(!boleh_perbarui(&tanpa, alarm + 1000, false));
}

#[test]
fn benih_kejadian_sama_dengan_server() {
    // FNV-1a 32 bit (`benihDari` di src/lib/layanan/kejadian.ts): nilai acuan dihitung terpisah.
    assert_eq!(benih_kejadian(""), 2_166_136_261);
    assert_eq!(benih_kejadian("a"), 0xe40c_292c);
    assert_eq!(benih_kejadian("foobar"), 0xbf9c_f968);
}

#[test]
fn bunyi_naik_perlahan() {
    assert_eq!(penguat_naik(0, naik_dtk("naik")), 0.1);
    assert!((penguat_naik(30_000, naik_dtk("naik")) - 0.55).abs() < 1e-6);
    assert_eq!(penguat_naik(90_000, naik_dtk("naik")), 1.0);
    assert_eq!(penguat_naik(0, naik_dtk("klasik")), 1.0);
}
