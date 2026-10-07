import type { z } from "zod";
import { isi, type Kamus } from "@/lib/i18n";

/**
 * Galat bisnis yang aman ditampilkan ke pengguna / agen. `kode` stabil
 * (dipakai SKILL.md, UI, dan alat MCP), `pesan` kalimat manusia bahasa Indonesia.
 * Kode baru ditambah bersama fiturnya.
 */
export type KodeGalat =
  | "tidak_ditemukan"
  | "masukan"
  | "batas_laju"
  | "perlu_izin" // izin AgentBuff (kabar/suara) belum diberi
  | "perlu_perangkat" // aksi harus dilakukan di perangkat itu sendiri
  | "komitmen_terkunci" // Mode Komitmen menolak tindakan (MCP: commitment_locked)
  | "sedang_berbunyi"; // alarm sedang berbunyi: hanya soal di layar alarm yang bisa (MCP: alarm_ringing)

export class GalatLayanan extends Error {
  readonly kode: KodeGalat;
  readonly tambahan: Record<string, unknown>;
  constructor(kode: KodeGalat, pesan: string, tambahan: Record<string, unknown> = {}) {
    super(pesan);
    this.name = "GalatLayanan";
    this.kode = kode;
    this.tambahan = tambahan;
  }
}

/** Siapa yang melakukan tindakan (dicatat di audit). */
export type Sumber = "web" | "agen" | "perangkat" | "worker" | "sistem";

/** Kalimat galat masukan dari galat zod: kunci pesan kustom diterjemahkan lewat `galat.isian`. */
export function pesanMasukan(e: z.ZodError, t: Kamus): string {
  const masalah = e.issues[0];
  const daftar = t.galat.isian as Record<string, string>;
  const kunci = masalah?.message ?? "";
  const teks = kunci in daftar && kunci !== "umum" ? daftar[kunci] : isi(t.galat.isian.umum, { isian: masalah?.path.join(".") || "?" });
  return isi(t.galat.masukan, { isian: teks });
}
