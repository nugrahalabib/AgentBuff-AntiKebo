import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { ProtocolError, Server, createMcpHandler, isJsonContentType, type AuthInfo, type CallToolResult, type McpHttpHandler, type McpRequestContext } from "@modelcontextprotocol/server";
import { z } from "zod";
import { cekHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { cariTokenAktif, tandaiDipakai } from "@/lib/agen/token";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { bacaSambungan } from "@/lib/layanan/sambungan";
import { log } from "@/lib/log";
import { ALAT_BEBAS, cariAlat, SEMUA_ALAT } from "./alat";
import { deskriptor, type KonteksAlat } from "./dasar";

// Server MCP Tuya - https://tuya.agentbuff.id/mcp. Streamable HTTP stateless
// (dua era) lewat SDK resmi. Token tidak sah -> HTTP 401 + WWW-Authenticate
// SEBELUM JSON-RPC apa pun diurai: uji koneksi AgentBuff (initialize +
// tools/list) tidak boleh lulus palsu dengan daftar alat kosong.

const NAMA_SERVER = "tuya";
const VERSI = "1.0.0";
const BATAS_BADAN = 256 * 1024;

const PETUNJUK =
  "Smart home control for the user's Smart Life / Tuya devices (any Tuya category: lights, AC, plugs, switches, curtains, fans, heaters, purifiers, humidifiers, sensors, alarms, cameras/CCTV, robot vacuums, door locks, pet feeders, valves, kitchen appliances, energy meters, IR remotes). Device names are the user's own names, usually Indonesian (e.g. 'lampu meja', 'AC kamar'): pass them as-is, the server resolves names fuzzily. Commands run immediately; reply to the user in their language with the short result text. Everything can be done from chat: control, scenes (save_scene, also from explicit actions), schedules/timers, automations (create_automation: if a sensor/device changes, do something; value_above/value_below work on ANY numeric reading such as CO2 or PM2.5), camera photos/clips (capture_camera; kept 7 days, show the returned markdown line exactly so the image appears in the AgentBuff chat and as a photo in Telegram; list_camera_photos for recent ones incl. those taken by automations; automations can take a photo when something happens via then.camera_photo) and camera settings (privacy, motion detection, night vision, pan/tilt via ptz_control), hourly device history (get_device_history), energy, weather, notifications (app, email, sms, voice call for emergencies). Every setting a device supports is controllable: use the action fields (power, brightness, color, white_temperature, light_mode, temperature, mode, fan_speed, curtain, position, timer_minutes) and, for anything else, get_device.settings + properties. Report results HONESTLY: only say a change happened when the tool says the device confirmed it; 'BELUM TERKONFIRMASI' means the device did NOT report the change, tell the user so. ACs behind an IR blaster ('AC (lewat remote IR)') must have their remote code paired once with pair_ir_ac (the user watches the AC while you test codes); after that they work like normal ACs, but their real state can't be read back: say the command was sent, not that the AC is on. If a tool returns 'not_connected' or 'key_problem', call get_setup_status and give the user its exact step-by-step text (sign in at auth.tuya.ai with the Smart Life app QR, then Hey Tuya > Toolbox > API Key > create, copy sk-...); when they paste a key starting with 'sk-', call connect_home. If 'ambiguous', ask which device (list the candidates). If 'needs_confirmation', ask the user and repeat with confirm:true. Offline devices cannot be controlled: tell the user to check power/Wi-Fi. Not possible through Tuya's API (send the user to the Smart Life app): pairing new devices, UNLOCKING door locks (lock status and unlock history are readable), live video, firmware updates, editing homes/rooms.";

type KonteksToken = KonteksAlat & { agentbuffSub: string };

async function konteksDariToken(bearer: string): Promise<KonteksToken | null> {
  const token = await cariTokenAktif(bearer);
  if (!token) return null;
  const [p] = await db().select().from(schema.pengguna).where(eq(schema.pengguna.id, token.penggunaId)).limit(1);
  if (!p || p.dihapusPada) return null;
  void tandaiDipakai(token).catch(() => {});
  return { penggunaId: p.id, token, zona: p.zonaWaktu, asal: env("APP_ORIGIN"), agentbuffSub: p.agentbuffSub };
}

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

// ------------------------------------------------------------ hasil

/** Alat yang tetap berguna sebelum rumah disambungkan. */
const TANPA_RUMAH = new Set(["get_setup_status", "connect_home", "get_activity"]);

const KODE_INGGRIS: Record<string, string> = {
  belum_tersambung: "not_connected",
  kunci_bermasalah: "key_problem",
  kunci_tidak_sah: "invalid_key",
  tidak_ditemukan: "not_found",
  ambigu: "ambiguous",
  offline: "device_offline",
  tidak_didukung: "not_supported",
  di_luar_rentang: "out_of_range",
  nilai_tidak_sah: "invalid_value",
  perlu_konfirmasi: "needs_confirmation",
  ir_belum_dipasang: "ir_code_not_paired",
  batas_laju: "rate_limited",
  tuya_gangguan: "tuya_unavailable",
  masukan: "invalid_input",
};

function hasilGalat(kode: string, pesan: string, tambahan: Record<string, unknown> = {}): CallToolResult {
  return { content: [{ type: "text", text: pesan }], structuredContent: { error_code: kode, message: pesan, ...tambahan }, isError: true };
}

async function jalankanAlat(kt: KonteksToken, nama: string, argumen: unknown): Promise<CallToolResult> {
  const a = cariAlat(nama);
  if (!a) throw new ProtocolError(-32602, `Unknown tool: ${nama}`);
  const tunggu = tungguLaju(`t:${kt.token.id}`, 120) || (a.kelas === "tulis" ? tungguLaju(`w:${kt.token.id}`, 40) : 0);
  if (tunggu) return hasilGalat("rate_limited", `Terlalu banyak perintah. Coba lagi dalam ${tunggu} detik.`, { retry_after_seconds: tunggu });

  if (!ALAT_BEBAS.has(nama)) {
    const hak = await cekHak({ id: kt.penggunaId, agentbuffSub: kt.agentbuffSub });
    if (!hak.aktif) {
      const url = tautanPerpanjang(hak.alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY"));
      return hasilGalat("access_frozen", "Akses Tuya MCP sedang dibekukan karena langganan AgentBuff atau pembelian produk tidak aktif. Rumah dan pengaturanmu tetap aman.", {
        reason: hak.alasan,
        renew_url: url?.startsWith("/") ? `${kt.asal}${url}` : url,
      });
    }
  }

  // Rumah belum disambungkan: jawab jelas "belum tersambung" + caranya, bukan
  // daftar kosong yang membuat agen mengira rumahnya memang tanpa perangkat.
  if (!TANPA_RUMAH.has(nama) && !(await bacaSambungan(kt.penggunaId))) {
    return hasilGalat("not_connected", `Rumah pengguna belum disambungkan. Panggil get_setup_status untuk langkahnya (ambil kunci di tuya.ai, tempel di chat, lalu connect_home).`, {
      connect_url: `${kt.asal}/app/sambungkan`,
    });
  }

  const parse = a.masukan.safeParse(argumen ?? {});
  if (!parse.success) return hasilGalat("invalid_input", `Argumen tidak sah: ${z.prettifyError(parse.error).slice(0, 500)}`);
  try {
    const r = await a.jalankan(kt, parse.data);
    return { content: [{ type: "text", text: r.teks.slice(0, 4000) }], structuredContent: r.data };
  } catch (e) {
    if (e instanceof GalatLayanan) {
      const kode = KODE_INGGRIS[e.kode] ?? e.kode;
      const tambahan = { ...e.tambahan, ...(kode === "not_connected" || kode === "key_problem" ? { connect_url: `${kt.asal}/app/sambungkan` } : {}) };
      return hasilGalat(kode, e.message, tambahan);
    }
    const errorId = randomUUID();
    log.error({ err: (e as Error)?.message, alat: nama, errorId }, "alat MCP gagal");
    throw new ProtocolError(-32000, "internal_error", { error_id: errorId });
  }
}

// ------------------------------------------------------------ server SDK

function konteksDari(auth: AuthInfo | undefined): KonteksToken | null {
  return (auth?.extra as { tuya?: KonteksToken } | undefined)?.tuya ?? null;
}

export function buatServer(ctx: McpRequestContext): Server {
  const kt = konteksDari(ctx.authInfo);
  const server = new Server({ name: NAMA_SERVER, version: VERSI, title: "Tuya MCP - Smart Home Connector" }, { capabilities: { tools: {} }, instructions: PETUNJUK });
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
    { error: "invalid_token", error_description: "Token Tuya MCP tidak sah, dicabut, atau kedaluwarsa." },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="tuya", error="invalid_token"', "Cache-Control": "no-store" } },
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
  const authInfo: AuthInfo = { token: "tuya", clientId: kt.token.sumber, scopes: ["tuya"], extra: { tuya: kt } };
  const ulang = new Request(req.url, { method: "POST", headers: req.headers, body: teks });
  const res = await handlerMcp().fetch(ulang, { authInfo, parsedBody });
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
  return res;
}
