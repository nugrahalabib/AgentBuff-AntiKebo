import { expect, test, type Page } from "@playwright/test";
import { buatKlipTiruan } from "../tiruan/suara";
import { pantauGalat, tangkap } from "./bantu";

// P5 ujung ke ujung: layar berbunyi memutar bunyi alarm + omelan dengan pemutar Web Audio sungguhan.
// Klip omelan = MP3 suara tiruan (skrip yang sama dengan server tiruan AgentBuff), disajikan di
// alamat unduh klip perangkat. Suara bawaan perangkat (speechSynthesis) diganti perekam supaya
// cadangan TTS bisa diperiksa tanpa speaker.

type Peristiwa = { j: string; i?: number; cara?: string; teks?: string; ke?: number; t: number };

const OMELAN = [
  "BANGUN, Nugi! Ini bukan hari libur!",
  "Presentasi jam sembilan, kasurnya nggak ke mana-mana!",
  "Ingat cicilan motor, Nugi!",
  "Nugi! Sudah tiga menit kamu masih molor!",
  "Lima menit, Nugi! Bangun sekarang!",
];
const AJAK = "Ketuk layar untuk menyalakan suara";

async function catatan(page: Page): Promise<Peristiwa[]> {
  return page.evaluate(() => ((window as unknown as { __pemutar?: Peristiwa[] }).__pemutar ?? []).slice());
}

async function sajikanKlip(page: Page, ada = true): Promise<string[]> {
  const diminta: string[] = [];
  await page.route("**/api/perangkat/klip/*", async (route) => {
    const hash = new URL(route.request().url()).pathname.split("/").pop()!;
    diminta.push(hash);
    if (!ada) return route.fulfill({ status: 404, body: "" });
    const k = await buatKlipTiruan({ teks: `klip ${hash.slice(0, 2)} bangun sekarang juga`, suara: "tiruan-1", gaya: "galak", perempuan: false });
    await route.fulfill({ status: 200, contentType: "audio/mpeg", body: k.audio, headers: { "Cache-Control": "private, max-age=31536000, immutable" } });
  });
  return diminta;
}

/** Ganti speechSynthesis dengan perekam: `punyaSuara` = perangkat punya suara bahasa Indonesia. */
async function suaraPerangkat(page: Page, punyaSuara: boolean) {
  await page.addInitScript((punya) => {
    const w = window as unknown as Record<string, unknown>;
    const ucapan: string[] = [];
    w.__ucapan = ucapan;
    class Ucapan {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    const suara = punya ? [{ lang: "id-ID", name: "Uji", voiceURI: "uji", default: true, localService: true }] : [];
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Ucapan });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => suara,
        speak: (u: Ucapan) => {
          ucapan.push(u.text);
          setTimeout(() => u.onend?.(), 700);
        },
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  }, punyaSuara);
}

/**
 * Kebijakan putar otomatis peramban HP: Chromium tanpa layar selalu mengizinkan audio (dan
 * `page.evaluate` Playwright ikut memberi aktivasi), jadi AudioContext dibungkus supaya mulai
 * tertahan dan hanya bisa dibuka sesaat sesudah ketukan/tombol sungguhan (`isTrusted`).
 */
async function tahanAudioSampaiKetuk(page: Page) {
  await page.addInitScript(() => {
    let ketuk = -1e9;
    for (const j of ["pointerdown", "keydown"]) window.addEventListener(j, (e) => e.isTrusted && (ketuk = performance.now()), true);
    const Asli = window.AudioContext;
    class Ditahan extends Asli {
      constructor(o?: AudioContextOptions) {
        super(o);
        void super.suspend();
      }
      override resume(): Promise<void> {
        return performance.now() - ketuk < 1_000 ? super.resume() : Promise.resolve();
      }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: Ditahan });
  });
}

/** Bila peramban menahan audio, ajakan ketuk tampil; ketukan membukanya lalu ajakan hilang. */
async function bukaAudio(page: Page) {
  const ajak = page.getByRole("button", { name: AJAK });
  await expect(ajak).toBeVisible();
  await tangkap(page, "p5", "berbunyi-ajak-ketuk", { setinggiHalaman: false });
  await ajak.click();
  await expect(ajak).toBeHidden();
}

