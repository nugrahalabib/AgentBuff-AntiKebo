import { and, eq, gt, isNull, or } from "drizzle-orm";
import { denganHashToken, denganPengguna, schema, type Tx } from "@/lib/db";
import { acakBase64Url, sha256Hex } from "@/lib/kripto";

// Token MCP: `antikebo_` + 43 karakter base64url (256 bit). Hanya sha256-nya yang
// disimpan; token mentah ditampilkan sekali (manual) atau diantar ke AgentBuff
// (otomatis) dan tidak pernah dicatat.

export const POLA_TOKEN = /^antikebo_[A-Za-z0-9_-]{43}$/;
export type BarisToken = typeof schema.tokenMcp.$inferSelect;

export async function terbitkanToken(
  tx: Tx,
  isi: { penggunaId: string; label: string; sumber: "manual" | "agentbuff_otomatis"; kedaluwarsa: Date | null },
): Promise<{ token: string; baris: BarisToken }> {
  const token = `antikebo_${acakBase64Url(32)}`;
  const [baris] = await tx
    .insert(schema.tokenMcp)
    .values({ penggunaId: isi.penggunaId, label: isi.label.slice(0, 60), hash: sha256Hex(token), awalan: token.slice(0, 13), sumber: isi.sumber, kedaluwarsa: isi.kedaluwarsa })
    .returning();
  return { token, baris };
}

/** Token aktif dari bearer mentah, atau null. RLS: hanya baris ber-hash itu yang terlihat. */
export async function cariTokenAktif(bearer: string): Promise<BarisToken | null> {
  if (!POLA_TOKEN.test(bearer)) return null;
  const hash = sha256Hex(bearer);
  const [t] = await denganHashToken(hash, (tx) =>
    tx
      .select()
      .from(schema.tokenMcp)
      .where(and(eq(schema.tokenMcp.hash, hash), isNull(schema.tokenMcp.dicabutPada), or(isNull(schema.tokenMcp.kedaluwarsa), gt(schema.tokenMcp.kedaluwarsa, new Date()))))
      .limit(1),
  );
  return t ?? null;
}

const terakhirDitandai = new Map<string, number>();
/** Catat pemakaian paling sering sekali per menit per token (tanpa menulis tiap panggilan). */
export async function tandaiDipakai(t: BarisToken): Promise<void> {
  const kini = Date.now();
  if (kini - (terakhirDitandai.get(t.id) ?? 0) < 60_000) return;
  terakhirDitandai.set(t.id, kini);
  await denganPengguna(t.penggunaId, (tx) =>
    tx
      .update(schema.tokenMcp)
      .set({ terakhirDipakai: new Date(kini) })
      .where(eq(schema.tokenMcp.id, t.id)),
  );
}

export async function daftarToken(penggunaId: string): Promise<BarisToken[]> {
  return denganPengguna(penggunaId, (tx) =>
    tx
      .select()
      .from(schema.tokenMcp)
      .where(
        and(eq(schema.tokenMcp.penggunaId, penggunaId), isNull(schema.tokenMcp.dicabutPada), or(isNull(schema.tokenMcp.kedaluwarsa), gt(schema.tokenMcp.kedaluwarsa, new Date()))),
      ),
  );
}

export async function cabutToken(penggunaId: string, id: string): Promise<boolean> {
  const r = await denganPengguna(penggunaId, (tx) =>
    tx
      .update(schema.tokenMcp)
      .set({ dicabutPada: new Date() })
      .where(and(eq(schema.tokenMcp.penggunaId, penggunaId), eq(schema.tokenMcp.id, id), isNull(schema.tokenMcp.dicabutPada)))
      .returning({ id: schema.tokenMcp.id }),
  );
  return r.length > 0;
}
