import { createHash } from "node:crypto";
import type { IdKarakter } from "@/lib/alarm/isi";
import { MENIT_WAKTU, NASKAH_KARAKTER, type MenitWaktu } from "./karakter";

/**
 * Naskah yang dibutuhkan satu alarm (docs/10-SUARA.md §4): kalimat karakter (umum, waktu, agenda,
 * cek, penutup) yang sudah diisi nama panggilan dan agenda, plus kalimat pribadi. Setiap kalimat
 * punya `hash` = kunci klip: sama teks + suara + gaya + bahasa = klip yang sama dipakai ulang lintas
 * alarm (PRD F7).
 */

export type JenisKalimat = "umum" | "waktu" | "agenda" | "pribadi" | "cek" | "penutup";
export type Kalimat = { jenis: JenisKalimat; menit?: MenitWaktu; teks: string; hash: string };

export const GAYA = "galak" as const;

export function hashKalimat(teks: string, suaraId: string | null, bahasa: "id" | "en", gaya: string = GAYA): string {
  return createHash("sha256")
    .update(`v1|${bahasa}|${gaya}|${suaraId ?? "bawaan"}|${teks}`)
    .digest("hex");
}

export function isiPlaceholder(teks: string, nilai: { nama: string; agenda?: string }): string {
  return teks.replace(/\{nama\}/g, nilai.nama).replace(/\{agenda\}/g, nilai.agenda ?? "");
}

export type MasukanNaskah = {
  karakter: IdKarakter;
  bahasa: "id" | "en";
  nama: string;
  /** Judul agenda; kalimat agenda hanya dipakai bila bukan judul bawaan ("Bangun"). */
  agenda: string | null;
  suaraId: string | null;
  pribadi: readonly string[];
};

export function naskahAlarm(m: MasukanNaskah): Kalimat[] {
  const buat = (jenis: JenisKalimat, teks: string, menit?: MenitWaktu): Kalimat => {
    const t = isiPlaceholder(teks, { nama: m.nama, agenda: m.agenda ?? undefined }).trim();
    return { jenis, ...(menit ? { menit } : {}), teks: t, hash: hashKalimat(t, m.suaraId, m.bahasa) };
  };
  const hasil: Kalimat[] = [];
  if (m.karakter !== "kustom") {
    const n = NASKAH_KARAKTER[m.karakter][m.bahasa];
    hasil.push(...n.umum.map((t) => buat("umum", t)));
    hasil.push(...MENIT_WAKTU.map((mn) => buat("waktu", n.waktu[mn], mn)));
    if (m.agenda) hasil.push(...n.agenda.map((t) => buat("agenda", t)));
    hasil.push(buat("cek", n.cek), buat("penutup", n.penutup));
  }
  hasil.push(...m.pribadi.map((t) => buat("pribadi", t)));
  // Kalimat sama persis (mis. pribadi = umum) cukup sekali.
  return hasil.filter((k, i) => hasil.findIndex((x) => x.hash === k.hash && x.jenis === k.jenis) === i);
}
