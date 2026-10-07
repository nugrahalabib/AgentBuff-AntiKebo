/**
 * Bangun ulang bunyi alarm (docs/10-SUARA.md §1): `pnpm exec tsx scripts/bangun-bunyi.ts`.
 * Hasil (deterministik) ditulis ke public/bunyi/<id>.wav + bunyi.json. Tes
 * tests/unit/bunyi.test.ts gagal bila berkas di repo berbeda dari hasil skrip ini.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bangunBunyi, ID_BUNYI } from "../src/lib/bunyi/sintesis";

const folder = path.resolve(import.meta.dirname, "../public/bunyi");
mkdirSync(folder, { recursive: true });
const daftar = ID_BUNYI.map((id) => {
  const b = bangunBunyi(id);
  writeFileSync(path.join(folder, `${id}.wav`), b.wav);
  return { id, berkas: `/bunyi/${id}.wav`, durasiMs: b.durasiMs, lufs: b.lufs, puncakDb: b.puncakDb, naikDtk: b.naikDtk, bait: b.wav.length };
});
writeFileSync(path.join(folder, "bunyi.json"), `${JSON.stringify({ laju: 22050, format: "wav-pcm16-mono", bunyi: daftar }, null, 2)}\n`);
for (const d of daftar)
  console.log(`${d.id.padEnd(10)} ${String(d.durasiMs).padStart(5)} ms  ${d.lufs.toFixed(1)} LUFS  puncak ${d.puncakDb.toFixed(1)} dB  ${Math.round(d.bait / 1024)} KB`);
