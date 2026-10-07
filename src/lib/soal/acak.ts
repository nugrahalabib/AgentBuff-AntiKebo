/**
 * Pembangkit acak deterministik untuk soal (mulberry32, 32 bit). Sengaja sederhana dan dirinci
 * supaya aplikasi PC (Rust, P10) menghasilkan soal yang SAMA dari benih yang sama: aturan dan
 * contoh emasnya satu (`tests/emas/soal.json`).
 *
 *   keadaan = (keadaan + 0x6D2B79F5) mod 2^32
 *   t = imul(keadaan ^ (keadaan >>> 15), keadaan | 1)
 *   t = t ^ (t + imul(t ^ (t >>> 7), t | 61))        (penjumlahan mod 2^32)
 *   hasil = (t ^ (t >>> 14)) >>> 0
 *   antara(min, maks) = min + hasil mod (maks - min + 1)
 */
export class Acak {
  private keadaan: number;

  constructor(benih: number) {
    this.keadaan = benih >>> 0;
  }

  berikut(): number {
    this.keadaan = (this.keadaan + 0x6d2b79f5) >>> 0;
    let t = this.keadaan;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Bilangan bulat di [min, maks] (inklusif). */
  antara(min: number, maks: number): number {
    return min + (this.berikut() % (maks - min + 1));
  }
}
