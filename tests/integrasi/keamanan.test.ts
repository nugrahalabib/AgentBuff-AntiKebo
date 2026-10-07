import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { GalatLayanan } from "@/lib/layanan/dasar";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, siapkanBasisData, type Ujian } from "./harness";
import { ASAL_APP, siapkanTiruan } from "./lingkungan";

// Tinjauan keamanan P13: batas token manual, batas laju MCP per PENGGUNA (bukan per token, jadi
// membuat banyak token tidak melipatgandakannya), id palsu ditolak sebelum dipakai sebagai kunci
// batas laju atau dicari ke basis data.

let t: AgentBuffTiruan;
let u: Ujian;
const SUB = "ab_keamanan";

beforeAll(async () => {
  t = await siapkanTiruan();
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
  t.atur(SUB, { hak: "ok", nama: "Dodi Aman", email: "dodi.aman@contoh.id", izin: { kabar: true, suara: true } });
}, 60_000);
afterAll(async () => {
  await t?.tutup();
});

let urut = 1;
async function panggil(token: string, name: string, args: Record<string, unknown>) {
  const { layaniMcp } = await import("@/lib/mcp/server");
  const res = await layaniMcp(
    new Request(`${ASAL_APP}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: urut++, method: "tools/call", params: { name, arguments: args } }),
    }),
  );
  const teks = await res.text();
  const json = JSON.parse(
    teks.trim().startsWith("{")
      ? teks
      : teks
          .split("\n")
          .filter((b) => b.startsWith("data:"))
          .map((b) => b.slice(5))
          .join(""),
  ) as { result: { isError?: boolean; structuredContent: { error_code?: string; retry_after_seconds?: number } } };
  return json.result;
}

describe("token agen dan batas laju MCP", () => {
  it("paling banyak 10 token manual; batas tulis 40/menit berlaku per pengguna walau tokennya berbeda", async () => {
    const { tanganiMintaToken } = await import("@/lib/agen/otomatis");
    const otomatis = ((await tanganiMintaToken(await t.asersiMcp(SUB))).badan as { token: string }).token;
    const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, SUB));
    const { buatTokenManual } = await import("@/lib/layanan/agen");
    const manual: string[] = [];
    for (let i = 0; i < 10; i++) manual.push((await buatTokenManual(p.id, { label: `Klien ${i}` }, "web")).token);
    const g = await buatTokenManual(p.id, { label: "Kesebelas" }, "web").catch((e: unknown) => e);
    expect(g).toBeInstanceOf(GalatLayanan);
    expect((g as GalatLayanan).kode).toBe("masukan");

    // 40 perintah tulis bergantian dari 11 token: semua lolos; yang ke-41 dari token mana pun ditolak.
    const semua = [otomatis, ...manual];
    for (let i = 0; i < 40; i++) {
      const r = await panggil(semua[i % semua.length], "update_preferences", { night_reminder: i % 2 === 0 });
      expect(r.isError, `perintah ke-${i + 1}`).toBeFalsy();
    }
    const ditolak = await panggil(manual[3], "update_preferences", { night_reminder: true });
    expect(ditolak.isError).toBe(true);
    expect(ditolak.structuredContent.error_code).toBe("rate_limited");
    expect(ditolak.structuredContent.retry_after_seconds).toBeGreaterThan(0);
  }, 60_000);
});

describe("id palsu", () => {
  it("rute soal dan jawab menolak id yang bukan uuid sebelum memeriksa siapa penjawabnya", async () => {
    const { GET } = await import("@/app/api/kejadian/[id]/soal/route");
    const { POST } = await import("@/app/api/kejadian/[id]/jawab/route");
    const ctx = { params: Promise.resolve({ id: "../../bukan-id" }) };
    expect((await GET(new Request(`${ASAL_APP}/api/kejadian/x/soal`), ctx)).status).toBe(404);
    expect((await POST(new Request(`${ASAL_APP}/api/kejadian/x/jawab`, { method: "POST", body: "{}" }), ctx)).status).toBe(404);
  });
});
