import { and, desc, eq, lt } from "drizzle-orm";
import { denganPengguna, schema, type Tx } from "@/lib/db";
import { log } from "@/lib/log";
import type { Sumber } from "./dasar";

export type IsiAudit = {
  sumber: Sumber;
  jenis: "masuk" | "token" | "izin" | "alarm" | "kejadian" | "perangkat" | "pengaturan" | "lainnya";
  ringkasan: string;
  detail?: Record<string, unknown> | null;
  berhasil?: boolean;
  galat?: string | null;
};

/** Catat satu tindakan. Gagal mencatat TIDAK boleh menggagalkan tindakannya. Jangan pernah mengisi rahasia atau isi pribadi. */
export async function catatAudit(penggunaId: string, isi: IsiAudit, tx?: Tx): Promise<void> {
  const nilai = {
    penggunaId,
    sumber: isi.sumber,
    jenis: isi.jenis,
    ringkasan: isi.ringkasan.slice(0, 300),
    detail: isi.detail ?? null,
    berhasil: isi.berhasil ?? true,
    galat: isi.galat?.slice(0, 300) ?? null,
  };
  try {
    if (tx) await tx.insert(schema.audit).values(nilai);
    else await denganPengguna(penggunaId, (t) => t.insert(schema.audit).values(nilai));
  } catch (e) {
    log.warn({ err: (e as Error)?.message }, "gagal mencatat audit");
  }
}

export async function daftarAudit(penggunaId: string, opsi: { batas?: number; sebelum?: number } = {}) {
  const batas = Math.min(Math.max(opsi.batas ?? 30, 1), 100);
  return denganPengguna(penggunaId, (tx) =>
    tx
      .select()
      .from(schema.audit)
      .where(and(eq(schema.audit.penggunaId, penggunaId), opsi.sebelum ? lt(schema.audit.id, opsi.sebelum) : undefined))
      .orderBy(desc(schema.audit.id))
      .limit(batas),
  );
}
