import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { asal, aturTiruan, bersihkan, bunyikanSekarang, buatLewatApi, denganDb, hitung, jawabHitungan, masukSebagai, NUGI, nyalakanWorker, tangkap } from "./bantu";

// P13 audit aksesibilitas (GERBANG-RILIS butir 9, WCAG 2.2 AA): axe pada SEMUA halaman di kedua
// tema (proyek desktop dan 390 px), tanpa gulir mendatar di 320 px (reflow 1.4.10) dan 640 px
// (setara zoom 200% di layar 1280, 1.4.4). Halaman prototipe desain tidak diaudit (tidak tayang).

test.describe.configure({ mode: "serial" });

const ATURAN = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type Temuan = { halaman: string; tema: string; aturan: string; dampak: string | null | undefined; target: string };

async function audit(page: Page, halaman: string): Promise<Temuan[]> {
  const temuan: Temuan[] = [];
  for (const tema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await page.waitForTimeout(150);
    const h = await new AxeBuilder({ page }).withTags(ATURAN).analyze();
    for (const v of h.violations)
      for (const n of v.nodes) temuan.push({ halaman, tema, aturan: v.id, dampak: v.impact, target: n.target.join(" ") + ` :: ${n.failureSummary?.split("\n")[1] ?? ""}` });
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  return temuan;
}

/** Lebar dokumen tidak melebihi viewport (tanpa gulir mendatar) di 320 dan 640 px. */
async function tanpaGulirMendatar(page: Page, halaman: string): Promise<string[]> {
  const asli = page.viewportSize()!;
  const salah: string[] = [];
  for (const lebar of [320, 640]) {
    await page.setViewportSize({ width: lebar, height: 800 });
    await page.waitForTimeout(150);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > lebar) salah.push(`${halaman} @${lebar}px: lebar ${w}`);
  }
  await page.setViewportSize(asli);
  return salah;
}

async function buka(page: Page, url: string, judul: RegExp | string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: judul }).first()).toBeVisible();
  await page.waitForTimeout(400);
}

let hentikanWorker: (() => Promise<void>) | null = null;
test.afterAll(async () => {
  await hentikanWorker?.();
});

