import { expect, test, type Page } from "@playwright/test";
import { aturTiruan, bersihkan, bunyikanDalam, bunyikanSekarang, buatLewatApi, jawabHitungan, masukSebagai, NUGI, nyalakanWorker, pantauGalat, tangkap } from "./bantu";

// P9 ujung ke ujung: PWA (manifest, ikon) dan Mode Jam Meja dengan worker SUNGGUHAN: mulai siaga
// (perangkat siaga + detak + simpanan bunyi), alarm berbunyi di layar yang sama tanpa pindah
// halaman, lalu koneksi putus: perangkat berbunyi sendiri dari simpanan dan soal muncul begitu
// koneksi kembali.

test.describe.configure({ mode: "serial" });

let hentikanWorker: (() => Promise<void>) | null = null;

test.beforeAll(async () => {
  hentikanWorker = await nyalakanWorker();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  try {
    await masukSebagai(page, "Nugi Pratama");
    await expect(page).toHaveURL(/\/app$/);
    await bersihkan(page);
  } finally {
    await page.close();
    await hentikanWorker?.();
  }
});

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

async function simpanan(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const c = await caches.open("antikebo-siaga-v1");
    return (await c.keys()).map((r) => new URL(r.url).pathname).sort();
  });
}

async function mulaiSiaga(page: Page) {
  await page.goto("/app/jam-meja");
  await expect(page.getByRole("heading", { name: "Mode Jam Meja" })).toBeVisible();
  await page.getByRole("button", { name: "Mulai siaga" }).click();
  await expect(page.getByText(/^Siaga untuk/)).toBeVisible({ timeout: 15_000 });
}

test("PWA: manifest, ikon, dan tautan pemasangan", async ({ page }) => {
  const m = await page.request.get("/manifest.webmanifest");
  expect(m.status()).toBe(200);
  const isi = (await m.json()) as { name: string; start_url: string; display: string; icons: Array<{ src: string; sizes: string; purpose: string }> };
  expect(isi).toMatchObject({ name: "AntiKebo", start_url: "/app", display: "standalone" });
  expect(isi.icons.map((i) => `${i.sizes}:${i.purpose}`)).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
  for (const i of isi.icons) {
    const r = await page.request.get(i.src);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/png");
  }
  expect((await page.request.get("/apple-icon.png")).status()).toBe(200);
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
});

test("Jam Meja: mulai siaga, jadi perangkat siaga, simpan bunyi, alarm berbunyi di layar yang sama", async ({ page }) => {
  test.setTimeout(120_000);
  const galat = pantauGalat(page);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const id = await buatLewatApi(page, { agendaJudul: "Kuliah pagi", bunyi: "sirene", masihBangun: { aktif: false } });

  await page.goto("/app/jam-meja");
  await expect(page.getByRole("heading", { name: "Mode Jam Meja" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Pasang di layar utama" })).toBeVisible();
  await tangkap(page, "p9", "jam-meja-sebelum");
  await page.getByRole("button", { name: "Mulai siaga" }).click();
  await expect(page.getByText("Siaga untuk 23.58")).toBeVisible({ timeout: 15_000 });

  // Terdaftar sebagai perangkat siaga dengan detak baru, bunyi alarm tersimpan di perangkat.
  await expect
    .poll(async () =>
      ((await (await page.request.get("/api/app/perangkat")).json()) as { perangkat: Array<{ jenis: string; siaga: boolean }> }).perangkat.some(
        (p) => p.jenis === "web" && p.siaga,
      ),
    )
    .toBe(true);
  await expect.poll(() => simpanan(page), { timeout: 15_000 }).toContain("/bunyi/sirene.wav");
  await page.mouse.click(10, 10);
  await tangkap(page, "p9", "jam-meja-siaga", { setinggiHalaman: false });

  // Alarm berbunyi: layar alarm tampil di halaman ini juga (audio sudah dibuka "Mulai siaga").
  await bunyikanSekarang(id);
  await expect(page.getByRole("heading", { name: "Kuliah pagi" })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/app\/jam-meja$/);
  await expect(page.getByText("Ketuk layar untuk menyalakan suara")).toHaveCount(0);
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  await page.getByRole("button", { name: "Oke" }).click();
  // Kembali siaga (alarm sekali sudah lewat: tidak ada alarm 24 jam ke depan).
  await expect(page.getByText("Belum ada alarm 24 jam ke depan")).toBeVisible();
  expect(galat).toEqual([]);
});

test("Jam Meja saat koneksi putus: berbunyi sendiri dari simpanan, soal muncul begitu koneksi kembali", async ({ page, context }) => {
  test.setTimeout(150_000);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const id = await buatLewatApi(page, { agendaJudul: "Rapat pagi", masihBangun: { aktif: false } });
  await bunyikanDalam(25, id);
  await mulaiSiaga(page);
  await expect.poll(() => simpanan(page), { timeout: 15_000 }).toContain("/bunyi/klasik.wav");

  // Putus sebelum jadwal: server tetap membunyikan, perangkat tidak mendengar kabarnya.
  await context.setOffline(true);
  const bunyiTersimpan = await page.evaluate(async () => (await fetch("/bunyi/klasik.wav")).ok);
  expect(bunyiTersimpan).toBe(true);
  await expect(page.getByText("Koneksi putus. Masih bisa berbunyi, suara sudah tersimpan.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Rapat pagi" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Alarm tetap berbunyi dari perangkat ini. Soalnya muncul begitu koneksi kembali.")).toBeVisible();
  await tangkap(page, "p9", "jam-meja-putus", { setinggiHalaman: false });

  // Koneksi kembali: soal dari server tampil, dijawab, selesai.
  await context.setOffline(false);
  await expect(page.locator("section[aria-label] p.t-jam").first()).toBeVisible({ timeout: 30_000 });
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
});
