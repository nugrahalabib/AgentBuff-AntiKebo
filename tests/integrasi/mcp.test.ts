import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, siapkanBasisData, type Ujian } from "./harness";
import { ASAL_APP, KLIEN, siapkanTiruan } from "./lingkungan";

// MCP kosong P0 + sambung otomatis: /api/agentbuff/mcp-token (asersi ES256 dari AgentBuff
// tiruan) dan /mcp (401 sebelum JSON-RPC, initialize, tools/list, tools/call, access_frozen).

let t: AgentBuffTiruan;
let u: Ujian;
const SUB = "ab_mcp_1";
const A = () => import("@/lib/agen/otomatis");
const M = () => import("@/lib/mcp/server");

beforeAll(async () => {
  t = await siapkanTiruan();
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);
afterAll(async () => {
  await t?.tutup();
});
beforeEach(() => {
  t.atur(SUB, { hak: "ok", nama: "Nugi Pratama", email: "nugi.mcp@contoh.id", izin: { kabar: true, suara: false } });
});

async function rpc(token: string | null, method: string, params: Record<string, unknown> = {}, id = 1) {
  const { layaniMcp } = await M();
  const res = await layaniMcp(
    new Request(`${ASAL_APP}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
  const teks = await res.text();
  const json = teks.trim().startsWith("{")
    ? JSON.parse(teks)
    : JSON.parse(
        teks
          .split("\n")
          .filter((b) => b.startsWith("data:"))
          .map((b) => b.slice(5))
          .join(""),
      );
  return { status: res.status, header: res.headers, json };
}

async function tokenOtomatis(): Promise<string> {
  const { tanganiMintaToken } = await A();
  const r = await tanganiMintaToken(await t.asersiMcp(SUB));
  expect(r.status).toBe(200);
  return (r.badan as { token: string }).token;
}

describe("sambung MCP otomatis /api/agentbuff/mcp-token", () => {
  it("asersi sah: token antikebo_ 90 hari, akun dibuat bila belum ada, tercatat di audit", async () => {
    const { tanganiMintaToken } = await A();
    const r = await tanganiMintaToken(await t.asersiMcp(SUB));
    expect(r.status).toBe(200);
    const b = r.badan as { token: string; expires_at: string; tenant_name: string };
    expect(b.token).toMatch(/^antikebo_[A-Za-z0-9_-]{43}$/);
    expect(b.tenant_name).toBe("AntiKebo Nugi");
    expect(Date.parse(b.expires_at) - Date.now()).toBeGreaterThan(89 * 86_400_000);
    const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, SUB));
    const audit = await u.superuser.select().from(schema.audit).where(eq(schema.audit.penggunaId, p.id));
    expect(audit.map((a) => a.ringkasan)).toContain("Agen AgentBuff tersambung otomatis");
    // Token mentah tidak pernah disimpan.
    const token = await u.superuser.select().from(schema.tokenMcp).where(eq(schema.tokenMcp.penggunaId, p.id));
    expect(token.every((x) => x.hash !== b.token && !b.token.includes(x.hash))).toBe(true);
  });

  it("menolak: jti diputar ulang, aud lain, tanpa purpose, typ id_token, umur > 120 dtk, tanpa asersi", async () => {
    const { tanganiMintaToken } = await A();
    const sekali = await t.asersiMcp(SUB, { jti: "jti-sekali" });
    expect((await tanganiMintaToken(sekali)).status).toBe(200);
    expect(await tanganiMintaToken(sekali)).toEqual({ status: 401, badan: { error: "assertion_invalid" } });
    expect((await tanganiMintaToken(await t.asersiMcp(SUB, { aud: "aplikasi-lain" }))).status).toBe(401);
    expect((await tanganiMintaToken(await t.asersiMcp(SUB, { purpose: "login" }))).status).toBe(401);
    expect((await tanganiMintaToken(await t.asersiMcp(SUB, { typ: "JWT" }))).status).toBe(401);
    expect((await tanganiMintaToken(await t.asersiMcp(SUB, { umurDtk: 600 }))).status).toBe(401);
    expect((await tanganiMintaToken(null)).status).toBe(401);
    const idTokenBiasa = await t.tandatangani({ iss: t.issuer, aud: KLIEN.id, sub: SUB, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, jti: "x" });
    expect((await tanganiMintaToken(idTokenBiasa)).status).toBe(401);
  });

  it("pemilik tidak berhak: 403 dengan alasan", async () => {
    const { tanganiMintaToken } = await A();
    t.atur(SUB, { hak: "belum_beli" });
    expect(await tanganiMintaToken(await t.asersiMcp(SUB))).toEqual({ status: 403, badan: { error: "tidak_berhak", reason: "belum_beli" } });
  });
});

describe("/mcp", () => {
  it("401 + WWW-Authenticate sebelum JSON-RPC diurai: tanpa token, token salah", async () => {
    for (const token of [null, "antikebo_salah", `antikebo_${"x".repeat(43)}`]) {
      const r = await rpc(token, "tools/list");
      expect(r.status).toBe(401);
      expect(r.header.get("www-authenticate")).toContain('realm="antikebo"');
    }
  });

  it("initialize + tools/list: server antikebo, petunjuk, semua alat docs/11-ALAT-MCP.md", async () => {
    const token = await tokenOtomatis();
    const init = await rpc(token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "uji", version: "1" } });
    expect(init.status).toBe(200);
    expect(init.json.result.serverInfo.name).toBe("antikebo");
    expect(init.json.result.instructions).toContain("NEVER stop, snooze, or answer a ringing alarm");
    const daftar = await rpc(token, "tools/list", {}, 2);
    const nama = daftar.json.result.tools.map((x: { name: string }) => x.name);
    // Daftar wajib docs/11-ALAT-MCP.md §2 (+ alat tambahan untuk aksi web yang ada).
    for (const wajib of [
      "get_setup_status",
      "list_alarms",
      "get_alarm",
      "get_next_alarm",
      "create_alarm",
      "update_alarm",
      "delete_alarm",
      "set_alarm_enabled",
      "skip_next_alarm",
      "skip_alarm_date",
      "unskip_alarm",
      "duplicate_alarm",
      "test_alarm",
      "list_templates",
      "create_template",
      "update_template",
      "delete_template",
      "list_characters",
      "list_voices",
      "preview_voice",
      "set_custom_lines",
      "get_voice_status",
      "regenerate_voice",
      "create_wake_code",
      "list_wake_codes",
      "rename_wake_code",
      "delete_wake_code",
      "list_channels",
      "test_channel",
      "list_standby_devices",
      "get_device_setup_links",
      "rename_standby_device",
      "remove_standby_device",
      "get_home_status",
      "connect_home",
      "disconnect_home",
      "list_home_devices",
      "test_home_device",
      "get_history",
      "get_wake_stats",
      "export_history",
      "get_preferences",
      "update_preferences",
      "get_active_alarm",
    ])
      expect(nama).toContain(wajib);
    expect(new Set(nama).size).toBe(nama.length);
    // Alat pembuat menerima client_ref; alat merusak minta confirm:true.
    const alat = daftar.json.result.tools as Array<{
      name: string;
      inputSchema: { properties: Record<string, unknown>; required?: string[] };
      annotations: { destructiveHint: boolean };
    }>;
    expect(alat.find((x) => x.name === "create_alarm")!.inputSchema.properties).toHaveProperty("client_ref");
    for (const x of alat.filter((a) => a.annotations.destructiveHint)) expect(x.inputSchema.required, x.name).toContain("confirm");
    // Tidak ada alat yang bisa mematikan, menunda, atau menjawab alarm.
    expect(nama.join(" ")).not.toMatch(/stop|snooze|dismiss|answer|solve|silence/i);
  });

  it("get_setup_status: izin yang kurang + tautan beri izin; tetap jalan saat beku", async () => {
    const token = await tokenOtomatis();
    const { cekHak } = await import("@/lib/agentbuff/status");
    const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, SUB));
    await u.superuser.update(schema.pengguna).set({ izinKabar: true, izinSuara: false }).where(eq(schema.pengguna.id, p.id));
    const r = await rpc(token, "tools/call", { name: "get_setup_status", arguments: {} });
    expect(r.json.result.structuredContent).toMatchObject({
      access: "active",
      permissions: { send_messages: true, make_voice: false },
      grant_permissions_url: `${ASAL_APP}/auth/agentbuff/start?izin=1&lanjut=%2Fapp%2Fpengaturan`,
    });
    expect(r.json.result.content[0].text).toContain("buat suara omelan");

    t.atur(SUB, { hak: "akses_berakhir" });
    await cekHak({ id: p.id, agentbuffSub: SUB }, { ketat: true });
    const beku = await rpc(token, "tools/call", { name: "get_setup_status", arguments: {} }, 3);
    expect(beku.json.result.structuredContent).toMatchObject({ access: "frozen", reason: "akses_berakhir", renew_url: `${t.url}/checkout` });
  });

  it("argumen di luar skema ditolak (z.strictObject) dengan error_code validation", async () => {
    const token = await tokenOtomatis();
    const r = await rpc(token, "tools/call", { name: "get_setup_status", arguments: { matikan: true } });
    expect(r.json.result).toMatchObject({ isError: true, structuredContent: { error_code: "validation" } });
  });

  it("token dicabut langsung 401", async () => {
    const token = await tokenOtomatis();
    const { cabutToken } = await import("@/lib/agen/token");
    const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, SUB));
    const daftar = await u.superuser.select().from(schema.tokenMcp).where(eq(schema.tokenMcp.penggunaId, p.id));
    for (const d of daftar) await cabutToken(p.id, d.id);
    expect((await rpc(token, "tools/list")).status).toBe(401);
  });
});
