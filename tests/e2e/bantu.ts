import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

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

/** URL DB peran worker (`.env.local`) untuk menyiapkan atau memajukan keadaan dalam uji. */
export function urlWorker(): string {
  if (process.env.DATABASE_URL_WORKER) return process.env.DATABASE_URL_WORKER;
  const f = path.resolve(process.cwd(), ".env.local");
  const baris = existsSync(f) ? readFileSync(f, "utf8").split("\n") : [];
  const b = baris.find((x) => x.startsWith("DATABASE_URL_WORKER="));
  if (!b) throw new Error("DATABASE_URL_WORKER tidak ada (jalankan scripts/siapkan-lokal.sh)");
  return b.slice("DATABASE_URL_WORKER=".length);
}

export async function denganDb<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(urlWorker(), { max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 });
  }
}

/** Jawaban soal hitungan dari teksnya (×, −, ², kurung), persis seperti manusia menghitung. */
export function hitung(teks: string): string {
  const js = teks
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/(\d+)²/g, "($1*$1)")
    .replace(/=\s*\?/, "");
  if (!/^[\d\s+\-*()]+$/.test(js)) throw new Error(`teks soal tak terduga: ${teks}`);
  return String(Function(`"use strict"; return (${js});`)());
}

/**
 * Worker AntiKebo sungguhan (`pnpm worker`) untuk uji yang butuh alarm benar-benar berbunyi.
 * Menunggu log "penjadwal menyala"; fungsi kembalian menghentikan seluruh kelompok prosesnya.
 */
export async function nyalakanWorker(): Promise<() => Promise<void>> {
  const p = spawn("pnpm", ["worker"], { cwd: process.cwd(), env: { ...process.env, LOG_LEVEL: "info" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  await new Promise<void>((ok, gagal) => {
    const batas = setTimeout(() => gagal(new Error(`worker tidak menyala:\n${log.slice(-2000)}`)), 90_000);
    p.stdout!.on("data", (b: Buffer) => {
      log += String(b);
      if (log.includes("penjadwal menyala")) {
        clearTimeout(batas);
        ok();
      }
    });
    p.stderr!.on("data", (b: Buffer) => (log += String(b)));
    p.on("exit", (c) => {
      clearTimeout(batas);
      gagal(new Error(`worker keluar (${c}):\n${log.slice(-2000)}`));
    });
  });
  return async () => {
    try {
      process.kill(-p.pid!, "SIGTERM");
    } catch {
      /* sudah berhenti */
    }
    await new Promise((r) => setTimeout(r, 500));
  };
}

// ------------------------------------------------------------------ alarm (P8, P9)

export async function batalkanYangAktif() {
  await denganDb(
    (sql) =>
      sql`update kejadian_alarm set status = 'dibatalkan' where status in ('berbunyi', 'ditunda', 'cek_bangun')
          and pengguna_id = (select id from pengguna where agentbuff_sub = ${NUGI})`,
  );
}

export async function asal(page: Page) {
  return new URL(page.url()).origin;
}

/** Mulai bersih: tidak ada alarm berbunyi dan tidak ada alarm tersimpan. */
export async function bersihkan(page: Page) {
  await batalkanYangAktif();
  const o = await asal(page);
  const r = await page.request.get("/api/app/alarm");
  for (const a of ((await r.json()) as { alarm: Array<{ id: string }> }).alarm) {
    expect((await page.request.delete(`/api/app/alarm/${a.id}`, { headers: { Origin: o } })).status()).toBe(200);
  }
}

export async function buatLewatApi(page: Page, isi: Record<string, unknown>): Promise<string> {
  const r = await page.request.post("/api/app/alarm", {
    data: { jam: "23:58", soal: { jenis: "hitungan", tingkat: "ringan", benar: 1 }, spam: { kanal: [] }, ...isi },
    headers: { Origin: await asal(page) },
  });
  expect(r.status()).toBe(201);
  return ((await r.json()) as { alarm: { id: string } }).alarm.id;
}

/** Majukan kejadian `menunggu` alarm-alarm ini supaya berbunyi `detik` lagi (bawaan 2). */
export async function bunyikanSekarang(...alarmId: string[]) {
  await bunyikanDalam(2, ...alarmId);
}

export async function bunyikanDalam(detik: number, ...alarmId: string[]) {
  await denganDb((sql) => sql`update kejadian_alarm set jadwal_utc = now() + make_interval(secs => ${detik}) where status = 'menunggu' and alarm_id in ${sql(alarmId)}`);
}

/** Jawab soal hitungan yang tampil lewat papan angka. */
export async function jawabHitungan(page: Page, salah = false) {
  const teks = (await page.locator("section[aria-label] p.t-jam").first().innerText()).trim();
  const jawaban = salah ? String(Number(hitung(teks)) + 1) : hitung(teks);
  for (const a of jawaban) await page.getByRole("button", { name: a, exact: true }).click();
  await page.getByRole("button", { name: "Kirim jawaban" }).click();
}
