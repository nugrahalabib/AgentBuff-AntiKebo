import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// Utilitas kripto kecil. Kunci turunan HKDF dari SESSION_SECRET: satu rahasia
// env, beberapa kunci terpisah per keperluan ("info"), jadi membocorkan satu
// cookie tidak membuka keperluan lain.

export function sha256Hex(teks: string | Buffer): string {
  return createHash("sha256").update(teks).digest("hex");
}

export function acakBase64Url(byte = 32): string {
  return randomBytes(byte).toString("base64url");
}

export function samaWaktuTetap(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function kunciTurunan(info: string): Buffer {
  const rahasia = process.env.SESSION_SECRET;
  if (!rahasia || rahasia.length < 32) throw new Error("SESSION_SECRET belum diisi / terlalu pendek");
  return Buffer.from(hkdfSync("sha256", rahasia, "antikebo", info, 32));
}

/** Enkripsi AES-256-GCM -> base64url(iv|tag|isi). Untuk cookie sementara (OIDC). */
export function segel(nilai: unknown, info: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunciTurunan(info), iv);
  const isi = Buffer.concat([c.update(JSON.stringify(nilai), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), isi]).toString("base64url");
}

export function bukaSegel<T>(token: string, info: string): T | null {
  try {
    const b = Buffer.from(token, "base64url");
    if (b.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", kunciTurunan(info), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    const isi = Buffer.concat([d.update(b.subarray(28)), d.final()]);
    return JSON.parse(isi.toString("utf8")) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- rahasia di kolom

/**
 * Enkripsi amplop untuk rahasia yang disimpan di basis data (kunci Tuya, kunci langganan push). Token MCP dan token perangkat cukup disimpan hash-nya.
 * DEK acak per rahasia mengenkripsi isi; KEK (`ENCRYPTION_KEK`, 32 byte base64)
 * membungkus DEK. AAD mengikat rahasia ke pemiliknya: rahasia yang ditukar ke
 * baris pengguna lain GAGAL dibuka, bukan terbuka untuk orang yang salah.
 * Tata letak base64url: "AK1" | ivK(12) | tagK(16) | DEKterbungkus(32) | iv(12) | tag(16) | isi
 */
function kek(): Buffer {
  const b64 = process.env.ENCRYPTION_KEK;
  if (!b64) throw new Error("ENCRYPTION_KEK belum diisi");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEK harus 32 byte (base64)");
  return k;
}

function gcm(kunci: Buffer, data: Buffer, aad: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunci, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const isi = Buffer.concat([c.update(data), c.final()]);
  return { iv, tag: c.getAuthTag(), isi };
}

function bukaGcm(kunci: Buffer, iv: Buffer, tag: Buffer, isi: Buffer, aad: string): Buffer {
  const d = createDecipheriv("aes-256-gcm", kunci, iv);
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(isi), d.final()]);
}

export function sandikanRahasia(teks: string, aad: string): string {
  const dek = randomBytes(32);
  const bungkus = gcm(kek(), dek, `kek:${aad}`);
  const isi = gcm(dek, Buffer.from(teks, "utf8"), aad);
  return Buffer.concat([Buffer.from("AK1"), bungkus.iv, bungkus.tag, bungkus.isi, isi.iv, isi.tag, isi.isi]).toString("base64url");
}

export function bukaRahasia(sandi: string, aad: string): string {
  const b = Buffer.from(sandi, "base64url");
  if (b.subarray(0, 3).toString() !== "AK1" || b.length < 3 + 12 + 16 + 32 + 12 + 16 + 1) throw new Error("Rahasia rusak");
  let o = 3;
  const ivK = b.subarray(o, (o += 12));
  const tagK = b.subarray(o, (o += 16));
  const dekB = b.subarray(o, (o += 32));
  const iv = b.subarray(o, (o += 12));
  const tag = b.subarray(o, (o += 16));
  const isi = b.subarray(o);
  const dek = bukaGcm(kek(), ivK, tagK, dekB, `kek:${aad}`);
  return bukaGcm(dek, iv, tag, isi, aad).toString("utf8");
}
