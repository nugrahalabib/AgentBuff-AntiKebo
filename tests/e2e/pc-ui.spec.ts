import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { pantauGalat, tangkap } from "./bantu";

// P10: tampilan jendela aplikasi PC (`pc/ui`) dengan proses utama Tauri ditiru di peramban. Logika
// tampilan diuji di sini; proses utamanya (Rust) diuji `pc.spec.ts`, cargo test, dan L2.

test.skip(({ isMobile }) => isMobile, "Jendela PC berukuran tetap; cukup sekali.");

const halaman = (nama: string) => pathToFileURL(join(process.cwd(), "pc", "ui", nama)).toString();

type Panggilan = { cmd: string; args: unknown };

/** Pasang `window.__TAURI__` tiruan. `jawab` = peta perintah ke jawaban (fungsi dijalankan di peramban). */
async function tiruTauri(page: Page, awal: Record<string, unknown>, jawab: string) {
  await page.addInitScript(
    ({ awal, jawab }) => {
      const w = window as unknown as Record<string, unknown>;
      const pendengar: Record<string, Array<(e: { payload: unknown }) => void>> = {};
      const keadaan: Record<string, unknown> = structuredClone(awal);
      const panggilan: Panggilan[] = [];
      const kabar = (nama: string, payload: unknown = null) => (pendengar[nama] || []).forEach((f) => f({ payload }));
      const peta = new Function("keadaan", "kabar", `return (${jawab});`)(keadaan, kabar) as Record<string, (a: unknown) => unknown>;
      w.__uji = { keadaan, panggilan, kabar };
      w.__TAURI__ = {
        core: {
          invoke: async (cmd: string, args: unknown) => {
            panggilan.push({ cmd, args });
            const f = peta[cmd];
            if (!f) return null;
            return f(args);
          },
        },
        event: {
          listen: async (nama: string, f: (e: { payload: unknown }) => void) => {
            (pendengar[nama] ||= []).push(f);
            return () => {};
          },
        },
      };
    },
    { awal, jawab },
  );
}

const panggilan = (page: Page) => page.evaluate(() => (window as unknown as { __uji: { panggilan: Panggilan[] } }).__uji.panggilan.map((p) => p.cmd));

const PENGATURAN = `{
  keadaan: () => structuredClone(keadaan.k),
  mulai_sambung: () => { keadaan.k.kode = "KBX7-Q2MD"; kabar("keadaan"); },
  batal_sambung: () => { keadaan.k.kode = null; },
  perbaiki_tutup: () => { keadaan.k.periksa.tutupLaptop = false; },
  nyalakan_autostart: () => { keadaan.k.periksa.autostart = true; },
  jawab_dengar: (a) => { keadaan.k.dengar = a.ya; },
  keluar: () => { throw ""; },
}`;

const dasarKeadaan = {
  bahasa: "id",
  versi: "0.1.0",
  tersambung: false,
  nama: "",
  kode: null,
  galatSambung: null,
  daring: false,
  alarmBerikut: null,
  judulBerikut: null,
  periksa: { autostart: true, suara: true, tutupLaptop: null, tutupGagal: false, dicas: null },
  dengar: null,
  keluarTerkunci: null,
};

