//! Penjaga (docs/09 §3 butir 3): proses kecil yang menyalakan lagi proses utama bila mati saat
//! siaga, dan sebaliknya. Keputusannya murni di sini supaya bisa dites.

/// Proses utama menulis berkas ini sebelum keluar dengan sah (di luar siaga); penjaga lalu ikut
/// berhenti, bukan menyalakan ulang.
pub const BERKAS_KELUAR: &str = "keluar-sah";
/// Paling banyak 5 kali menyala ulang per menit (mencegah putaran mogok tanpa akhir).
pub const BATAS_ULANG: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Keputusan {
    Tunggu,
    NyalakanUlang,
    Selesai,
}

#[derive(Debug, Default)]
pub struct Penjaga {
    riwayat: Vec<i64>,
}

impl Penjaga {
    pub fn baru() -> Self {
        Self::default()
    }

    /// Dipanggil tiap detik.
    pub fn periksa(&mut self, yang_dijaga_hidup: bool, keluar_sah: bool, sekarang_ms: i64) -> Keputusan {
        if yang_dijaga_hidup {
            return Keputusan::Tunggu;
        }
        if keluar_sah {
            return Keputusan::Selesai;
        }
        self.riwayat.retain(|t| sekarang_ms - t < 60_000);
        if self.riwayat.len() >= BATAS_ULANG {
            return Keputusan::Tunggu;
        }
        self.riwayat.push(sekarang_ms);
        Keputusan::NyalakanUlang
    }
}

#[cfg(test)]
mod tes {
    use super::*;

    #[test]
    fn nyalakan_ulang_kecuali_keluar_sah_dan_dibatasi() {
        let mut p = Penjaga::baru();
        assert_eq!(p.periksa(true, false, 0), Keputusan::Tunggu);
        assert_eq!(p.periksa(false, true, 0), Keputusan::Selesai);
        for i in 0..5 {
            assert_eq!(p.periksa(false, false, i * 1000), Keputusan::NyalakanUlang);
        }
        assert_eq!(p.periksa(false, false, 6_000), Keputusan::Tunggu);
        assert_eq!(p.periksa(false, false, 61_000), Keputusan::NyalakanUlang);
    }
}
