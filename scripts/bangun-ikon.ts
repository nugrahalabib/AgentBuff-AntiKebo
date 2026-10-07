/**
 * Bangun ikon PWA dari logo SVG (P9): `pnpm exec tsx scripts/bangun-ikon.ts`. Memakai Chromium
 * Playwright untuk merender SVG ke PNG. Hasil ditulis ke public/ikon/ dan src/app/apple-icon.png.
 *  - ikon-192/512: logo bersudut membulat dengan latar transparan (purpose "any").
 *  - ikon-maskable-512: latar penuh, gambar di zona aman 80% (Android memotongnya sendiri).
 *  - apple-icon (180): latar penuh tanpa sudut (iPhone membulatkan sendiri, transparan = hitam).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const akar = path.resolve(import.meta.dirname, "..");
const svg = readFileSync(path.join(akar, "src/app/icon.svg"), "utf8");
const isi = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const tanpaKotak = isi.replace(/<rect[^>]*\/>/, "");
const gradasi = /<defs>[\s\S]*<\/defs>/.exec(isi)?.[0] ?? "";

/** Latar penuh + gambar diperkecil `skala` di tengah. */
const penuh = (skala: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${gradasi}<rect width="64" height="64" fill="url(#g)"/>` +
  `<g transform="translate(${32 - 32 * skala} ${32 - 32 * skala}) scale(${skala})">${tanpaKotak.replace(gradasi, "")}</g></svg>`;

const KELUARAN: Array<{ berkas: string; ukuran: number; svg: string }> = [
  { berkas: "public/ikon/ikon-192.png", ukuran: 192, svg },
  { berkas: "public/ikon/ikon-512.png", ukuran: 512, svg },
  { berkas: "public/ikon/ikon-maskable-512.png", ukuran: 512, svg: penuh(0.72) },
  { berkas: "src/app/apple-icon.png", ukuran: 180, svg: penuh(0.86) },
];

const CHROMIUM_CLOUD = "/opt/pw-browsers/chromium";

async function utama() {
  const peramban = await chromium.launch(existsSync(CHROMIUM_CLOUD) ? { executablePath: CHROMIUM_CLOUD } : {});
  try {
    const page = await peramban.newPage();
    for (const k of KELUARAN) {
      await page.setViewportSize({ width: k.ukuran, height: k.ukuran });
      await page.setContent(`<html><body style="margin:0;background:transparent">${k.svg.replace("<svg ", `<svg width="${k.ukuran}" height="${k.ukuran}" `)}</body></html>`);
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: k.ukuran, height: k.ukuran } });
      mkdirSync(path.dirname(path.join(akar, k.berkas)), { recursive: true });
      writeFileSync(path.join(akar, k.berkas), png);
      console.log(`${k.berkas} ${k.ukuran}px ${Math.round(png.length / 1024)} KB`);
    }
  } finally {
    await peramban.close();
  }
}

void utama();
