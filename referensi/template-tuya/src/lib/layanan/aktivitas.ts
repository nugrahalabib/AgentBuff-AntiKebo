import { and, desc, eq, lt } from "drizzle-orm";
import { denganPengguna, schema, type Tx } from "@/lib/db";
import { log } from "@/lib/log";
import type { Sumber } from "./dasar";

export type IsiAktivitas = {
  sumber: Sumber;
  jenis: "kendali" | "suasana" | "jadwal" | "otomasi" | "sambungan" | "token" | "lainnya";
  ringkasan: string;
  deviceId?: string | null;
  detail?: Record<string, unknown> | null;
  berhasil?: boolean;
  galat?: string | null;
};

/** Catat satu tindakan. Gagal mencatat TIDAK boleh menggagalkan tindakannya. */
export async function catatAktivitas(penggunaId: string, isi: IsiAktivitas, tx?: Tx): Promise<void> {
  const nilai = {
    penggunaId,
    sumber: isi.sumber,
    jenis: isi.jenis,
    ringkasan: isi.ringkasan.slice(0, 300),
    deviceId: isi.deviceId ?? null,
    detail: isi.detail ?? null,
    berhasil: isi.berhasil ?? true,
    galat: isi.galat?.slice(0, 300) ?? null,
  };
  try {
    if (tx) await tx.insert(schema.aktivitas).values(nilai);
    else await denganPengguna(penggunaId, (t) => t.insert(schema.aktivitas).values(nilai));
  } catch (e) {
    log.warn({ err: (e as Error)?.message }, "gagal mencatat aktivitas");
  }
}

export async function daftarAktivitas(penggunaId: string, opsi: { batas?: number; sebelum?: number } = {}) {
  const batas = Math.min(Math.max(opsi.batas ?? 30, 1), 100);
  return denganPengguna(penggunaId, (tx) =>
    tx
      .select()
      .from(schema.aktivitas)
      .where(and(eq(schema.aktivitas.penggunaId, penggunaId), opsi.sebelum ? lt(schema.aktivitas.id, opsi.sebelum) : undefined))
      .orderBy(desc(schema.aktivitas.id))
      .limit(batas),
  );
}
