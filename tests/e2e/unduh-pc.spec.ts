import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { aturTiruan, masukSebagai, NUGI, pantauGalat, tangkap } from "./bantu";

// P10: halaman unduh AntiKebo untuk PC (docs/09 §4, §8). Berkas pemasang tiruan ditaruh di folder
// unduhan lokal (`./unduh/pc`, diabaikan git) seperti yang dilakukan rilis di server.

test.describe.configure({ mode: "serial" });

const FOLDER = join(process.cwd(), "unduh", "pc");
const BERKAS = "AntiKebo_0.1.0_x64-setup.exe";
const isi = randomBytes(3 * 1024 * 1024);
const sha = createHash("sha256").update(isi).digest("hex");
const sudahAda = existsSync(join(FOLDER, "antikebo-pc.json"));

function pasang() {
  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(join(FOLDER, BERKAS), isi);
  writeFileSync(join(FOLDER, `${BERKAS}.sig`), "tanda-tangan-uji");
  writeFileSync(join(FOLDER, "antikebo-pc.json"), JSON.stringify({ versi: "0.1.0", berkas: BERKAS, ukuran: isi.length, sha256: sha, tanggal: "2026-10-07T00:00:00Z" }));
  writeFileSync(join(FOLDER, "pembaruan.json"), JSON.stringify({ version: "0.1.0", platforms: {} }));
}

function bongkar() {
  for (const n of [BERKAS, `${BERKAS}.sig`, "antikebo-pc.json", "pembaruan.json"]) rmSync(join(FOLDER, n), { force: true });
}

test.skip(sudahAda, "Folder unduhan lokal sudah berisi rilis sungguhan; tidak ditimpa.");

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

test.afterAll(() => bongkar());

test("belum ada rilis PC: halaman unduh jujur, tanpa tautan palsu", async ({ page }) => {
  bongkar();
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await page.goto("/app/pengaturan");
  await page.getByRole("link", { name: /AntiKebo untuk PC/ }).click();
  await expect(page).toHaveURL(/\/app\/unduh-pc$/);
  await expect(page.getByRole("heading", { name: "AntiKebo untuk PC" })).toBeVisible();
  await expect(page.getByText("Pemasangnya sedang disiapkan. Coba lagi sebentar lagi ya.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Unduh untuk Windows" })).toHaveCount(0);
  expect((await page.request.get("/unduh/pc/antikebo-pc-setup.exe")).status()).toBe(404);
  expect(galat).toEqual([]);
});

test("ada rilis: tombol unduh, panduan layar biru, sidik SHA-256 yang cocok dengan berkasnya", async ({ page }) => {
  pasang();
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await page.goto("/app/unduh-pc");
  const tombol = page.getByRole("link", { name: "Unduh untuk Windows" });
  await expect(tombol).toHaveAttribute("href", "/unduh/pc/antikebo-pc-setup.exe");
  await expect(page.getByText("Windows 10 dan 11, sekitar 3 MB · Versi 0.1.0")).toBeVisible();
  await expect(page.getByText(sha)).toBeVisible();
  await expect(page.getByText('Klik tulisan "Info selengkapnya".')).toBeVisible();
  await tangkap(page, "p10", "unduh-pc");

  const r = await page.request.get("/unduh/pc/antikebo-pc-setup.exe");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-disposition"]).toBe('attachment; filename="antikebo-pc-setup.exe"');
  expect(r.headers()["cache-control"]).toBe("no-cache");
  expect(
    createHash("sha256")
      .update(await r.body())
      .digest("hex"),
  ).toBe(sha);
  // Berkas pembaruan otomatis (dibaca updater di PC tanpa sesi).
  const p = await page.request.get("/unduh/pc/pembaruan.json", { headers: { Cookie: "" } });
  expect(p.status()).toBe(200);
  expect((await page.request.get(`/unduh/pc/${BERKAS}.sig`)).status()).toBe(200);
  // Nama aneh dan metadata internal tidak disajikan.
  for (const n of ["antikebo-pc.json", "..%2F..%2Fpackage.json", "rahasia.txt", ".env.exe"]) expect((await page.request.get(`/unduh/pc/${n}`)).status(), n).toBe(404);
  expect(galat).toEqual([]);
});
