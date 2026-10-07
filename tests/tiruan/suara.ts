import { createHash } from "node:crypto";

// Suara tiruan untuk server tiruan AgentBuff: berkas MP3 pendek yang DIBUAT SKRIP (bukan
// rekaman, bukan TTS). Bunyinya rangkaian nada "bergumam" seperti orang bicara: satu
// letupan nada per suku kata, nada dasar dari pilihan suara, gaya galak lebih cepat dan
// lebih tinggi. Deterministik: teks + suara + gaya yang sama = byte yang sama (uji pakai ulang klip).

const LAJU = 24_000;
const KBPS = 48;

export type KlipTiruan = { audio: Buffer; durasiMs: number };

function benih(teks: string): () => number {
  let h = createHash("sha256").update(teks).digest().readUInt32LE(0) || 1;
  return () => {
    // xorshift32: acak semu yang bisa diulang.
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 0xffffffff;
  };
}

/** Perkiraan jumlah suku kata (vokal berurutan dihitung satu). */
function sukuKata(teks: string): number {
  const n = (teks.toLowerCase().match(/[aiueo]+/g) ?? []).length;
  return Math.max(1, n);
}

export async function buatKlipTiruan(isi: { teks: string; suara: string; gaya: "galak" | "biasa"; perempuan: boolean }): Promise<KlipTiruan> {
  const acak = benih(`${isi.suara}|${isi.gaya}|${isi.teks}`);
  const galak = isi.gaya === "galak";
  const dasar = (isi.perempuan ? 210 : 120) * (galak ? 1.25 : 1);
  const panjangSuku = galak ? 0.13 : 0.17;
  const jeda = galak ? 0.035 : 0.05;
  const jumlah = Math.min(sukuKata(isi.teks), 70);
  const detik = Math.min(jumlah * (panjangSuku + jeda) + 0.25, 15);
  const sampel = new Int16Array(Math.ceil(detik * LAJU));
  const puncak = galak ? 0.6 : 0.45;

  let t = 0.1;
  for (let i = 0; i < jumlah; i++) {
    const nada = dasar * (0.85 + acak() * 0.4);
    const panjang = panjangSuku * (0.8 + acak() * 0.4);
    const mulai = Math.floor(t * LAJU);
    const n = Math.floor(panjang * LAJU);
    for (let j = 0; j < n && mulai + j < sampel.length; j++) {
      const x = j / LAJU;
      const selubung = Math.sin((Math.PI * j) / n) ** 0.6; // naik-turun halus tiap suku kata
      const geser = 1 + 0.08 * Math.sin(2 * Math.PI * 5 * x); // getar nada
      const w = 2 * Math.PI * nada * geser * x;
      const v = 0.6 * Math.sin(w) + 0.25 * Math.sin(2 * w) + 0.15 * Math.sin(3 * w);
      sampel[mulai + j] = Math.round(v * selubung * puncak * 32767);
    }
    t += panjang + jeda * (0.6 + acak() * 0.8);
  }

  // Pengode MP3 murni JS. Impor dinamis: paketnya ESM-saja (tsx menjalankan .ts sebagai CJS).
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const enc = new Mp3Encoder(1, LAJU, KBPS);
  const potongan: Buffer[] = [];
  for (let i = 0; i < sampel.length; i += 1152) potongan.push(Buffer.from(enc.encodeBuffer(sampel.subarray(i, i + 1152))));
  potongan.push(Buffer.from(enc.flush()));
  return { audio: Buffer.concat(potongan), durasiMs: Math.round((sampel.length / LAJU) * 1000) };
}
