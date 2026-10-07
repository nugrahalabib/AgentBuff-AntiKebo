import { en } from "./kamus/en";
import { id } from "./kamus/id";

/**
 * Potongan kamus untuk aplikasi PC (docs/09-APLIKASI-PC.md): jendela pengaturan, jendela alarm,
 * baki, dan notifikasi memakai teks dari kamus yang SAMA dengan web (aturan teknis 8). Ditulis ke
 * `pc/ui/kamus.js` (tampilan) dan `pc/ui/kamus.json` (baki dan notifikasi di Rust) oleh
 * `scripts/kamus-pc.ts`; tes `tests/unit/kamus-pc.test.ts` memastikan salinannya tidak basi.
 */
export function kamusPc() {
  const potong = (k: typeof id | typeof en) => ({ merek: { nama: k.merek.nama }, umum: k.umum, pc: k.pc, bunyi: k.bunyi, pagi: k.pagi, cek: k.cek });
  return { id: potong(id), en: potong(en) };
}

export function berkasKamusPc(): { js: string; json: string } {
  const isi = JSON.stringify(kamusPc(), null, 2);
  return {
    js: `// Dibuat scripts/kamus-pc.ts dari src/lib/i18n/kamus. Jangan diubah tangan.\nwindow.KAMUS = ${isi};\n`,
    json: `${isi}\n`,
  };
}