test("axe 0 pelanggaran WCAG 2.2 AA di semua halaman, kedua tema, tanpa gulir mendatar di 320 dan 640 px", async ({ page }) => {
  test.setTimeout(300_000);
  const temuan: Temuan[] = [];
  const gulir: string[] = [];
  const periksa = async (nama: string) => {
    temuan.push(...(await audit(page, nama)));
    gulir.push(...(await tanpaGulirMendatar(page, nama)));
  };

  // Publik.
  await buka(page, "/", /Bangun beneran/);
  await periksa("depan");
  await buka(page, "/privasi", "Kebijakan privasi");
  await periksa("privasi");
  await tangkap(page, "p13", "privasi");
  await buka(page, "/ketentuan", "Ketentuan pemakaian");
  await periksa("ketentuan");
  await tangkap(page, "p13", "ketentuan");
  await buka(page, "/masuk?alasan=belum_beli", "AntiKebo");
  await periksa("masuk");

  // Aplikasi.
  await denganDb((sql) => sql`update pengguna set tema = 'sistem', bahasa = 'id' where agentbuff_sub = ${NUGI}`);
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const alarmId = await buatLewatApi(page, { agendaJudul: "Presentasi klien", masihBangun: { aktif: false } });
  const o = await asal(page);
  const qr = (await (await page.request.post("/api/app/kode-qr", { data: { nama: "kamar mandi a11y" }, headers: { Origin: o } })).json()) as {
    kodeQr: { id: string };
    cetak: string;
  };

  await buka(page, "/app", /Alarm|Selamat/);
  await periksa("beranda");
  await page.getByRole("button", { name: "Ubah alarm Presentasi klien" }).click();
  await expect(page.getByRole("dialog", { name: "Ubah alarm" })).toBeVisible();
  await page.waitForTimeout(500);
  temuan.push(...(await audit(page, "lembar ubah alarm")));
  await page.keyboard.press("Escape");

  for (const [url, judul] of [
    ["/app/siaga", "Siaga"],
    ["/app/riwayat", "Riwayat"],
    ["/app/pengaturan", "Pengaturan"],
    ["/app/agen", "Agen"],
    ["/app/unduh-pc", /AntiKebo untuk PC/],
    ["/app/jam-meja", "Mode Jam Meja"],
    [qr.cetak, /Kode bangun/],
    ["/sambung-pc", /PC/],
  ] as const) {
    await buka(page, url, judul);
    await periksa(url);
    if (url === "/app/pengaturan") await tangkap(page, "p13", "pengaturan");
  }
  // Rumah pintar di kedua keadaan (tidak bergantung pada uji lain): wizard belum tersambung, lalu
  // daftar perangkat sesudah tersambung ke Tuya tiruan. Sambungan diputus lagi sesudahnya.
  await fetch("http://127.0.0.1:3198/_tiruan/setel-ulang", { method: "POST" });
  await page.request.delete("/api/app/rumah/kunci", { headers: { Origin: o } });
  await buka(page, "/app/rumah", "Sambungkan rumahmu");
  await periksa("rumah belum tersambung");
  expect((await page.request.post("/api/app/rumah/kunci", { data: { kunci: "sk-SGrumahuji123456" }, headers: { Origin: o } })).ok()).toBe(true);
  await buka(page, "/app/rumah", "Rumah pintar");
  await periksa("rumah tersambung");
  await page.request.delete("/api/app/rumah/kunci", { headers: { Origin: o } });

  // Jam Meja sesudah "Mulai siaga": jam redup sengaja, teks bantu tetap wajib AA.
  await buka(page, "/app/jam-meja", "Mode Jam Meja");
  await page.getByRole("button", { name: "Mulai siaga" }).click();
  await expect(page.getByText(/^Siaga untuk/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(400);
  await periksa("jam meja siaga");
  await tangkap(page, "p13", "jam-meja-siaga", { setinggiHalaman: false });

  await page.goto("/app/orientasi?ulang=1");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForTimeout(400);
  await periksa("perkenalan");

  // Layar berbunyi dan Selamat pagi (worker sungguhan).
  hentikanWorker = await nyalakanWorker();
  await bunyikanSekarang(alarmId);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/bunyi\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Presentasi klien" })).toBeVisible();
  await page.waitForTimeout(500);
  await periksa("berbunyi");
  await jawabHitungan(page);
  await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
  await page.waitForTimeout(400);
  await periksa("selamat pagi");

  // Layar beku.
  try {
    await aturTiruan(NUGI, { hak: "akses_berakhir" });
    await page.goto("/api/hak/periksa");
    await expect(page.getByRole("heading", { name: "Akses dibekukan sementara" })).toBeVisible();
    await periksa("beku");
    await tangkap(page, "p13", "beku");
  } finally {
    await aturTiruan(NUGI, { hak: "ok" });
    await page.goto("/api/hak/periksa");
  }
  await page.request.delete(`/api/app/kode-qr/${qr.kodeQr.id}`, { headers: { Origin: o } });

  const ringkas = temuan.map((x) => `${x.halaman} [${x.tema}] ${x.aturan} (${x.dampak}): ${x.target}`);
  expect(ringkas, ringkas.join("\n")).toEqual([]);
  expect(gulir, gulir.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------ papan ketik + pembaca layar

/** Tekan Tab sampai `target` terfokus (membuktikan bisa dicapai papan ketik), lalu kembalikan. */
async function tabSampai(page: Page, target: ReturnType<Page["locator"]>, maks = 80) {
  for (let i = 0; i < maks; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`tidak tercapai dengan Tab: ${target}`);
}

async function fokusDi(dialog: ReturnType<Page["locator"]>): Promise<boolean> {
  return dialog.evaluate((d) => d.contains(document.activeElement));
}

test("lima alur utama hanya dengan papan ketik, dinilai dari peran dan nama (naskah pembaca layar)", async ({ page }) => {
  test.setTimeout(240_000);
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
  await denganDb((sql) => sql`update pengguna set tema = 'sistem', bahasa = 'id', orientasi_selesai = now() where agentbuff_sub = ${NUGI}`);

  // 1. Masuk dengan AgentBuff sampai Beranda.
  await page.goto("/masuk");
  await tabSampai(page, page.getByRole("link", { name: "Masuk dengan AgentBuff" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Masuk ke AntiKebo" })).toBeVisible();
  await tabSampai(page, page.getByLabel("Nugi Pratama"));
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Nugi Pratama")).toBeChecked();
  for (const izin of ["Kirim pesan lewat agenmu", "Buat suara memakai pengaturan suaramu"]) {
    if (!(await page.getByLabel(izin).isChecked())) {
      await tabSampai(page, page.getByLabel(izin));
      await page.keyboard.press("Space");
    }
  }
  await tabSampai(page, page.getByRole("button", { name: "Lanjutkan" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Belum ada alarm" })).toBeVisible();

  // 2. Buat alarm lewat lembar: fokus masuk ke lembar dan tertahan di dalamnya, "tersimpan" diumumkan.
  await tabSampai(page, page.getByRole("button", { name: "Pasang alarm" }));
  await page.keyboard.press("Enter");
  const lembar = page.getByRole("dialog", { name: "Alarm baru" });
  await expect(lembar).toBeVisible();
  expect(await fokusDi(lembar)).toBe(true);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    expect(await fokusDi(lembar), `Tab ke-${i + 1} keluar dari lembar`).toBe(true);
  }
  await tabSampai(page, lembar.getByRole("textbox", { name: "Mau bangun buat apa?" }));
  await page.keyboard.type("Lari pagi");
  await tabSampai(page, lembar.getByRole("button", { name: "Simpan", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.locator('[aria-live="polite"]').getByText(/^Alarm tersimpan\./)).toBeVisible();
  await expect(lembar).toHaveCount(0);
  // Esc menutup lembar dan fokus kembali ke pemicunya.
  const ubah = page.getByRole("button", { name: "Ubah alarm Lari pagi" });
  await tabSampai(page, ubah);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Ubah alarm" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(ubah).toBeFocused();

  // 3. Alarm berbunyi: soal dijawab hanya dengan mengetik angka lalu Enter.
  const daftar = (await (await page.request.get("/api/app/alarm")).json()) as { alarm: Array<{ id: string }> };
  hentikanWorker ??= await nyalakanWorker();
  await bunyikanSekarang(daftar.alarm[0].id);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/bunyi\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Lari pagi" })).toBeVisible();
  // Bawaan butuh beberapa jawaban benar berturut-turut: tiap jawaban diumumkan lewat wilayah live.
  const pagi = page.getByRole("heading", { name: "Selamat pagi, Nugi!" });
  for (let i = 0; i < 6 && !(await pagi.isVisible()); i++) {
    const soal = page.locator("section[aria-label] p.t-jam").first();
    const teks = (await soal.innerText()).trim();
    await page.keyboard.type(hitung(teks));
    await expect(page.getByRole("status", { name: "Jawaban" })).toHaveText(hitung(teks));
    await page.keyboard.press("Enter");
    // Tunggu sampai Selamat pagi tampil atau soal berikutnya muncul (soal berganti).
    await expect.poll(async () => (await pagi.isVisible()) || ((await soal.count()) > 0 && (await soal.innerText()).trim() !== teks), { timeout: 15_000 }).toBe(true);
  }
  await expect(pagi).toBeVisible();

  // 4. Pengaturan: tema gelap lewat papan ketik, lalu kembali ikut perangkat.
  await page.goto("/app/pengaturan");
  for (const [pilihan, tema] of [
    ["Gelap", "gelap"],
    ["Ikuti perangkat", "sistem"],
  ] as const) {
    await tabSampai(page, page.getByRole("button", { name: /^Tema/ }));
    await page.keyboard.press("Enter");
    const d = page.getByRole("dialog", { name: "Tema" });
    await expect(d).toBeVisible();
    await tabSampai(page, d.getByRole("radio", { checked: true }));
    const radio = d.getByRole("radio", { name: pilihan });
    for (let i = 0; i < 3 && !(await radio.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(radio).toHaveAttribute("aria-checked", "true");
    await tabSampai(page, d.getByRole("button", { name: "Simpan", exact: true }));
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-tema", tema);
  }

  // 5. Riwayat: grafik juga tersedia sebagai tabel angka.
  await page.goto("/app/riwayat");
  const tombolTabel = page.getByRole("button", { name: "Lihat tabel" });
  await tabSampai(page, tombolTabel);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Lihat grafik" })).toHaveAttribute("aria-pressed", "true");
  const tabel = page.getByRole("table", { name: "Skor bangun" });
  await expect(tabel.getByRole("columnheader", { name: "Skor" })).toBeVisible();
  await expect(tabel.getByRole("row")).toHaveCount(8);
  await tangkap(page, "p13", "riwayat-tabel");
});
