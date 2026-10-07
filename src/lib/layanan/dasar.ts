/**
 * Galat bisnis yang aman ditampilkan ke pengguna / agen. `kode` stabil
 * (dipakai SKILL.md, UI, dan alat MCP), `pesan` kalimat manusia bahasa Indonesia.
 * Kode baru ditambah bersama fiturnya (mis. `komitmen_terkunci` di P2).
 */
export type KodeGalat =
  | "tidak_ditemukan"
  | "masukan"
  | "batas_laju"
  | "perlu_izin" // izin AgentBuff (kabar/suara) belum diberi
  | "perlu_perangkat"; // aksi harus dilakukan di perangkat itu sendiri

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
