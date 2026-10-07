import { test, type Page } from "@playwright/test";

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
