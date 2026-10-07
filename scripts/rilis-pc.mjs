// Siapkan berkas rilis aplikasi PC dari hasil `tauri build` (dipakai CI Windows, docs/09 §8):
//   node scripts/rilis-pc.mjs <folder-nsis> <folder-keluar> [asal]
// Menyalin pemasang (+ tanda tangan pembaruan bila ada) dan menulis `antikebo-pc.json` (halaman
// unduh: versi, ukuran, SHA-256) serta `pembaruan.json` (updater Tauri). Isi <folder-keluar>
// diunggah apa adanya ke UNDUH_DIR/pc/ di server oleh sesi laptop saat rilis.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function siapkanRilis(dari, ke, asal = "https://antikebo.agentbuff.id", sekarang = new Date()) {
  const exe = readdirSync(dari).find((n) => /^AntiKebo_\d+\.\d+\.\d+_x64-setup\.exe$/.test(n));
  if (!exe) throw new Error(`pemasang NSIS tidak ditemukan di ${dari}`);
  const versi = exe.match(/_(\d+\.\d+\.\d+)_/)[1];
  const isi = readFileSync(path.join(dari, exe));
  const sha256 = createHash("sha256").update(isi).digest("hex");
  mkdirSync(ke, { recursive: true });
  copyFileSync(path.join(dari, exe), path.join(ke, exe));
  const info = { versi, berkas: exe, ukuran: isi.length, sha256, tanggal: sekarang.toISOString() };
  writeFileSync(path.join(ke, "antikebo-pc.json"), `${JSON.stringify(info, null, 2)}\n`);
  const sig = path.join(dari, `${exe}.sig`);
  if (existsSync(sig)) {
    copyFileSync(sig, path.join(ke, `${exe}.sig`));
    const pembaruan = {
      version: versi,
      notes: `AntiKebo untuk PC ${versi}`,
      pub_date: sekarang.toISOString(),
      platforms: { "windows-x86_64": { signature: readFileSync(sig, "utf8").trim(), url: `${asal}/unduh/pc/${exe}` } },
    };
    writeFileSync(path.join(ke, "pembaruan.json"), `${JSON.stringify(pembaruan, null, 2)}\n`);
  }
  return info;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dari, ke, asal] = process.argv.slice(2);
  if (!dari || !ke) {
    console.error("pakai: node scripts/rilis-pc.mjs <folder-nsis> <folder-keluar> [asal]");
    process.exit(2);
  }
  const info = siapkanRilis(dari, ke, asal);
  console.log(`AntiKebo untuk PC ${info.versi}: ${info.berkas} (${info.ukuran} bait)\nSHA-256 ${info.sha256}`);
}
