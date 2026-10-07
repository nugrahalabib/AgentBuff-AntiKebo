import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Uji peramban ujung ke ujung (tests/e2e). Menyalakan server tiruan AgentBuff + aplikasi.
// Lokal: memakai `pnpm dev` (atau yang sudah berjalan). CI dan E2E_PRODUKSI=1: `pnpm start` sesudah `pnpm build`.
// Env (DB, rahasia, tiruan) dari .env.local buatan scripts/siapkan-lokal.sh.
// Peramban: Chromium bawaan sesi cloud (/opt/pw-browsers) atau hasil `playwright install` di CI.
const CI = !!process.env.CI;
const PRODUKSI = CI || process.env.E2E_PRODUKSI === "1";
const DASAR = process.env.E2E_DASAR ?? "http://localhost:3100";
// Sesi cloud membawa Chromium sendiri; versi Playwright proyek bisa berbeda, jadi pakai jalurnya langsung.
const CHROMIUM_CLOUD = "/opt/pw-browsers/chromium";
const launchOptions = !CI && existsSync(CHROMIUM_CLOUD) ? { executablePath: CHROMIUM_CLOUD } : {};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: DASAR, trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta", launchOptions },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "hp", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: [
    { command: "pnpm tiruan", url: "http://127.0.0.1:3199/_tiruan/status", reuseExistingServer: !CI, timeout: 60_000 },
    { command: PRODUKSI ? "pnpm start" : "pnpm dev", url: `${DASAR}/api/health`, reuseExistingServer: !CI, timeout: 180_000 },
  ],
});
