import { Acak } from "./acak";

/**
 * Aturan soal (PRD D1 sampai D3, D6, §15). MURNI dan deterministik: soal = fungsi(jenis, tingkat,
 * benih). Server memakai benih acak kripto; aplikasi PC luring memakai benih turunan kunci
 * kejadian (`benihLuring`) supaya server bisa memeriksa ulang jawaban luring (PRD D8).
 * Urutan tarikan acak di bawah ADALAH spesifikasi untuk port Rust; jangan diubah tanpa
 * memperbarui contoh emas `tests/emas/soal.json`.
 */

export type Tingkat = "ringan" | "sedang" | "berat";
export type JenisSoalDibuat = "hitungan" | "ingat" | "ketik";

export type Soal = {
  jenis: JenisSoalDibuat;
  tingkat: Tingkat;
  /** Yang tampil di layar. Untuk `ingat` = deret angka yang disembunyikan sesudah 3 dtk. */
  teks: string;
  /** Jawaban baku (TIDAK PERNAH dikirim ke peramban untuk hitungan). */
  jawaban: string;
};

const KALI = "×";
const KURANG = "−"; // tanda minus matematika, bukan tanda pisah
const KUADRAT = "²";

/** Hitungan tiga tingkat (PRD §15). Semua jawaban bilangan bulat 1 sampai 999. */
export function buatHitungan(tingkat: Tingkat, benih: number): Soal {
  const r = new Acak(benih);
  const bentuk = r.antara(0, 1);
  let teks: string;
  let nilai: number;
  if (tingkat === "ringan") {
    if (bentuk === 0) {
      const a = r.antara(12, 89);
      const b = r.antara(12, 89);
      [teks, nilai] = [`${a} + ${b}`, a + b];
    } else {
      const b = r.antara(12, 88);
      const a = r.antara(b + 1, 89);
      [teks, nilai] = [`${a} ${KURANG} ${b}`, a - b];
    }
  } else if (tingkat === "sedang") {
    const a = r.antara(3, 12);
    const b = r.antara(3, 9);
    if (bentuk === 0) {
      const c = r.antara(5, 40);
      [teks, nilai] = [`${a} ${KALI} ${b} + ${c}`, a * b + c];
    } else {
      const c = r.antara(5, Math.min(40, a * b - 1));
      [teks, nilai] = [`${a} ${KALI} ${b} ${KURANG} ${c}`, a * b - c];
    }
  } else if (bentuk === 0) {
    const a = r.antara(2, 15);
    const b = r.antara(2, 15);
    const c = r.antara(3, 9);
    const d = r.antara(1, Math.min(40, (a + b) * c - 1));
    [teks, nilai] = [`(${a} + ${b}) ${KALI} ${c} ${KURANG} ${d}`, (a + b) * c - d];
  } else {
    const a = r.antara(6, 15);
    const b = r.antara(5, 40);
    [teks, nilai] = [`${a}${KUADRAT} + ${b}`, a * a + b];
  }
  return { jenis: "hitungan", tingkat, teks, jawaban: String(nilai) };
}

/** Ingat angka (PRD D2): 6 digit (Berat 8), digit pertama bukan nol. */
export function buatIngat(tingkat: Tingkat, benih: number): Soal {
  const r = new Acak(benih);
  const n = tingkat === "berat" ? 8 : 6;
  let s = String(r.antara(1, 9));
  for (let i = 1; i < n; i++) s += String(r.antara(0, 9));
  return { jenis: "ingat", tingkat, teks: s, jawaban: s };
}

/** Ketik kalimat (PRD D3): satu kalimat dari `sumber` (judul agenda atau kalimat penyemangat). */
export function buatKetik(tingkat: Tingkat, benih: number, sumber: readonly string[]): Soal {
  if (!sumber.length) throw new Error("sumber kalimat kosong");
  const r = new Acak(benih);
  const k = sumber[r.antara(0, sumber.length - 1)];
  return { jenis: "ketik", tingkat, teks: k, jawaban: k };
}

