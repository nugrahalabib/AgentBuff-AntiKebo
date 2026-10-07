import { expect, test, type Page } from "@playwright/test";
import { aturTiruan, masukSebagai, NUGI, tangkap as tangkapLayar } from "./bantu";

// P0 ujung ke ujung: halaman depan, /masuk, Masuk dengan AgentBuff lewat server tiruan
// (OIDC sungguhan: PKCE, id_token ES256, cek hak ketat), izin kabar/suara, beku, keluar.
// SIMPAN_TANGKAPAN=1 menyimpan tangkapan layar ke docs/tangkapan/p0 (diabaikan git; dilampirkan di PR).

test.describe.configure({ mode: "serial" });

const tangkap = (page: Page, nama: string) => tangkapLayar(page, "p0", nama);

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

test("kesehatan: /api/health ok dan DB tersambung", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({ ok: true, db: true });
});

test("halaman depan dan /masuk tampil dengan header keamanan", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.headers()["content-security-policy"]).toContain("nonce-");
  // `next dev` menimpa Cache-Control; produksi (CI, E2E_PRODUKSI=1) wajib membawa no-transform.
  if (process.env.CI || process.env.E2E_PRODUKSI === "1") expect(res?.headers()["cache-control"]).toContain("no-transform");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bangun beneran");
  await tangkap(page, "depan");

  await page.goto("/masuk");
  await expect(page.getByRole("heading", { name: "AntiKebo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk dengan AgentBuff" })).toBeVisible();
  await tangkap(page, "masuk");
});

test("masuk dengan AgentBuff tiruan sampai beranda, lalu keluar", async ({ page }) => {
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nugi");
  await expect(page.getByText("Belum ada alarm")).toBeVisible();
  await expect(page.getByText("Izin AgentBuff belum lengkap")).toHaveCount(0);
  await tangkap(page, "beranda");

  await page.getByRole("link", { name: "Pengaturan" }).click();
  await expect(page.getByRole("heading", { name: "Pengaturan", level: 1 })).toBeVisible();
  await expect(page.getByText("Masuk sebagai nugi@contoh.id")).toBeVisible();
  await expect(page.getByText("Diberi")).toHaveCount(2);
  await tangkap(page, "pengaturan");

  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/$/);
  // Sesi dicabut: /app mencoba masuk senyap; sesi tiruan masih ada jadi langsung kembali masuk.
  // Yang dibuktikan di sini: cookie sesi lama tidak lagi berlaku.
  const r = await page.request.get("/app", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers()["location"]).toContain("/auth/agentbuff/start?senyap=1");
});

test("izin kabar/suara ditolak: spanduk muncul, Beri izin mengulang persetujuan", async ({ page }) => {
  await masukSebagai(page, "Nugi Pratama", { kabar: false, suara: false });
  await expect(page).toHaveURL(/\/app$/);
  const spanduk = page.getByText("Izin AgentBuff belum lengkap");
  await expect(spanduk).toBeVisible();
  await tangkap(page, "beranda-izin-kurang");

  await page.getByRole("link", { name: "Beri izin" }).click();
  await expect(page.getByRole("heading", { name: "Masuk ke AntiKebo" })).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(spanduk).toHaveCount(0);
});

test("belum membeli: ditolak dengan alasan ramah dan tautan perbaikan", async ({ page }) => {
  await masukSebagai(page, "Rani Belum Beli");
  await expect(page).toHaveURL(/\/masuk\?alasan=belum_beli/);
  // Next juga memasang pengumum rute ber-role alert (#__next-route-announcer__): saring dengan teksnya.
  await expect(page.getByRole("alert").filter({ hasText: "belum memiliki AntiKebo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Perbaiki di AgentBuff" })).toBeVisible();
  await tangkap(page, "masuk-belum-beli");
});

test("hak berakhir sesudah masuk: aplikasi dibekukan, data aman", async ({ page }) => {
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await aturTiruan(NUGI, { hak: "akses_berakhir" });
  // Singgahan hak 10 menit: "Periksa ulang" memaksa pemeriksaan ketat.
  await page.goto("/api/hak/periksa");
  await expect(page.getByRole("heading", { name: "Akses dibekukan sementara" })).toBeVisible();
  await expect(page.getByText("Langganan atau masa coba AgentBuff-mu sudah berakhir")).toBeVisible();
  await tangkap(page, "beku");
});

test("tanpa sesi, /app masuk senyap lalu meminta pilih akun", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Masuk ke AntiKebo" })).toBeVisible();
  await expect(page.getByText("Server tiruan AgentBuff")).toBeVisible();
});
