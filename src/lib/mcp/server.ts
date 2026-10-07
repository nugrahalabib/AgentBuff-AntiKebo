import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  ProtocolError,
  Server,
  createMcpHandler,
  isJsonContentType,
  type AuthInfo,
  type CallToolResult,
  type McpHttpHandler,
  type McpRequestContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { cariTokenAktif, tandaiDipakai } from "@/lib/agen/token";
import { db, denganPengguna, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { bahasaSah, isi } from "@/lib/i18n";
import { kamusUntuk } from "@/lib/i18n/kamus-server";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { log } from "@/lib/log";
import { ALAT_BEBAS, cariAlat, SEMUA_ALAT } from "./alat";
import { deskriptor, skemaMasukan, type HasilAlat, type KonteksAlat } from "./dasar";

// Server MCP AntiKebo: https://antikebo.agentbuff.id/mcp. Streamable HTTP stateless
// (dua era) lewat SDK resmi. Token tidak sah: HTTP 401 + WWW-Authenticate
// SEBELUM JSON-RPC apa pun diurai, supaya uji koneksi AgentBuff (initialize +
// tools/list) tidak lulus palsu dengan daftar alat kosong.

const NAMA_SERVER = "antikebo";
const VERSI = "0.1.0";
const BATAS_BADAN = 256 * 1024;

const PETUNJUK =
  "AntiKebo is the user's anti-oversleep alarm: when it rings it does not stop until the user solves a challenge on the alarm screen. Reply to the user in their language with the short result text. Call get_setup_status first when unsure about the account or AgentBuff permissions, and give the user the exact links it returns. You can NEVER stop, snooze, or answer a ringing alarm, and must never claim an alarm was turned off: when asked, send the user the alarm screen link instead. If a tool returns access_frozen, explain politely and give renew_url; the user's alarms and settings stay safe.";

// ------------------------------------------------------------ batas laju

const jendela = new Map<string, { mulai: number; n: number }>();
function tungguLaju(kunci: string, batas: number): number {
  const kini = Date.now();
  const w = jendela.get(kunci);
  if (!w || kini - w.mulai > 60_000) {
    jendela.set(kunci, { mulai: kini, n: 1 });
    if (jendela.size > 20_000) jendela.clear();
    return 0;
  }
  w.n += 1;
  return w.n > batas ? Math.ceil((w.mulai + 60_000 - kini) / 1000) : 0;
}

// ------------------------------------------------------------ konteks & hasil

async function konteksDariToken(bearer: string): Promise<KonteksAlat | null> {
  const token = await cariTokenAktif(bearer);
  if (!token) return null;
  const [p] = await db().select().from(schema.pengguna).where(eq(schema.pengguna.id, token.penggunaId)).limit(1);
  if (!p || p.dihapusPada) return null;
  void tandaiDipakai(token).catch(() => {});
  const bahasa = bahasaSah(p.bahasa);
  return { penggunaId: p.id, agentbuffSub: p.agentbuffSub, token, zona: p.zonaWaktu, asal: env("APP_ORIGIN"), bahasa, t: kamusUntuk(bahasa) };
}

/** Kode galat layanan (Indonesia) ke kode MCP (Inggris, docs/11-ALAT-MCP.md §4). */
const KODE_INGGRIS: Record<string, string> = {
  tidak_ditemukan: "not_found",
  masukan: "validation",
  batas_laju: "rate_limited",
  perlu_izin: "permission_needed",
  perlu_perangkat: "device_required",
  komitmen_terkunci: "commitment_locked",
  sedang_berbunyi: "alarm_ringing",
  kanal_gagal: "channel_failed",
  belum_tersambung: "not_connected",
  kunci_bermasalah: "key_problem",
  kunci_tidak_sah: "invalid_key",
  offline: "device_offline",
  tidak_didukung: "not_supported",
  tuya_gangguan: "tuya_unavailable",
};

/** Kunci tambahan galat layanan ke nama Inggris untuk agen (mis. jam buka Komitmen). */
const KUNCI_INGGRIS: Record<string, string> = { terkunciSampai: "locked_until", alasan: "reason", ulangiSetelahMs: "retry_after_ms" };
const ALASAN_INGGRIS: Record<string, string> = {
  hapus: "delete",
  matikan: "turn_off",
  lewati: "skip",
  mundur: "later_time",
  komitmen_mati: "commitment_off",
  lemahkan: "weaker",
  jam_tidur: "bedtime",
  hapus_data: "delete_data",
};
function tambahanInggris(t: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(t ?? {}).map(([k, v]) => [KUNCI_INGGRIS[k] ?? k, k === "alasan" && typeof v === "string" ? (ALASAN_INGGRIS[v] ?? v) : v]));
}

