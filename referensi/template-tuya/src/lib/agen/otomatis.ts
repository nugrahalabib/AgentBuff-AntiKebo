import { and, eq, isNull, or, gt } from "drizzle-orm";
import { createRemoteJWKSet, errors as galatJose, jwtVerify, type JWTPayload } from "jose";
import { cekHak } from "@/lib/agentbuff/status";
import { db, denganPengguna, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { catatAktivitas } from "@/lib/layanan/aktivitas";
import { log } from "@/lib/log";
import { terbitkanToken } from "./token";

// Sambung MCP otomatis (kontrak AgentBuff Docs/MASUK-DENGAN-AGENTBUFF.md):
// AgentBuff menandatangani assertion ES256 (kunci "Masuk") -> kita menerbitkan
// token MCP biasa untuk pemilik. Pemilik dicari HANYA lewat `sub` pairwise.
// Pemilik yang belum pernah membuka tuya.agentbuff.id tetap dilayani: akunnya
// dibuat di sini (sesudah hak dicek ketat), sehingga agen langsung tahu kondisi
// "belum tersambung" dan bisa memandu pengguna, bukan 404 yang membuat
// konektor terlihat rusak.

export const LABEL_OTOMATIS = "AgentBuff (otomatis)";
const UMUR_TOKEN_MS = 90 * 24 * 60 * 60 * 1000;
const TENGGANG_TOKEN_LAMA_MS = 10 * 60 * 1000;
const UMUR_MAKS_ASSERTION_DTK = 120;
const TOLERANSI_JAM_DTK = 60;
const SIMPAN_JTI_MIN_MS = 5 * 60 * 1000;

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(`${env("AGENTBUFF_ISSUER")}/jwks`), { cooldownDuration: 30_000, timeoutDuration: 8_000 });
  return _jwks;
}

export type HasilOtomatis =
  | { status: 200; badan: { token: string; expires_at: string; tenant_name: string } }
  | { status: 401; badan: { error: "assertion_invalid" } }
  | { status: 403; badan: { error: "tidak_berhak"; reason: string } }
  | { status: 429; badan: { error: "terlalu_sering" } };

const TIDAK_SAH = { status: 401, badan: { error: "assertion_invalid" } } as const;

/** Verifikasi assertion -> klaim, atau null. Gagal apa pun = null. */
export async function verifikasiAssertion(assertion: string, kunci: Parameters<typeof jwtVerify>[1] = jwks()): Promise<(JWTPayload & { sub: string; jti: string }) | null> {
  try {
    const { payload, protectedHeader } = await jwtVerify(assertion, kunci, {
      issuer: env("AGENTBUFF_ISSUER"),
      audience: env("AGENTBUFF_MASUK_CLIENT_ID"),
      algorithms: ["ES256"],
      typ: "mcp-token+jwt",
      clockTolerance: TOLERANSI_JAM_DTK,
      requiredClaims: ["sub", "jti", "iat", "exp"],
    });
    if (protectedHeader.alg !== "ES256" || !protectedHeader.kid) return null;
    // id_token biasa tidak punya `purpose` dan WAJIB ditolak.
    if (payload.purpose !== "mcp_token") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp - payload.iat > UMUR_MAKS_ASSERTION_DTK) return null;
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.jti !== "string" || !payload.jti || payload.jti.length > 200) return null;
    return payload as JWTPayload & { sub: string; jti: string };
  } catch (e) {
    if (!(e instanceof galatJose.JOSEError)) log.warn({ err: (e as Error)?.name }, "verifikasi assertion mcp-token gagal");
    return null;
  }
}

/** Simpan jti; false bila sudah pernah dipakai (replay). */
async function klaimJti(jti: string, expDtk: number): Promise<boolean> {
  const simpanSampai = new Date(Math.max(expDtk * 1000 + TOLERANSI_JAM_DTK * 1000, Date.now() + SIMPAN_JTI_MIN_MS));
  const baris = await db().insert(schema.jtiTerpakai).values({ jti, kedaluwarsa: simpanSampai }).onConflictDoNothing().returning({ jti: schema.jtiTerpakai.jti });
  return baris.length > 0;
}

const jendela = new Map<string, { mulai: number; n: number }>();
function lolosLaju(kunci: string): boolean {
  const kini = Date.now();
  const w = jendela.get(kunci);
  if (!w || kini - w.mulai > 60_000) {
    jendela.set(kunci, { mulai: kini, n: 1 });
    return true;
  }
  return ++w.n <= 10;
}

export async function tanganiMintaToken(assertion: string | null, kunci?: Parameters<typeof jwtVerify>[1]): Promise<HasilOtomatis> {
  if (!assertion) return TIDAK_SAH;
  const klaim = await verifikasiAssertion(assertion, kunci);
  if (!klaim) return TIDAK_SAH;
  if (!(await klaimJti(klaim.jti, klaim.exp!))) return TIDAK_SAH;
  if (!lolosLaju(klaim.sub)) return { status: 429, badan: { error: "terlalu_sering" } };

  const email = klaim.email_verified === true && typeof klaim.email === "string" ? klaim.email.toLowerCase() : null;
  const [ada] = await db().select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, klaim.sub)).limit(1);
  const id =
    ada?.id ??
    (
      await db()
        .insert(schema.pengguna)
        .values({ agentbuffSub: klaim.sub, email, nama: typeof klaim.name === "string" ? klaim.name.slice(0, 120) : null })
        .onConflictDoUpdate({ target: schema.pengguna.agentbuffSub, set: { email } })
        .returning({ id: schema.pengguna.id })
    )[0].id;

  const hak = await cekHak({ id, agentbuffSub: klaim.sub }, { ketat: true });
  if (!hak.aktif) return { status: 403, badan: { error: "tidak_berhak", reason: hak.alasan } };

  const kini = Date.now();
  const kedaluwarsa = new Date(kini + UMUR_TOKEN_MS);
  const token = await denganPengguna(id, async (tx) => {
    // Satu token otomatis per pemilik: yang lama diberi tenggang 10 menit (agen
    // yang sedang memakai token lama tidak putus di tengah perintah).
    await tx
      .update(schema.tokenMcp)
      .set({ kedaluwarsa: new Date(kini + TENGGANG_TOKEN_LAMA_MS) })
      .where(
        and(
          eq(schema.tokenMcp.penggunaId, id),
          eq(schema.tokenMcp.sumber, "agentbuff_otomatis"),
          isNull(schema.tokenMcp.dicabutPada),
          or(isNull(schema.tokenMcp.kedaluwarsa), gt(schema.tokenMcp.kedaluwarsa, new Date(kini + TENGGANG_TOKEN_LAMA_MS))),
        ),
      );
    return (await terbitkanToken(tx, { penggunaId: id, label: LABEL_OTOMATIS, sumber: "agentbuff_otomatis", kedaluwarsa })).token;
  });
  await catatAktivitas(id, { sumber: "sistem", jenis: "token", ringkasan: "Agen AgentBuff tersambung otomatis" });
  const nama = ada?.nama ?? (typeof klaim.name === "string" ? klaim.name : null);
  return { status: 200, badan: { token, expires_at: kedaluwarsa.toISOString(), tenant_name: nama ? `Rumah ${nama.split(" ")[0]}` : "Rumahmu" } };
}
