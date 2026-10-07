//! Aturan soal (port `src/lib/soal/soal.ts`, PRD D1 sampai D3, D6, D8, §15). Urutan tarikan acak
//! adalah spesifikasi: diuji dengan `tests/emas/soal.json` yang sama dengan TypeScript.

use crate::acak::Acak;
use sha2::{Digest, Sha256};
use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tingkat {
    Ringan,
    Sedang,
    Berat,
}

impl Tingkat {
    pub fn dari_teks(s: &str) -> Option<Self> {
        match s {
            "ringan" => Some(Self::Ringan),
            "sedang" => Some(Self::Sedang),
            "berat" => Some(Self::Berat),
            _ => None,
        }
    }

    /// Salah 3 kali berturut-turut = turun satu tingkat (paling rendah Ringan).
    pub fn turun(self) -> Self {
        match self {
            Self::Berat => Self::Sedang,
            _ => Self::Ringan,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JenisSoal {
    Hitungan,
    Ingat,
    Ketik,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct Soal {
    pub jenis: JenisSoal,
    pub tingkat: Tingkat,
    /// Yang tampil di layar.
    pub teks: String,
    /// Jawaban baku. Tidak pernah dikirim ke tampilan untuk hitungan.
    #[serde(skip)]
    pub jawaban: String,
}

const KALI: &str = "\u{00d7}";
const KURANG: &str = "\u{2212}";
const KUADRAT: &str = "\u{00b2}";

/// Hitungan tiga tingkat (PRD §15). Semua jawaban bilangan bulat 1 sampai 999.
pub fn buat_hitungan(tingkat: Tingkat, benih: u32) -> Soal {
    let mut r = Acak::baru(benih);
    let bentuk = r.antara(0, 1);
    let (teks, nilai) = match tingkat {
        Tingkat::Ringan => {
            if bentuk == 0 {
                let a = r.antara(12, 89);
                let b = r.antara(12, 89);
                (format!("{a} + {b}"), a + b)
            } else {
                let b = r.antara(12, 88);
                let a = r.antara(b + 1, 89);
                (format!("{a} {KURANG} {b}"), a - b)
            }
        }
        Tingkat::Sedang => {
            let a = r.antara(3, 12);
            let b = r.antara(3, 9);
            if bentuk == 0 {
                let c = r.antara(5, 40);
                (format!("{a} {KALI} {b} + {c}"), a * b + c)
            } else {
                let c = r.antara(5, 40.min(a * b - 1));
                (format!("{a} {KALI} {b} {KURANG} {c}"), a * b - c)
            }
        }
        Tingkat::Berat => {
            if bentuk == 0 {
                let a = r.antara(2, 15);
                let b = r.antara(2, 15);
                let c = r.antara(3, 9);
                let d = r.antara(1, 40.min((a + b) * c - 1));
                (format!("({a} + {b}) {KALI} {c} {KURANG} {d}"), (a + b) * c - d)
            } else {
                let a = r.antara(6, 15);
                let b = r.antara(5, 40);
                (format!("{a}{KUADRAT} + {b}"), a * a + b)
            }
        }
    };
    Soal { jenis: JenisSoal::Hitungan, tingkat, teks, jawaban: nilai.to_string() }
}

/// Ingat angka (PRD D2): 6 digit (Berat 8), digit pertama bukan nol.
pub fn buat_ingat(tingkat: Tingkat, benih: u32) -> Soal {
    let mut r = Acak::baru(benih);
    let n = if tingkat == Tingkat::Berat { 8 } else { 6 };
    let mut s = r.antara(1, 9).to_string();
    for _ in 1..n {
        s.push_str(&r.antara(0, 9).to_string());
    }
    Soal { jenis: JenisSoal::Ingat, tingkat, teks: s.clone(), jawaban: s }
}

/// Ketik kalimat (PRD D3): satu kalimat dari `sumber`.
pub fn buat_ketik(tingkat: Tingkat, benih: u32, sumber: &[String]) -> Option<Soal> {
    if sumber.is_empty() {
        return None;
    }
    let mut r = Acak::baru(benih);
    let k = sumber[r.antara(0, sumber.len() as i64 - 1) as usize].clone();
    Some(Soal { jenis: JenisSoal::Ketik, tingkat, teks: k.clone(), jawaban: k })
}

/// Bentuk baku jawaban sebelum dibandingkan (sama dengan `bakukanJawaban`).
pub fn bakukan_jawaban(jenis: JenisSoal, masukan: &str) -> String {
    let s: String = masukan.nfc().collect::<String>().trim().to_string();
    let tanpa_spasi = || s.split_whitespace().collect::<String>();
    match jenis {
        JenisSoal::Hitungan => {
            let angka = tanpa_spasi();
            if !angka.is_empty() && angka.len() <= 6 && angka.bytes().all(|b| b.is_ascii_digit()) {
                angka.trim_start_matches('0').parse::<u64>().map(|n| n.to_string()).unwrap_or_else(|_| "0".into())
            } else {
                angka
            }
        }
        JenisSoal::Ingat => tanpa_spasi(),
        JenisSoal::Ketik => s.to_lowercase().split_whitespace().collect::<Vec<_>>().join(" "),
    }
}

pub fn jawaban_benar(soal: &Soal, masukan: &str) -> bool {
    bakukan_jawaban(soal.jenis, masukan) == bakukan_jawaban(soal.jenis, &soal.jawaban)
}

pub const SALAH_UNTUK_TURUN: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KeadaanUrutan {
    pub tingkat: Tingkat,
    pub benar_beruntun: u32,
    pub salah_beruntun: u32,
}

/// Keadaan sesudah satu jawaban (PRD D1, D6), sama dengan `sesudahJawab`.
pub fn sesudah_jawab(k: KeadaanUrutan, benar: bool) -> KeadaanUrutan {
    if benar {
        return KeadaanUrutan { tingkat: k.tingkat, benar_beruntun: k.benar_beruntun + 1, salah_beruntun: 0 };
    }
    let salah = k.salah_beruntun + 1;
    if salah >= SALAH_UNTUK_TURUN {
        return KeadaanUrutan { tingkat: k.tingkat.turun(), benar_beruntun: 0, salah_beruntun: 0 };
    }
    KeadaanUrutan { tingkat: k.tingkat, benar_beruntun: 0, salah_beruntun: salah }
}

/// Benih soal luring ke-`i` (PRD D8): 4 bait pertama SHA-256("antikebo-luring:" + kunci + ":" + i).
pub fn benih_luring(kunci: &str, i: u32) -> u32 {
    let h = Sha256::digest(format!("antikebo-luring:{kunci}:{i}").as_bytes());
    u32::from_be_bytes([h[0], h[1], h[2], h[3]])
}

/// Soal luring berikutnya untuk keadaan sekarang (aplikasi PC tanpa internet).
pub fn soal_luring(kunci: &str, i: u32, tingkat: Tingkat) -> Soal {
    buat_hitungan(tingkat, benih_luring(kunci, i))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HasilLuring {
    pub lolos: bool,
    pub dipakai: usize,
}

/// Periksa ulang jawaban luring persis seperti server (`periksaLuring`).
pub fn periksa_luring(kunci: &str, awal: Tingkat, target: u32, jawaban: &[String]) -> HasilLuring {
    let mut k = KeadaanUrutan { tingkat: awal, benar_beruntun: 0, salah_beruntun: 0 };
    for (i, j) in jawaban.iter().enumerate().take(200) {
        let s = soal_luring(kunci, i as u32, k.tingkat);
        k = sesudah_jawab(k, jawaban_benar(&s, j));
        if k.benar_beruntun >= target {
            return HasilLuring { lolos: true, dipakai: i + 1 };
        }
    }
    HasilLuring { lolos: false, dipakai: jawaban.len().min(200) }
}