function hasilGalat(kode: string, pesan: string, tambahan: Record<string, unknown> = {}): CallToolResult {
  return { content: [{ type: "text", text: pesan }], structuredContent: { error_code: kode, message: pesan, ...tambahan }, isError: true };
}

async function jalankanAlat(kt: KonteksAlat, nama: string, argumen: unknown): Promise<CallToolResult> {
  const a = cariAlat(nama);
  if (!a) throw new ProtocolError(-32602, `Unknown tool: ${nama}`);
  const tunggu = tungguLaju(`t:${kt.token.id}`, 120) || (a.kelas === "tulis" ? tungguLaju(`w:${kt.token.id}`, 40) : 0);
  if (tunggu) return hasilGalat("rate_limited", isi(kt.t.mcp.terlaluBanyak, { n: tunggu }), { retry_after_seconds: tunggu });

  if (!ALAT_BEBAS.has(nama)) {
    const hak = await cekHak({ id: kt.penggunaId, agentbuffSub: kt.agentbuffSub });
    if (!hak.aktif) {
      const url = tautanPerpanjang(hak.alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY"));
      return hasilGalat("access_frozen", kt.t.mcp.aksesDibekukan, {
        reason: hak.alasan,
        renew_url: url?.startsWith("/") ? `${kt.asal}${url}` : url,
      });
    }
  }

  const parse = skemaMasukan(a).safeParse(argumen ?? {});
  if (!parse.success) return hasilGalat("validation", isi(kt.t.mcp.argumenSalah, { isi: z.prettifyError(parse.error).slice(0, 500) }));
  const { client_ref: rujukan, ...masukan } = parse.data as Record<string, unknown> & { client_ref?: string };
  const hasil = (r: HasilAlat): CallToolResult => ({ content: [{ type: "text", text: r.teks.slice(0, 4000) }], structuredContent: r.data });
  try {
    if (a.idempoten && rujukan) {
      const klaim = await klaimRujukan(kt.penggunaId, nama, rujukan);
      if (klaim === "berjalan") return hasilGalat("in_progress", kt.t.mcp.masihDiproses, { client_ref: rujukan });
      if (klaim) return hasil({ ...klaim, data: { ...klaim.data, replayed: true } });
    }
    let r: HasilAlat;
    try {
      r = await a.jalankan(kt, masukan);
    } catch (e) {
      if (a.idempoten && rujukan) await lepasRujukan(kt.penggunaId, nama, rujukan);
      throw e;
    }
    if (a.idempoten && rujukan) await simpanRujukan(kt.penggunaId, nama, rujukan, r);
    return hasil(r);
  } catch (e) {
    if (e instanceof GalatLayanan) return hasilGalat(KODE_INGGRIS[e.kode] ?? e.kode, e.message, tambahanInggris(e.tambahan));
    const errorId = randomUUID();
    log.error({ err: (e as Error)?.message, alat: nama, errorId }, "alat MCP gagal");
    throw new ProtocolError(-32000, "internal_error", { error_id: errorId });
  }
}

// ------------------------------------------------------------ idempotensi (client_ref)

/** null = rujukan baru (sudah diklaim); "berjalan" = panggilan pertama belum selesai; selain itu hasil tersimpan. */
async function klaimRujukan(penggunaId: string, alat: string, rujukan: string): Promise<HasilAlat | "berjalan" | null> {
  return denganPengguna(penggunaId, async (tx) => {
    const baru = await tx.insert(schema.idempotensiMcp).values({ penggunaId, alat, rujukan }).onConflictDoNothing().returning({ alat: schema.idempotensiMcp.alat });
    if (baru.length) return null;
    const [ada] = await tx
      .select({ hasil: schema.idempotensiMcp.hasil })
      .from(schema.idempotensiMcp)
      .where(and(eq(schema.idempotensiMcp.penggunaId, penggunaId), eq(schema.idempotensiMcp.alat, alat), eq(schema.idempotensiMcp.rujukan, rujukan)));
    return ada?.hasil ?? "berjalan";
  });
}

async function simpanRujukan(penggunaId: string, alat: string, rujukan: string, r: HasilAlat): Promise<void> {
  await denganPengguna(penggunaId, (tx) =>
    tx
      .update(schema.idempotensiMcp)
      .set({ hasil: { data: r.data, teks: r.teks } })
      .where(and(eq(schema.idempotensiMcp.penggunaId, penggunaId), eq(schema.idempotensiMcp.alat, alat), eq(schema.idempotensiMcp.rujukan, rujukan))),
  );
}

/** Panggilan gagal: rujukan dilepas supaya agen boleh mencoba lagi dengan rujukan yang sama. */
async function lepasRujukan(penggunaId: string, alat: string, rujukan: string): Promise<void> {
  await denganPengguna(penggunaId, (tx) =>
    tx.delete(schema.idempotensiMcp).where(and(eq(schema.idempotensiMcp.penggunaId, penggunaId), eq(schema.idempotensiMcp.alat, alat), eq(schema.idempotensiMcp.rujukan, rujukan))),
  ).catch(() => undefined);
}

// ------------------------------------------------------------ server SDK

function konteksDari(auth: AuthInfo | undefined): KonteksAlat | null {
  return (auth?.extra as { antikebo?: KonteksAlat } | undefined)?.antikebo ?? null;
}

export function buatServer(ctx: McpRequestContext): Server {
  const kt = konteksDari(ctx.authInfo);
  const server = new Server({ name: NAMA_SERVER, version: VERSI, title: "AntiKebo" }, { capabilities: { tools: {} }, instructions: PETUNJUK });
  server.setRequestHandler("tools/list", async () => ({ tools: kt ? SEMUA_ALAT.map(deskriptor) : [] }));
  server.setRequestHandler("tools/call", async (req) => {
    if (!kt) throw new ProtocolError(-32001, "unauthorized");
    return jalankanAlat(kt, req.params.name, req.params.arguments);
  });
  return server;
}

let handler: McpHttpHandler | null = null;
function handlerMcp(): McpHttpHandler {
  if (!handler) {
    handler = createMcpHandler(buatServer, { legacy: "stateless", keepAliveMs: 15_000, onerror: (err) => log.warn({ err: err.message }, "mcp") });
  }
  return handler;
}

// ------------------------------------------------------------ gerbang HTTP

function tolak401(): Response {
  return Response.json(
    { error: "invalid_token", error_description: "Token AntiKebo tidak sah, dicabut, atau kedaluwarsa." },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="antikebo", error="invalid_token"', "Cache-Control": "no-store" } },
  );
}

function galatRpc(status: number, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function layaniMcp(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const kt = bearer
    ? await konteksDariToken(bearer).catch((e) => {
        log.error({ err: (e as Error)?.message }, "cari token MCP gagal");
        return null;
      })
    : null;
  if (!kt) return tolak401();

  if (req.method !== "POST") return galatRpc(405, -32000, "Method not allowed");
  if (!isJsonContentType(req.headers.get("content-type"))) return galatRpc(415, -32600, "Content-Type wajib application/json");
  const teks = await req.text();
  if (teks.length > BATAS_BADAN) return galatRpc(413, -32600, "Badan permintaan terlalu besar");
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(teks);
  } catch {
    return galatRpc(400, -32700, "Badan bukan JSON yang sah");
  }
  const authInfo: AuthInfo = { token: "antikebo", clientId: kt.token.sumber, scopes: ["antikebo"], extra: { antikebo: kt } };
  const ulang = new Request(req.url, { method: "POST", headers: req.headers, body: teks });
  const res = await handlerMcp().fetch(ulang, { authInfo, parsedBody });
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
}
