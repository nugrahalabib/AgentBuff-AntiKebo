//! Contoh emas yang SAMA dengan TypeScript (aturan teknis 9): `tests/emas/soal.json` dan
//! `tests/emas/urutan-suara.json` di akar repo. Lulus di sini = PC membuat soal, benih luring,
//! dan urutan omelan yang persis sama dengan server dan web.

use antikebo_inti::acak::Acak;
use antikebo_inti::soal::{
    self, buat_hitungan, buat_ingat, buat_ketik, jawaban_benar, periksa_luring, sesudah_jawab, soal_luring, HasilLuring, KeadaanUrutan, Tingkat,
};
use antikebo_inti::urutan::{berikutnya, KeadaanUrutan as KeadaanSuara, Waktu};
use serde::Deserialize;
use std::path::PathBuf;

fn emas(nama: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/emas").join(nama);
    std::fs::read_to_string(&p).unwrap_or_else(|e| panic!("{}: {e}", p.display()))
}

#[derive(Deserialize)]
struct EmasSoal {
    prng: Vec<Prng>,
    kasus: Vec<Kasus>,
    luring: Vec<Luring>,
}

#[derive(Deserialize)]
struct Prng {
    benih: u32,
    keluaran: Vec<u32>,
}

#[derive(Deserialize)]
struct Kasus {
    jenis: String,
    tingkat: String,
    benih: u32,
    teks: String,
    jawaban: String,
    #[serde(default)]
    sumber: Vec<String>,
}

#[derive(Deserialize)]
struct Luring {
    kunci: String,
    i: u32,
    benih: u32,
}

#[test]
fn mulberry32_sama() {
    let e: EmasSoal = serde_json::from_str(&emas("soal.json")).unwrap();
    assert!(!e.prng.is_empty());
    for p in e.prng {
        let mut r = Acak::baru(p.benih);
        let k: Vec<u32> = (0..p.keluaran.len()).map(|_| r.berikut()).collect();
        assert_eq!(k, p.keluaran, "benih {}", p.benih);
    }
}

#[test]
fn soal_sama_dengan_typescript() {
    let e: EmasSoal = serde_json::from_str(&emas("soal.json")).unwrap();
    assert!(e.kasus.len() >= 60, "contoh emas terlalu sedikit: {}", e.kasus.len());
    for k in e.kasus {
        let t = Tingkat::dari_teks(&k.tingkat).unwrap();
        let s = match k.jenis.as_str() {
            "hitungan" => buat_hitungan(t, k.benih),
            "ingat" => buat_ingat(t, k.benih),
            "ketik" => buat_ketik(t, k.benih, &k.sumber).expect("sumber ketik"),
            j => panic!("jenis {j}"),
        };
        assert_eq!((s.teks.as_str(), s.jawaban.as_str()), (k.teks.as_str(), k.jawaban.as_str()), "{} {} benih {}", k.jenis, k.tingkat, k.benih);
        assert!(jawaban_benar(&s, &k.jawaban));
    }
}

#[test]
fn benih_luring_sama() {
    let e: EmasSoal = serde_json::from_str(&emas("soal.json")).unwrap();
    assert!(!e.luring.is_empty());
    for l in e.luring {
        assert_eq!(soal::benih_luring(&l.kunci, l.i), l.benih, "{} #{}", l.kunci, l.i);
    }
}

const KUNCI: &str = "0b5a6e1e-6f39-4b5c-9a33-1c2d3e4f5a6b:2026-10-08";

/// Simulasi PC luring: soal ke-i dari benih luring, tingkat mengikuti aturan turun (sama dengan
/// tes TypeScript `periksaLuring`).
fn jawab_luring(awal: Tingkat, pola: &[bool]) -> Vec<String> {
    let mut k = KeadaanUrutan { tingkat: awal, benar_beruntun: 0, salah_beruntun: 0 };
    pola.iter()
        .enumerate()
        .map(|(i, &b)| {
            let s = soal_luring(KUNCI, i as u32, k.tingkat);
            k = sesudah_jawab(k, b);
            if b {
                s.jawaban
            } else {
                "0".into()
            }
        })
        .collect()
}

#[test]
fn periksa_luring_sama_dengan_server() {
    assert_eq!(periksa_luring(KUNCI, Tingkat::Sedang, 2, &jawab_luring(Tingkat::Sedang, &[true, true])), HasilLuring { lolos: true, dipakai: 2 });
    let j = jawab_luring(Tingkat::Berat, &[false, false, false, true, true]);
    assert_eq!(periksa_luring(KUNCI, Tingkat::Berat, 2, &j), HasilLuring { lolos: true, dipakai: 5 });
    assert!(!periksa_luring(KUNCI, Tingkat::Ringan, 2, &["1".into(), "2".into(), "3".into()]).lolos);
    let lain = jawab_luring(Tingkat::Sedang, &[true, true]);
    assert!(!periksa_luring("kunci-lain:2026-10-08", Tingkat::Sedang, 2, &lain).lolos);
}

#[test]
fn bakukan_jawaban_sama() {
    use antikebo_inti::soal::{bakukan_jawaban, JenisSoal};
    assert_eq!(bakukan_jawaban(JenisSoal::Hitungan, " 0 42 "), "42");
    assert_eq!(bakukan_jawaban(JenisSoal::Hitungan, "000"), "0");
    assert_eq!(bakukan_jawaban(JenisSoal::Hitungan, "1234567"), "1234567");
    assert_eq!(bakukan_jawaban(JenisSoal::Ingat, "482 910"), "482910");
    assert_eq!(bakukan_jawaban(JenisSoal::Ketik, " Presentasi  KLIEN "), "presentasi klien");
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EmasUrutan {
    kasus: Vec<KasusUrutan>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KasusUrutan {
    nama: String,
    jumlah_bahan: usize,
    menit_waktu: Vec<u32>,
    benih: u32,
    berlalu_ms: Vec<u64>,
    harapan: Vec<Option<String>>,
}

#[test]
fn urutan_omelan_sama_dengan_typescript() {
    let e: EmasUrutan = serde_json::from_str(&emas("urutan-suara.json")).unwrap();
    assert!(!e.kasus.is_empty());
    for k in e.kasus {
        let bahan: Vec<String> = (0..k.jumlah_bahan).map(|i| format!("u{i}")).collect();
        let waktu: Vec<Waktu> = k.menit_waktu.iter().map(|&m| Waktu { id: format!("w{m}"), menit: m }).collect();
        let mut s = KeadaanSuara::default();
        let mut hasil = Vec::new();
        for &t in &k.berlalu_ms {
            let (id, baru) = berikutnya(&bahan, &waktu, k.benih, &s, t);
            hasil.push(id);
            s = baru;
        }
        assert_eq!(hasil, k.harapan, "{}", k.nama);
    }
}
