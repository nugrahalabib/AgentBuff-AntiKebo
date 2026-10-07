import { expect, test, type APIRequestContext } from "@playwright/test";
import { asal, denganDb, masukSebagai, pantauGalat, tangkap } from "./bantu";

// P12: halaman Agen (PRD L3) + MCP ujung ke ujung lewat HTTP sungguhan: token manual dibuat di
// web, dipakai klien MCP untuk membuat alarm (muncul di Beranda), lalu dicabut = 401.

test.describe.configure({ mode: "serial" });

const SARI = "ab_tiruan_sari";

async function mcp(req: APIRequestContext, token: string, method: string, params: Record<string, unknown> = {}) {
  const r = await req.post("/mcp", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const teks = await r.text();
  const json = teks.trim().startsWith("{")
    ? JSON.parse(teks)
    : JSON.parse(
        teks
          .split("\n")
          .filter((b) => b.startsWith("data:"))
          .map((b) => b.slice(5))
          .join(""),
      );
  return { status: r.status(), json };
}

test("halaman Agen: token manual dipakai klien MCP membuat alarm, lalu dicabut", async ({ page }) => {
  const galat = pantauGalat(page);
  await denganDb(async (sql) => {
    await sql`update kejadian_alarm set status = 'dibatalkan' where status in ('menunggu', 'berbunyi', 'ditunda', 'cek_bangun')
      and pengguna_id = (select id from pengguna where agentbuff_sub = ${SARI})`;
    await sql`update pengguna set orientasi_selesai = now(), bahasa = 'id', zona_waktu = 'Asia/Jakarta', jam_tidur = '22:00' where agentbuff_sub = ${SARI}`;
    await sql`update token_mcp set dicabut_pada = now() where sumber = 'manual' and dicabut_pada is null
      and pengguna_id = (select id from pengguna where agentbuff_sub = ${SARI})`;
  });
  await masukSebagai(page, "Sari Pengguna Baru");
  await expect(page).toHaveURL(/\/app$/);
  const o = await asal(page);
  for (const a of ((await (await page.request.get("/api/app/alarm")).json()) as { alarm: Array<{ id: string }> }).alarm) {
    await page.request.delete(`/api/app/alarm/${a.id}`, { headers: { Origin: o } });
  }

  await page.goto("/app/pengaturan");
  await page.getByRole("link", { name: /^Agen/ }).click();
  await expect(page.getByRole("heading", { name: "Agen", level: 1 })).toBeVisible();
  await expect(page.getByText("Coba bilang ke agenmu")).toBeVisible();
  await expect(page.getByText("Bangunin aku besok jam 5 pagi buat kuliah", { exact: false })).toBeVisible();
  await tangkap(page, "p12", "agen");

  // Token manual (tampil sekali).
  await page.getByText("Lanjutan: token manual").click();
  await expect(page.getByText(/\/mcp$/)).toBeVisible();
  await page.getByRole("textbox", { name: "Label token" }).fill("Klien uji");
  await page.getByRole("button", { name: "Buat token" }).click();
  const kode = page.locator("[data-token-baru]");
  await expect(kode).toHaveText(/^antikebo_[A-Za-z0-9_-]{43}$/);
  const token = (await kode.textContent())!;
  await tangkap(page, "p12", "agen-token", { setinggiHalaman: false });

  // Klien MCP memakai token: daftar alat lengkap, buat alarm, muncul di Beranda.
  const daftar = await mcp(page.request, token, "tools/list");
  expect(daftar.status).toBe(200);
  const nama = (daftar.json.result.tools as Array<{ name: string }>).map((x) => x.name);
  expect(nama).toEqual(expect.arrayContaining(["create_alarm", "get_active_alarm", "update_preferences", "export_history"]));
  expect(nama.join(" ")).not.toMatch(/stop|snooze|dismiss|answer|solve/i);
  const buat = await mcp(page.request, token, "tools/call", {
    name: "create_alarm",
    arguments: { time: "05:40", repeat: { type: "weekdays" }, agenda_title: "Kuliah dari agen", client_ref: `e2e-${Date.now()}` },
  });
  expect(buat.json.result.isError ?? false).toBe(false);
  expect(buat.json.result.content[0].text).toContain("Alarm Kuliah dari agen dipasang");
  await page.goto("/app");
  await expect(page.getByText("Kuliah dari agen").first()).toBeVisible();

  // Aktivitas mencatat perubahan lewat agen.
  await page.goto("/app/agen");
  await expect(page.getByText("Alarm dibuat: 05:40 Kuliah dari agen").first()).toBeVisible();

  // Cabut: klien langsung 401.
  await page.getByText("Lanjutan: token manual").click();
  await page.getByRole("button", { name: "Cabut: Klien uji" }).click();
  await page.getByRole("dialog", { name: "Cabut token Klien uji?" }).getByRole("button", { name: "Ya, cabut" }).click();
  await expect(page.getByText("Token dicabut.")).toBeVisible();
  expect((await mcp(page.request, token, "tools/list")).status).toBe(401);
  expect(galat).toEqual([]);
});
