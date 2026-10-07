import { expect, test, type Page } from "@playwright/test";

export const TIRUAN = "http://127.0.0.1:3199";
export const NUGI = "ab_tiruan_nugi";

/** Atur akun di server tiruan AgentBuff (hak, izin). */
export async function aturTiruan(sub: string, isi: Record<string, unknown>) {
  const r = await fetch(`${TIRUAN}/_tiruan/pengguna`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sub, ...isi }) });
  expect(r.ok).toBeTruthy();
}

/** Masuk dengan AgentBuff lewat layar pilih akun server tiruan. */
export async function masukSebagai(page: Page, nama: string, izin: { kabar: boolean; suara: boolean } = { kabar: true, suara: true }, mulai = "/masuk") {
  await page.goto(mulai);
  if (mulai === "/masuk") await page.getByRole("link", { name: "Masuk dengan AgentBuff" }).click();
  await expect(page.getByRole("heading", { name: "Masuk ke AntiKebo" })).toBeVisible();
  await page.getByLabel(nama).check();
  await page.getByLabel("Kirim pesan lewat agenmu").setChecked(izin.kabar);
  await page.getByLabel("Buat suara memakai pengaturan suaramu").setChecked(izin.suara);
  await page.getByRole("button", { name: "Lanjutkan" }).click();
}

/**
 * Tangkapan layar untuk PR (SIMPAN_TANGKAPAN=1): terang + gelap, ke docs/tangkapan/<folder>
 * (diabaikan git). Latar `position: fixed` hanya selebar viewport, jadi viewport dibuat setinggi
 * halaman supaya tangkapan sama dengan yang dilihat saat menggulir.
 */
export async function tangkap(page: Page, folder: string, nama: string, opsi: { setinggiHalaman?: boolean } = {}) {
  if (process.env.SIMPAN_TANGKAPAN !== "1") return;
  const proyek = test.info().project.name;
  const asli = page.viewportSize()!;
  if (opsi.setinggiHalaman !== false) {
    const tinggi = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: asli.width, height: Math.max(asli.height, Math.min(tinggi, 4000)) });
  }
  for (const tema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `docs/tangkapan/${folder}/${nama}-${proyek}-${tema === "light" ? "terang" : "gelap"}.jpg`, type: "jpeg", quality: 82 });
  }
  await page.setViewportSize(asli);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
}

/** Kumpulkan galat konsol & halaman (hidrasi, React) supaya uji gagal bila ada. */
export function pantauGalat(page: Page): string[] {
  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") galat.push(`console: ${m.text()}`);
  });
  return galat;
}