test.describe("jendela pengaturan PC", () => {
  test.use({ viewport: { width: 440, height: 760 } });

  test("belum tersambung: minta kode, tampilkan kode, batal", async ({ page }) => {
    const galat = pantauGalat(page);
    await tiruTauri(page, { k: dasarKeadaan }, PENGATURAN);
    await page.goto(halaman("index.html"));
    await expect(page.getByRole("heading", { name: "AntiKebo untuk PC" })).toBeVisible();
    await expect(page.getByText("Sambungkan sekali.")).toBeVisible();
    await tangkap(page, "p10", "pc-sambung", { setinggiHalaman: false });
    await page.getByRole("button", { name: "Sambungkan PC ini" }).click();
    await expect(page.getByText("KBX7-Q2MD")).toBeVisible();
    await expect(page.getByText("Menunggu persetujuan...")).toBeVisible();
    await tangkap(page, "p10", "pc-kode", { setinggiHalaman: false });
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(page.getByRole("button", { name: "Sambungkan PC ini" })).toBeVisible();
    expect(await panggilan(page)).toEqual(expect.arrayContaining(["mulai_sambung", "batal_sambung"]));
    expect(galat).toEqual([]);
  });

  test("tersambung: daftar periksa, perbaiki tutup laptop, tes bunyi, Keluar dikunci Komitmen", async ({ page }) => {
    const galat = pantauGalat(page);
    const k = {
      ...dasarKeadaan,
      tersambung: true,
      nama: "Nugi",
      daring: true,
      alarmBerikut: "05.00",
      judulBerikut: "Presentasi",
      periksa: { autostart: false, suara: true, tutupLaptop: true, tutupGagal: false, dicas: true },
      keluarTerkunci: "komitmen",
    };
    await tiruTauri(page, { k }, PENGATURAN);
    await page.goto(halaman("index.html"));
    await expect(page.getByText("Tersambung ke Nugi")).toBeVisible();
    await expect(page.getByText("Alarm berikutnya 05.00 · Presentasi")).toBeVisible();
    await expect(page.getByText("Tetap bangun saat laptop ditutup sambil dicas")).toBeVisible();
    await expect(page.getByText("Mode Komitmen aktif. Keluar dibuka lagi sesudah alarm selesai.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Keluar dari AntiKebo" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Putuskan PC ini" })).toBeDisabled();
    await tangkap(page, "p10", "pc-pengaturan", { setinggiHalaman: false });

    await page.getByRole("button", { name: "Perbaiki" }).click();
    await page.getByRole("button", { name: "Nyalakan" }).click();
    await expect(page.getByRole("button", { name: "Perbaiki" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nyalakan" })).toHaveCount(0);

    await page.getByRole("button", { name: "Tes bunyi" }).click();
    await expect(page.getByText("Kamu dengar?")).toBeVisible();
    await page.getByRole("button", { name: "Ya", exact: true }).click();
    await expect(page.getByText("Mantap, bunyinya sampai.")).toBeVisible();
    expect(await panggilan(page)).toEqual(expect.arrayContaining(["perbaiki_tutup", "nyalakan_autostart", "tes_bunyi", "jawab_dengar"]));
    expect(galat).toEqual([]);
  });

  test("bahasa Inggris dari pilihan pengguna", async ({ page }) => {
    await tiruTauri(page, { k: { ...dasarKeadaan, bahasa: "en" } }, PENGATURAN);
    await page.goto(halaman("index.html"));
    await expect(page.getByRole("button", { name: "Connect this PC" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AntiKebo for PC" })).toBeVisible();
  });
});

const item = {
  kunci: "a:2026-10-08",
  judul: "Presentasi klien",
  detail: "Ruang rapat lantai 3",
  jam: "05.00",
  uji: false,
  soal: { jenis: "hitungan", tingkat: "ringan", benar: 2 },
  tunda: { jatah: 1, menit: 5, terpakai: 0 },
  cekPada: null,
  cekBatas: null,
};
const ID = "7c1d2e3f-4a5b-4c6d-8e7f-90a1b2c3d4e5";
const soalServer = (teks: string, benar: number) => ({
  id: `s-${teks}`,
  tujuan: "bangun",
  jenis: "hitungan",
  tingkat: "ringan",
  tampil: { teks },
  target: 2,
  benarBeruntun: benar,
  tahap: 0,
  jumlahTahap: 1,
});

const ALARM = `{
  layar_alarm: () => structuredClone(keadaan.a),
  api_alarm: (x) => {
    if (keadaan.putus) throw "jaringan";
    if (x.metode === "GET") return { status: 200, isi: { soal: keadaan.soal[0] } };
    if (x.jalur.endsWith("/masih-bangun")) return { status: 200, isi: { status: "bangun" } };
    const s = keadaan.soal.shift();
    if (x.isi.jawaban !== s.jawab) {
      keadaan.soal.unshift({ ...s, tampil: { teks: "20 + 22" }, jawab: "42" });
      return { status: 200, isi: { hasil: "salah", soal: keadaan.soal[0] } };
    }
    if (!keadaan.soal.length) {
      setTimeout(() => { keadaan.a.layar = { mode: "selesai", item: keadaan.a.layar.item, alasan: "selesai", lagi: null }; kabar("alarm"); }, 50);
      return { status: 200, isi: { hasil: "selesai", status: "bangun", cekPada: null } };
    }
    return { status: 200, isi: { hasil: "benar", soal: keadaan.soal[0] } };
  },
  soal_luring_alarm: () => keadaan.luring,
  jawab_luring: (x) => {
    const benar = x.jawaban === "45";
    keadaan.luring = { teks: "9 × 4 + 7", target: 2, benarBeruntun: benar ? 1 : 0 };
    return { benar, lolos: false, soal: keadaan.luring };
  },
  tutup_alarm: () => { keadaan.ditutup = true; },
}`;

test.describe("jendela alarm PC", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("soal dari server: salah bergetar, benar beruntun, selesai = Selamat pagi, Oke menutup", async ({ page }) => {
    const galat = pantauGalat(page);
    const a = { layar: { mode: "berbunyi", item, kejadianId: ID, lokal: false }, daring: true, nama: "Nugi", bahasa: "id", omelan: "Nugi, bangun! Matahari sudah nunggu." };
    const soal = [
      { ...soalServer("12 + 30", 0), jawab: "42" },
      { ...soalServer("15 + 27", 1), jawab: "42" },
    ];
    await tiruTauri(page, { a, soal }, ALARM);
    await page.goto(halaman("alarm.html"));
    await expect(page.getByRole("heading", { name: "Presentasi klien" })).toBeVisible();
    await expect(page.getByText("12 + 30")).toBeVisible();
    await expect(page.getByText("Nugi, bangun! Matahari sudah nunggu.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tunda 5 menit (sisa 1)" })).toBeVisible();
    await page.mouse.move(5, 5);
    await tangkap(page, "p10", "pc-alarm", { setinggiHalaman: false });

    await page.getByRole("textbox", { name: "Jawaban" }).fill("41");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Salah, soal baru ya")).toBeVisible();
    await expect(page.getByText("20 + 22")).toBeVisible();
    await page.getByRole("textbox", { name: "Jawaban" }).fill("42");
    await page.getByRole("button", { name: "Kirim jawaban" }).click();
    await expect(page.getByText("Benar! Satu lagi")).toBeVisible();
    await page.getByRole("textbox", { name: "Jawaban" }).fill("42");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Selamat pagi, Nugi!" })).toBeVisible();
    await expect(page.locator("#pagi-agenda-judul")).toHaveText("Presentasi klien");
    await tangkap(page, "p10", "pc-pagi", { setinggiHalaman: false });
    await page.getByRole("button", { name: "Oke" }).click();
    expect(await page.evaluate(() => (window as unknown as { __uji: { keadaan: { ditutup?: boolean } } }).__uji.keadaan.ditutup)).toBe(true);
    expect(galat).toEqual([]);
  });

  test("internet putus: soal hitungan dari PC ini, tanpa tunda", async ({ page }) => {
    const galat = pantauGalat(page);
    const a = { layar: { mode: "berbunyi", item, kejadianId: ID, lokal: true }, daring: false, nama: "Nugi", bahasa: "id", omelan: null };
    await tiruTauri(page, { a, putus: true, luring: { teks: "6 × 7 + 3", target: 2, benarBeruntun: 0 } }, ALARM);
    await page.goto(halaman("alarm.html"));
    await expect(page.getByText("Soal dari PC ini", { exact: true })).toBeVisible();
    await expect(page.getByText("6 × 7 + 3")).toBeVisible();
    await expect(page.getByText("Koneksi putus. Jawab soal dari PC ini untuk mematikan alarm.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Tunda/ })).toHaveCount(0);
    await page.mouse.move(5, 5);
    await tangkap(page, "p10", "pc-alarm-luring", { setinggiHalaman: false });
    await page.getByRole("textbox", { name: "Jawaban" }).fill("45");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Benar! Satu lagi")).toBeVisible();
    await expect(page.getByText("9 × 4 + 7")).toBeVisible();
    expect(galat).toEqual([]);
  });

  test("ditunda dan Masih bangun", async ({ page }) => {
    const batas = new Date(Date.now() + 45_000).toISOString();
    const a = { layar: { mode: "cek", item: { ...item, cekBatas: batas }, kejadianId: ID }, daring: true, nama: "Nugi", bahasa: "id", omelan: null };
    await tiruTauri(page, { a, soal: [] }, ALARM);
    await page.goto(halaman("alarm.html"));
    await expect(page.getByRole("heading", { name: "Masih bangun?" })).toBeVisible();
    await expect(page.getByText(/^(4[0-5]) detik$/)).toBeVisible();
    await tangkap(page, "p10", "pc-masih-bangun", { setinggiHalaman: false });
    await page.getByRole("button", { name: "Masih!" }).click();
    await expect.poll(() => panggilan(page)).toContain("api_alarm");

    await page.evaluate(() => {
      const u = (window as unknown as { __uji: { keadaan: { a: { layar: unknown } }; kabar: (n: string) => void } }).__uji;
      u.keadaan.a.layar = {
        mode: "selesai",
        item: { judul: "Presentasi klien", jam: "05.00", uji: false, tunda: { jatah: 1, menit: 5, terpakai: 1 } },
        alasan: "ditunda",
        lagi: "05.05",
      };
      u.kabar("alarm");
    });
    await expect(page.getByRole("heading", { name: "Tidur sebentar" })).toBeVisible();
    await expect(page.getByText("Ditunda. Alarm berbunyi lagi 05.05.")).toBeVisible();
  });
});
