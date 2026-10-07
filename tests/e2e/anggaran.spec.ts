import { expect, test, type Page } from "@playwright/test";
import { masukSebagai } from "./bantu";

// P13 anggaran performa (PRD §18): JS awal tiap halaman utama ≤ 300 KB terkirim (setelah
// kompresi), CLS < 0,1, LCP < 2,5 dtk. Hanya bermakna di build produksi (CI dan E2E_PRODUKSI=1);
// di mode pengembangan bundel tidak dipadatkan sehingga uji dilewati. Ini ukuran di mesin uji
// tanpa pembatasan jaringan: angka produksi di HP asli tetap wajib diukur (GERBANG-RILIS).

const PRODUKSI = !!process.env.CI || process.env.E2E_PRODUKSI === "1";
const BATAS_JS_KB = 300;

type Ukuran = { jsKb: number; cls: number; lcpMs: number };

/** Pengamat CLS dan LCP dipasang sekali per halaman uji (berlaku untuk setiap navigasi). */
async function pasangPengamat(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __lcp: number };
    w.__cls = 0;
    w.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      const e = l.getEntries().at(-1);
      if (e) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
}

async function ukur(page: Page, url: string): Promise<Ukuran> {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1_500);
  return page.evaluate(() => {
    const w = window as unknown as { __cls: number; __lcp: number };
    const js = performance
      .getEntriesByType("resource")
      .filter((r) => (r as PerformanceResourceTiming).initiatorType === "script" || r.name.endsWith(".js"))
      .reduce((a, r) => a + Math.max((r as PerformanceResourceTiming).transferSize, (r as PerformanceResourceTiming).encodedBodySize), 0);
    // Bila peramban tidak melaporkan LCP (mis. elemen terbesar muncul lewat animasi), cat pertama
    // (FCP) dipakai: angka 0 tidak pernah dianggap lulus.
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    return { jsKb: Math.round(js / 1024), cls: Math.round(w.__cls * 1000) / 1000, lcpMs: Math.round(w.__lcp || fcp) };
  });
}

test("JS awal ≤ 300 KB, CLS < 0,1, LCP < 2,5 dtk di halaman utama", async ({ page, browser }, info) => {
  test.skip(!PRODUKSI, "anggaran hanya diukur pada build produksi");
  // Setiap halaman diukur dengan cache dingin (konteks baru): itulah "JS awal" kunjungan pertama.
  await masukSebagai(page, "Nugi Pratama");
  const sesi = await page.context().storageState();
  const hasil: Record<string, Ukuran> = {};
  for (const [url, masuk] of [
    ["/", false],
    ["/masuk", false],
    ["/app", true],
    ["/app/riwayat", true],
    ["/app/pengaturan", true],
    ["/app/siaga", true],
    ["/app/jam-meja", true],
  ] as const) {
    const ctx = await browser.newContext({ ...info.project.use, storageState: masuk ? sesi : undefined });
    const p = await ctx.newPage();
    await pasangPengamat(p);
    hasil[url] = await ukur(p, url);
    await ctx.close();
  }
  console.log(JSON.stringify(hasil));
  for (const [url, u] of Object.entries(hasil)) {
    expect(u.jsKb, `${url} JS`).toBeLessThanOrEqual(BATAS_JS_KB);
    expect(u.cls, `${url} CLS`).toBeLessThan(0.1);
    expect(u.lcpMs, `${url} LCP`).toBeGreaterThan(0);
    expect(u.lcpMs, `${url} LCP`).toBeLessThan(2_500);
  }
});
