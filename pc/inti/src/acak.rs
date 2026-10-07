//! Pembangkit acak deterministik mulberry32 (port `src/lib/soal/acak.ts`). Semua operasi 32 bit
//! dengan pembungkusan, persis seperti `Math.imul` dan `>>> 0` di JavaScript.

#[derive(Debug, Clone)]
pub struct Acak {
    keadaan: u32,
}

impl Acak {
    pub fn baru(benih: u32) -> Self {
        Self { keadaan: benih }
    }

    pub fn berikut(&mut self) -> u32 {
        self.keadaan = self.keadaan.wrapping_add(0x6d2b_79f5);
        let mut t = self.keadaan;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        t ^ (t >> 14)
    }

    /// Bilangan bulat di [min, maks] (inklusif).
    pub fn antara(&mut self, min: i64, maks: i64) -> i64 {
        let rentang = (maks - min + 1) as u64;
        min + (self.berikut() as u64 % rentang) as i64
    }
}
