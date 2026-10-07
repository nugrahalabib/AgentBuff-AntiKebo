//! Urutan putar omelan (port `src/lib/suara/urutan.ts`, docs/10-SUARA.md §3). Deterministik dari
//! benih supaya web dan PC memutar urutan yang sama; diuji dengan `tests/emas/urutan-suara.json`.

use crate::acak::Acak;

pub const JEDA_MS: u64 = 3_000;
pub const REDAM_KE: f32 = 0.3;
pub const REDAM_MS: u64 = 150;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Waktu {
    pub id: String,
    pub menit: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct KeadaanUrutan {
    /// Sisa urutan putaran sekarang (indeks bahan).
    pub antrean: Vec<usize>,
    pub terakhir: Option<usize>,
    pub waktu_terputar: Vec<u32>,
    pub putaran: u32,
}

/// Satu putaran acak (Fisher-Yates, mulberry32), sama dengan `acakPutaran`.
pub fn acak_putaran(n: usize, benih: u32, putaran: u32, hindari: Option<usize>) -> Vec<usize> {
    let mut r = Acak::baru(benih.wrapping_add(putaran.wrapping_mul(0x9e37_79b1)));
    let mut a: Vec<usize> = (0..n).collect();
    for i in (1..n).rev() {
        let j = r.antara(0, i as i64) as usize;
        a.swap(i, j);
    }
    if n > 1 && hindari.is_some() && Some(a[0]) == hindari {
        a.swap(0, 1);
    }
    a
}

/// Kalimat berikutnya pada `berlalu_ms` sejak alarm mulai berbunyi: id kalimat (atau None bila
/// tidak ada bahan) dan keadaan baru. Bahan = id kalimat umum/agenda/pribadi.
pub fn berikutnya(bahan: &[String], waktu: &[Waktu], benih: u32, k: &KeadaanUrutan, berlalu_ms: u64) -> (Option<String>, KeadaanUrutan) {
    // Kalimat waktu yang jatuh tempo; bila beberapa terlewat sekaligus, hanya yang terbaru diputar.
    let jatuh = waktu.iter().filter(|w| !k.waktu_terputar.contains(&w.menit) && berlalu_ms >= w.menit as u64 * 60_000).max_by_key(|w| w.menit);
    if let Some(w) = jatuh {
        let mut terputar = k.waktu_terputar.clone();
        for x in waktu.iter().filter(|x| x.menit <= w.menit) {
            if !terputar.contains(&x.menit) {
                terputar.push(x.menit);
            }
        }
        return (Some(w.id.clone()), KeadaanUrutan { waktu_terputar: terputar, ..k.clone() });
    }
    if bahan.is_empty() {
        return (None, k.clone());
    }
    let mut antrean = k.antrean.clone();
    let mut putaran = k.putaran;
    if antrean.is_empty() {
        antrean = acak_putaran(bahan.len(), benih, putaran, k.terakhir);
        putaran += 1;
    }
    let i = antrean.remove(0);
    (Some(bahan[i].clone()), KeadaanUrutan { antrean, terakhir: Some(i), putaran, waktu_terputar: k.waktu_terputar.clone() })
}