test("berbunyi: bunyi berulang + omelan klip suara tiruan bergantian dengan jeda 3 detik, cadangan suara perangkat", async ({ page }) => {
  test.setTimeout(90_000);
  const galat = pantauGalat(page);
  await tahanAudioSampaiKetuk(page);
  await suaraPerangkat(page, true);
  const diminta = await sajikanKlip(page);
  // Layar dibuka 185 detik sesudah alarm berbunyi: kalimat menit ke-3 diputar lebih dulu.
  await page.goto("/prototipe/bunyiHitungan?klip=1&berlalu=185", { waitUntil: "load" });
  await bukaAudio(page);

  await expect.poll(async () => (await catatan(page)).filter((e) => e.j === "omelan_selesai").length, { timeout: 60_000, intervals: [500] }).toBeGreaterThanOrEqual(4);
  const c = await catatan(page);
  const bunyi = c.filter((e) => e.j === "bunyi");
  expect(bunyi).toHaveLength(1);
  expect(bunyi[0].cara).toBe("berkas");
  const omelan = c.filter((e) => e.j === "omelan");
  const selesai = c.filter((e) => e.j === "omelan_selesai");

  // Urutan: menit ke-3 dulu, lalu ketiga bahan semuanya sebelum ada yang diulang.
  expect(omelan[0]).toMatchObject({ i: 3, cara: "klip", teks: OMELAN[3] });
  expect(new Set(omelan.slice(1, 4).map((e) => e.i))).toEqual(new Set([0, 1, 2]));
  for (const e of omelan.slice(0, 4)) expect(e.cara).toBe(e.i === 2 ? "tts" : "klip");
  expect(await page.evaluate(() => (window as unknown as { __ucapan: string[] }).__ucapan)).toEqual([OMELAN[2]]);

  // Pembuka 3 detik bunyi saja, lalu jeda 3 detik di antara omelan.
  expect(omelan[0].t - bunyi[0].t).toBeGreaterThanOrEqual(2_900);
  for (let k = 1; k < 4; k++) expect(omelan[k].t - selesai[k - 1].t).toBeGreaterThanOrEqual(2_900);
  // Bunyi diredam ke 30% selama omelan, lalu kembali 100%.
  const redam = c.filter((e) => e.j === "redam").map((e) => e.ke);
  expect(redam.slice(0, 8)).toEqual([0.3, 1, 0.3, 1, 0.3, 1, 0.3, 1]);
  // Semua klip diunduh di depan (termasuk menit ke-5 yang belum waktunya).
  expect(new Set(diminta)).toEqual(new Set(["1a", "2b", "3c", "4d"].map((h) => h.repeat(32))));

  // Teks yang sedang diucapkan tampil di layar.
  const terakhir = omelan[omelan.length - 1];
  await expect(page.getByRole("marquee", { name: "Omelan yang sedang diputar" })).toContainText(terakhir.teks!);
  await tangkap(page, "p5", "berbunyi-bersuara", { setinggiHalaman: false });
  expect(galat).toEqual([]);
});

test("berbunyi tanpa klip, tanpa suara perangkat, dan berkas bunyi gagal: tetap berbunyi (nada cadangan) + omelan tampil besar", async ({ page }) => {
  test.setTimeout(60_000);
  const galat = pantauGalat(page);
  await tahanAudioSampaiKetuk(page);
  await suaraPerangkat(page, false);
  await sajikanKlip(page, false);
  await page.route("**/bunyi/klasik.wav", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/prototipe/bunyiHitungan?klip=1", { waitUntil: "load" });
  await bukaAudio(page);

  await expect.poll(async () => (await catatan(page)).filter((e) => e.j === "omelan").length, { timeout: 20_000, intervals: [300] }).toBeGreaterThanOrEqual(1);
  const c = await catatan(page);
  expect(c.find((e) => e.j === "bunyi")).toMatchObject({ cara: "nada" });
  const o = c.find((e) => e.j === "omelan")!;
  expect(o.cara).toBe("teks");
  expect([0, 1, 2]).toContain(o.i);
  // Tanpa suara: bunyi tidak diredam, teks omelan tampil besar.
  expect(c.some((e) => e.j === "redam")).toBe(false);
  await expect(page.locator("p[aria-live=polite]").filter({ hasText: o.teks! })).toBeVisible();
  await tangkap(page, "p5", "berbunyi-teks-besar", { setinggiHalaman: false });
  // Hanya galat unduhan 404 yang memang disengaja.
  expect(galat.filter((g) => !g.includes("404"))).toEqual([]);
});
