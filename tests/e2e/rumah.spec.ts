import { expect, test } from "@playwright/test";
import { aturTiruan, masukSebagai, NUGI, pantauGalat, tangkap } from "./bantu";

// P7 ujung ke ujung: wizard sambung rumah 3 langkah (kunci diperiksa ke server Tuya tiruan),
// perangkat per ruangan, uji perangkat yang benar-benar melapor, lapisan darurat tersembunyi,
// kunci ditolak = spanduk perbaikan di Rumah pintar dan Beranda.

const TUYA = "http://127.0.0.1:3198";
const KUNCI = "sk-SGrumahuji123456";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
  await fetch(`${TUYA}/_tiruan/setel-ulang`, { method: "POST" });
});

test("sambung rumah lewat wizard, lihat perangkat per ruangan, uji lampu", async ({ page }) => {
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  // Mulai bersih: putuskan bila sesi uji sebelumnya meninggalkan sambungan.
  const asal = new URL(page.url()).origin;
  await page.request.delete("/api/app/rumah/kunci", { headers: { Origin: asal } });

  await page.goto("/app/pengaturan");
  await page.getByRole("link", { name: /Rumah pintar/ }).click();
  await expect(page).toHaveURL(/\/app\/rumah$/);
  await expect(page.getByRole("heading", { name: "Sambungkan rumahmu" })).toBeVisible();
  await tangkap(page, "p7", "wizard-langkah-1");
  await page.getByRole("button", { name: "Perangkatku sudah ada di app" }).click();
  await expect(page.getByRole("heading", { name: "Ambil kunci rumahmu" })).toBeVisible();
  await page.getByRole("button", { name: "Aku sudah dapat kuncinya" }).click();
  await expect(page.getByRole("heading", { name: "Tempel kuncinya" })).toBeVisible();

  const kolom = page.getByRole("textbox", { name: "Kunci rumah" });
  await kolom.fill("bukan kunci");
  await page.getByRole("button", { name: "Sambungkan" }).click();
  await expect(page.getByText(/belum terlihat seperti kunci Tuya/)).toBeVisible();
  await kolom.fill(KUNCI);
  await expect(page.getByText("Server Singapura")).toBeVisible();
  await tangkap(page, "p7", "wizard-langkah-3");
  await page.getByRole("button", { name: "Sambungkan" }).click();
  await expect(page.getByRole("heading", { name: "Rumahmu tersambung" })).toBeVisible();
  await expect(page.getByText("6 perangkat di 1 rumah, 2 ruangan")).toBeVisible();
  await page.getByRole("link", { name: "Lihat perangkatku" }).click();

  await expect(page.getByRole("heading", { name: "Rumah pintar" })).toBeVisible();
  await expect(page.getByText("Tersambung, server Singapura")).toBeVisible();
  // Kunci tidak pernah tampil utuh.
  await expect(page.getByText(KUNCI)).toHaveCount(0);
  await expect(page.getByText("sk-SG••••3456")).toBeVisible();
  const kamar = page.getByRole("region", { name: "Kamar" });
  await expect(kamar.getByText("Lampu Kamar")).toBeVisible();
  await expect(kamar.getByText("AC Kamar")).toBeVisible();
  await expect(page.getByRole("region", { name: "Tanpa ruangan" }).getByText(/Offline/)).toBeVisible();
  // Sensor hanya dipantau: tidak ada tombol uji.
  const tamu = page.getByRole("region", { name: "Ruang Tamu" });
  await expect(tamu.getByText(/Hanya dipantau/)).toBeVisible();
  await expect(tamu.getByRole("button", { name: "Uji: Sensor Pintu" })).toHaveCount(0);
  await expect(tamu.getByRole("button", { name: "Uji: Colokan Kipas" })).toBeVisible();
  await kamar.getByRole("button", { name: "Uji: Lampu Kamar" }).click();
  await expect(page.getByText("Lampu Kamar merespons.")).toBeVisible({ timeout: 15_000 });
  const perintah = ((await (await fetch(`${TUYA}/_tiruan/perintah`)).json()) as { perintah: Array<{ id: string; properti: Record<string, unknown> }> }).perintah;
  expect(perintah.filter((p) => p.id === "lampu1").map((p) => p.properti.switch_led)).toEqual([true, false]);

  // Lapisan darurat tersembunyi di bagian Lanjutan, mati bawaannya.
  await expect(page.getByRole("switch", { name: "Nyalakan lapisan darurat" })).toHaveCount(0);
  await page.getByRole("button", { name: "Lanjutan" }).click();
  const darurat = page.getByRole("switch", { name: "Nyalakan lapisan darurat" });
  await expect(darurat).toHaveAttribute("aria-checked", "false");
  await darurat.click();
  await expect(darurat).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "Kalau belum bangun sesudah" }).getByRole("radio", { name: "15 menit" })).toHaveAttribute("aria-checked", "true");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Lampu Kamar merespons.")).toBeHidden({ timeout: 15_000 });
  await tangkap(page, "p7", "rumah-perangkat");
  await page.reload();
  await page.getByRole("button", { name: "Lanjutan" }).click();
  await expect(page.getByRole("switch", { name: "Nyalakan lapisan darurat" })).toHaveAttribute("aria-checked", "true");
  // Satu-satunya galat konsol: penolakan kunci salah yang memang disengaja di awal.
  expect(galat).toEqual([expect.stringMatching(/^console: Failed to load resource: the server responded with a status of 400 \(Bad Request\) @ \/api\/app\/rumah/)]);
});

test("kunci ditolak Tuya: spanduk perbaikan di Rumah pintar dan Beranda, perbarui kunci", async ({ page }) => {
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  const asal = new URL(page.url()).origin;
  const r = await page.request.post("/api/app/rumah/kunci", { data: { kunci: KUNCI }, headers: { Origin: asal } });
  expect(r.status()).toBe(200);
  await fetch(`${TUYA}/_tiruan/tolak`, { method: "POST", body: JSON.stringify({ kunci: KUNCI }) });
  // Aksi berikutnya (uji perangkat) membuat Tuya menolak kunci: sambungan ditandai bermasalah.
  const u = await page.request.post("/api/app/rumah/perangkat/lampu1/uji", { headers: { Origin: asal } });
  expect(u.status()).toBe(409);
  expect(((await u.json()) as { galat: string }).galat).toBe("kunci_bermasalah");

  await page.goto("/app");
  await expect(page.getByText("Kunci rumah pintar bermasalah")).toBeVisible();
  await tangkap(page, "p7", "beranda-spanduk");
  await page.goto("/app/rumah");
  await expect(page.getByText("Kunci rumah pintar bermasalah")).toBeVisible();
  await page.getByRole("link", { name: "Perbarui kunci" }).first().click();
  await expect(page.getByRole("heading", { name: "Perbarui kunci rumah" })).toBeVisible();
  // Perbarui mulai dari langkah 2 (app di HP sudah ada).
  await page.getByRole("button", { name: "Aku sudah dapat kuncinya" }).click();
  await fetch(`${TUYA}/_tiruan/setel-ulang`, { method: "POST" });
  await page.getByRole("textbox", { name: "Kunci rumah" }).fill(KUNCI);
  await page.getByRole("button", { name: "Sambungkan" }).click();
  await expect(page.getByRole("heading", { name: "Rumahmu tersambung" })).toBeVisible();
  await page.goto("/app");
  await expect(page.getByText("Kunci rumah pintar bermasalah")).toHaveCount(0);
});
