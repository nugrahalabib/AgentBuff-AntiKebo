import { expect, test } from "@playwright/test";
import { DAFTAR_LAYAR } from "@/lib/prototipe/layar";
import { pantauGalat, tangkap } from "./bantu";

// P1: galeri prototipe semua layar dengan data contoh. Setiap layar wajib tampil tanpa galat
// konsol/hidrasi; SIMPAN_TANGKAPAN=1 menyimpan tangkapan desktop + 390 px, terang + gelap.

test("galeri prototipe mendaftar semua layar", async ({ page }) => {
  await page.goto("/prototipe");
  await expect(page.getByRole("heading", { name: "Prototipe layar" })).toBeVisible();
  await expect(page.getByRole("link")).toHaveCount(DAFTAR_LAYAR.length);
});

for (const id of DAFTAR_LAYAR) {
  test(`layar ${id} tampil tanpa galat`, async ({ page }) => {
    const galat = pantauGalat(page);
    const res = await page.goto(`/prototipe/${id}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main, [role=dialog], h1").first()).toBeVisible();
    if (id === "ubah") await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(300);
    expect(galat).toEqual([]);
    await tangkap(page, "p1", id, { setinggiHalaman: !["ubah", "bunyiHitungan", "bunyiQr", "cek", "jamMejaSiaga", "pagi", "orientasi"].includes(id) });
  });
}

test("berbunyi: jawaban salah bergetar + pesan, benar menambah titik beruntun", async ({ page }) => {
  await page.goto("/prototipe/bunyiHitungan");
  await page.getByRole("button", { name: "1" }).click();
  await page.getByRole("button", { name: "Kirim jawaban" }).click();
  await expect(page.getByText("Salah, soal baru ya")).toBeVisible();
  for (const a of ["6", "9"]) await page.getByRole("button", { name: a, exact: true }).click();
  await page.getByRole("button", { name: "Kirim jawaban" }).click();
  await expect(page.getByText("Benar! Satu lagi")).toBeVisible();
});

test("roda jam bisa dipakai dengan papan ketik", async ({ page }) => {
  await page.goto("/prototipe/ubah");
  const jam = page.getByRole("spinbutton", { name: "Jam" });
  await expect(jam).toHaveAttribute("aria-valuenow", "5");
  await jam.focus();
  await page.keyboard.press("ArrowDown");
  await expect(jam).toHaveAttribute("aria-valuenow", "6");
});
