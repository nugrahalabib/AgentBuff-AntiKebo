import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { z } from "zod";
import { envOpsional } from "@/lib/env";

/**
 * Unduhan aplikasi PC (docs/09-APLIKASI-PC.md §8). Berkas hasil CI Windows (`.github/workflows/pc.yml`)
 * diunggah sesi laptop ke `UNDUH_DIR/pc/` saat rilis; repo tidak pernah menyimpan pemasang.
 *
 *  - `antikebo-pc.json`  : metadata pemasang terbaru (versi, nama berkas, ukuran, SHA-256).
 *  - `antikebo-pc-setup.exe` : alamat tetap yang selalu menyajikan pemasang terbaru.
 *  - `pembaruan.json` + `*.exe` + `*.sig` : untuk pembaruan otomatis bertanda tangan.
 */

export function folderUnduhPc(): string {
  return path.join(path.resolve(envOpsional("UNDUH_DIR") ?? path.join(process.cwd(), "unduh")), "pc");
}

const SkemaInfo = z.strictObject({
  versi: z.string().regex(/^\d+\.\d+\.\d+$/),
  berkas: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.exe$/),
  ukuran: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  tanggal: z.string().max(40),
});
export type InfoUnduhPc = z.infer<typeof SkemaInfo>;

/** Metadata pemasang terbaru, atau null bila belum ada rilis PC (halaman unduh menampilkan "segera"). */
export async function infoUnduhPc(): Promise<InfoUnduhPc | null> {
  try {
    const h = SkemaInfo.safeParse(JSON.parse(await readFile(path.join(folderUnduhPc(), "antikebo-pc.json"), "utf8")));
    if (!h.success) return null;
    await stat(path.join(folderUnduhPc(), h.data.berkas));
    return h.data;
  } catch {
    return null;
  }
}

export const ALAMAT_TETAP = "antikebo-pc-setup.exe";
const NAMA_SAH = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(exe|sig|json)$/;

export type BerkasUnduh = { aliran: ReadableStream<Uint8Array>; ukuran: number; jenis: string; unduhan: string | null; simpan: string };

/** Buka berkas di `/unduh/pc/<nama>`; nama aneh atau berkas tidak ada = null (404). */
export async function bukaBerkasUnduh(nama: string): Promise<BerkasUnduh | null> {
  let n = nama;
  if (n === ALAMAT_TETAP) {
    const info = await infoUnduhPc();
    if (!info) return null;
    n = info.berkas;
  }
  if (!NAMA_SAH.test(n) || n === "antikebo-pc.json") return null;
  const p = path.join(folderUnduhPc(), n);
  try {
    const s = await stat(p);
    if (!s.isFile()) return null;
    const exe = n.endsWith(".exe");
    return {
      aliran: Readable.toWeb(createReadStream(p)) as ReadableStream<Uint8Array>,
      ukuran: s.size,
      jenis: exe ? "application/vnd.microsoft.portable-executable" : n.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8",
      unduhan: exe ? (nama === ALAMAT_TETAP ? ALAMAT_TETAP : n) : null,
      // Manifest pembaruan dan alamat tetap selalu dibaca ulang; berkas berversi tidak pernah berubah.
      simpan: nama === ALAMAT_TETAP || n === "pembaruan.json" ? "no-cache" : "public, max-age=31536000, immutable",
    };
  } catch {
    return null;
  }
}
