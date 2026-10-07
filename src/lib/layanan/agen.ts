import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { cabutToken, daftarToken, terbitkanToken } from "@/lib/agen/token";
import { denganPengguna, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { catatAudit, daftarAudit } from "./audit";
import { GalatLayanan, type Sumber } from "./dasar";
import { konteksPengguna } from "./konteks";

/**
 * Halaman Agen (PRD L3): status sambung otomatis AgentBuff, aktivitas terbaru (catatan audit:
 * siapa mengubah apa, termasuk lewat agen), dan token manual untuk klien MCP lain. Token mentah
 * hanya dikembalikan SEKALI saat dibuat; yang disimpan hanya hash-nya.
 */

export type TokenTampil = { id: string; label: string; awalan: string; sumber: string; terakhirDipakai: Date | null; kedaluwarsa: Date | null; dibuat: Date };
export type AktivitasTampil = { id: number; sumber: string; jenis: string; ringkasan: string; berhasil: boolean; dibuat: Date };

export async function dataAgen(penggunaId: string): Promise<{ alamatMcp: string; token: TokenTampil[]; aktivitas: AktivitasTampil[] }> {
  const [token, aktivitas] = await Promise.all([daftarToken(penggunaId), daftarAudit(penggunaId, { batas: 40 })]);
  return {
    alamatMcp: `${env("APP_ORIGIN")}/mcp`,
    token: token.map((x) => ({ id: x.id, label: x.label, awalan: x.awalan, sumber: x.sumber, terakhirDipakai: x.terakhirDipakai, kedaluwarsa: x.kedaluwarsa, dibuat: x.dibuat })),
    aktivitas: aktivitas.map((a) => ({ id: a.id, sumber: a.sumber, jenis: a.jenis, ringkasan: a.ringkasan, berhasil: a.berhasil, dibuat: a.dibuat })),
  };
}

const SkemaToken = z.strictObject({ label: z.string().trim().min(1).max(60) });
const BERLAKU_MS = 365 * 24 * 60 * 60 * 1000;
/** Token manual aktif paling banyak (batas laju MCP per pengguna, tetapi tetap jangan menumpuk). */
export const MAKS_TOKEN_MANUAL = 10;

/** Token manual untuk klien MCP lain (berlaku 1 tahun). Agen AgentBuff tersambung otomatis tanpa ini. */
export async function buatTokenManual(penggunaId: string, masukan: unknown, sumber: Sumber): Promise<{ token: string }> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const m = SkemaToken.safeParse(masukan ?? {});
    if (!m.success) throw new GalatLayanan("masukan", k.t.agen.labelWajib);
    // Dihitung di transaksi yang sama (satu sambungan; tidak menunggu sambungan kedua).
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.tokenMcp)
      .where(
        and(
          eq(schema.tokenMcp.penggunaId, penggunaId),
          eq(schema.tokenMcp.sumber, "manual"),
          isNull(schema.tokenMcp.dicabutPada),
          or(isNull(schema.tokenMcp.kedaluwarsa), gt(schema.tokenMcp.kedaluwarsa, new Date())),
        ),
      );
    if (n >= MAKS_TOKEN_MANUAL) throw new GalatLayanan("masukan", k.t.agen.tokenPenuh);
    const { token, baris } = await terbitkanToken(tx, { penggunaId, label: m.data.label, sumber: "manual", kedaluwarsa: new Date(Date.now() + BERLAKU_MS) });
    await catatAudit(penggunaId, { sumber, jenis: "token", ringkasan: `Token agen dibuat: ${baris.label}` }, tx);
    return { token };
  });
}

export async function cabutTokenAgen(penggunaId: string, id: string, sumber: Sumber): Promise<void> {
  const k = await denganPengguna(penggunaId, (tx) => konteksPengguna(tx, penggunaId));
  if (!z.uuid().safeParse(id).success || !(await cabutToken(penggunaId, id))) throw new GalatLayanan("tidak_ditemukan", k.t.agen.tidakAda);
  await catatAudit(penggunaId, { sumber, jenis: "token", ringkasan: "Token agen dicabut" });
}
