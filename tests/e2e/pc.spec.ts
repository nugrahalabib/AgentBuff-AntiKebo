import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { aturTiruan, bersihkan, bunyikanSekarang, buatLewatApi, denganDb, masukSebagai, NUGI, nyalakanWorker } from "./bantu";

// P10 ujung ke ujung: kode Rust aplikasi PC yang SAMA dengan versi Windows (klien, pengurai SSE,
// mesin alarm, soal luring; `pc/klien/src/bin/uji-pc.rs`) melawan server + worker sungguhan.
// Bagian khusus Windows (jendela, suara, volume) diuji manual di L2 (docs/09 §9).

const BIN = join(process.cwd(), "pc", "target", "debug", process.platform === "win32" ? "uji-pc.exe" : "uji-pc");

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Protokol PC cukup diuji sekali (proyek desktop).");
test.skip(!existsSync(BIN), "uji-pc belum dibangun: (cd pc && cargo build -p antikebo-klien --bin uji-pc)");

let hentikanWorker: (() => Promise<void>) | null = null;
const folder = mkdtempSync(join(tmpdir(), "antikebo-pc-"));
const TOKEN = join(folder, "token");

test.beforeAll(async () => {
  hentikanWorker = await nyalakanWorker();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: test.info().project.use.baseURL });
  try {
    await masukSebagai(page, "Nugi Pratama");
    await bersihkan(page);
    await denganDb((sql) => sql`update perangkat_siaga set dicabut_pada = now() where nama = 'PC Uji' and dicabut_pada is null`);
  } finally {
    await page.close();
    await hentikanWorker?.();
    rmSync(folder, { recursive: true, force: true });
  }
});

test.beforeEach(async () => {
  await aturTiruan(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
});

/** Jalankan uji-pc dan baca baris statusnya. */
function jalankan(mode: "server" | "luring", asal: string) {
  const baris: string[] = [];
  let log = "";
  const p: ChildProcess = spawn(BIN, [mode], { env: { ...process.env, ANTIKEBO_ASAL: asal, UJI_TOKEN: TOKEN }, stdio: ["ignore", "pipe", "pipe"] });
  let sisa = "";
  p.stdout!.on("data", (b: Buffer) => {
    sisa += String(b);
    const bagian = sisa.split("\n");
    sisa = bagian.pop()!;
    baris.push(...bagian);
  });
  p.stderr!.on("data", (b: Buffer) => (log += String(b)));
  const selesai = new Promise<number>((ok) => p.on("exit", (k) => ok(k ?? -1)));
  return {
    baris,
    async tunggu(pola: RegExp, ms = 60_000): Promise<RegExpMatchArray> {
      let m: RegExpMatchArray | null = null;
      await expect
        .poll(
          () => {
            for (const b of baris) if ((m = b.match(pola))) return true;
            return false;
          },
          { timeout: ms, message: `menunggu ${pola} dari uji-pc; baris: ${baris.join(" | ")} ${log}` },
        )
        .toBe(true);
      return m!;
    },
    selesai,
    henti: () => p.kill(),
  };
}

async function asalDari(page: Page) {
  return new URL(page.url()).origin;
}

test("PC tersambung lewat kode, alarm berbunyi dari server lewat SSE, soal dijawab, bunyi berhenti", async ({ page }) => {
  test.setTimeout(150_000);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const pc = jalankan("server", await asalDari(page));
  try {
    // Sambung sekali: kode dari aplikasi, disetujui di browser yang sudah masuk.
    const [, kode] = await pc.tunggu(/^KODE (\S+)$/);
    await page.goto(`/sambung-pc?kode=${kode}`);
    await expect(page.getByText("PC Uji")).toBeVisible();
    await page.getByRole("button", { name: "Sambungkan" }).click();
    await expect(page.getByText("PC tersambung!")).toBeVisible();
    await pc.tunggu(/^TERSAMBUNG$/);
    await pc.tunggu(/^SIAP$/);
    // Detak PC terlihat di web sebagai perangkat siaga.
    await expect
      .poll(async () =>
        ((await (await page.request.get("/api/app/perangkat")).json()) as { perangkat: Array<{ nama: string; jenis: string; siaga: boolean }> }).perangkat.some(
          (p) => p.nama === "PC Uji" && p.siaga,
        ),
      )
      .toBe(true);

    // Worker membunyikan alarm: kabar SSE sampai ke PC, mesin membunyikan, soal server dijawab.
    const id = await buatLewatApi(page, { agendaJudul: "Rapat dari PC", masihBangun: { aktif: false } });
    await bunyikanSekarang(id);
    await pc.tunggu(/^BERBUNYI server$/, 30_000);
    await pc.tunggu(/^JAWAB selesai$/);
    await pc.tunggu(/^BERHENTI Selesai$/);
    await pc.tunggu(/^SELESAI$/);
    expect(await pc.selesai).toBe(0);
    expect(pc.baris.filter((b) => b.startsWith("BERBUNYI"))).toHaveLength(1);
    const [k] = await denganDb((sql) => sql`select status, selesai_oleh from kejadian_alarm where alarm_id = ${id}`);
    expect(k).toMatchObject({ status: "bangun", selesai_oleh: "perangkat" });
  } finally {
    pc.henti();
  }
});

test("PC luring: soal hitungan dari kunci kejadian, jawabannya diperiksa ulang server", async ({ page }) => {
  test.setTimeout(150_000);
  await masukSebagai(page, "Nugi Pratama");
  await expect(page).toHaveURL(/\/app$/);
  await bersihkan(page);
  const pc = jalankan("luring", await asalDari(page));
  try {
    await pc.tunggu(/^SIAP$/);
    expect(pc.baris.some((b) => b.startsWith("KODE"))).toBe(false);
    const id = await buatLewatApi(page, { agendaJudul: "Kuliah luring", soal: { jenis: "hitungan", tingkat: "sedang", benar: 2 }, masihBangun: { aktif: false } });
    await bunyikanSekarang(id);
    await pc.tunggu(/^BERBUNYI (server|lokal)$/, 30_000);
    await pc.tunggu(/^BERHENTI luring$/);
    await pc.tunggu(/^LURING true$/);
    await pc.tunggu(/^SELESAI$/);
    expect(await pc.selesai).toBe(0);
    const [k] = await denganDb((sql) => sql`select status, selesai_oleh from kejadian_alarm where alarm_id = ${id}`);
    expect(k).toMatchObject({ status: "bangun", selesai_oleh: "luring" });
  } finally {
    pc.henti();
  }
});