export function buatSoal(jenis: JenisSoalDibuat, tingkat: Tingkat, benih: number, sumberKetik: readonly string[] = []): Soal {
  if (jenis === "ingat") return buatIngat(tingkat, benih);
  if (jenis === "ketik") return buatKetik(tingkat, benih, sumberKetik);
  return buatHitungan(tingkat, benih);
}

/** Bentuk baku jawaban sebelum dibandingkan / di-hash. */
export function bakukanJawaban(jenis: JenisSoalDibuat | "qr", masukan: string): string {
  const s = masukan.normalize("NFC").trim();
  if (jenis === "hitungan") {
    const angka = s.replace(/\s+/g, "");
    return /^\d{1,6}$/.test(angka) ? String(Number(angka)) : angka;
  }
  if (jenis === "ingat") return s.replace(/\s+/g, "");
  if (jenis === "ketik") return s.toLowerCase().replace(/\s+/g, " ");
  return s;
}

export function jawabanBenar(soal: Pick<Soal, "jenis" | "jawaban">, masukan: string): boolean {
  return bakukanJawaban(soal.jenis, masukan) === bakukanJawaban(soal.jenis, soal.jawaban);
}

// ------------------------------------------------------------------ urutan & turun tingkat

export const TURUN: Record<Tingkat, Tingkat> = { berat: "sedang", sedang: "ringan", ringan: "ringan" };
export const SALAH_UNTUK_TURUN = 3;

export type KeadaanUrutan = { tingkat: Tingkat; benarBeruntun: number; salahBeruntun: number };

/**
 * Keadaan sesudah satu jawaban (PRD D1, D6): benar menambah beruntun; salah mengulang dari nol
 * dengan soal baru tingkat sama; salah 3 kali berturut-turut = turun satu tingkat (paling rendah
 * Ringan).
 */
export function sesudahJawab(k: KeadaanUrutan, benar: boolean): KeadaanUrutan {
  if (benar) return { tingkat: k.tingkat, benarBeruntun: k.benarBeruntun + 1, salahBeruntun: 0 };
  const salah = k.salahBeruntun + 1;
  if (salah >= SALAH_UNTUK_TURUN) return { tingkat: TURUN[k.tingkat], benarBeruntun: 0, salahBeruntun: 0 };
  return { tingkat: k.tingkat, benarBeruntun: 0, salahBeruntun: salah };
}

// ------------------------------------------------------------------ luring (PRD D8)

/**
 * Benih soal ke-`i` untuk kejadian berkunci `kunci` saat aplikasi PC luring: 4 bait pertama
 * SHA-256("antikebo-luring:" + kunci + ":" + i), big-endian. Server menghitung ulang benih yang
 * sama untuk memeriksa jawaban luring, jadi PC tidak bisa memilih soal yang gampang.
 */
export async function benihLuring(kunci: string, i: number): Promise<number> {
  const data = new TextEncoder().encode(`antikebo-luring:${kunci}:${i}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
}

export type HasilLuring = { lolos: boolean; dipakai: number };

/**
 * Periksa ulang jawaban yang dikumpulkan aplikasi PC luring (hanya hitungan; soal tingkat
 * mengikuti aturan turun tingkat). Lolos bila `target` benar berturut-turut tercapai; jawaban
 * sesudah lolos diabaikan.
 */
export async function periksaLuring(kunci: string, awal: Tingkat, target: number, jawaban: readonly string[]): Promise<HasilLuring> {
  let k: KeadaanUrutan = { tingkat: awal, benarBeruntun: 0, salahBeruntun: 0 };
  for (let i = 0; i < jawaban.length && i < 200; i++) {
    const s = buatHitungan(k.tingkat, await benihLuring(kunci, i));
    k = sesudahJawab(k, jawabanBenar(s, jawaban[i]));
    if (k.benarBeruntun >= target) return { lolos: true, dipakai: i + 1 };
  }
  return { lolos: false, dipakai: Math.min(jawaban.length, 200) };
}
