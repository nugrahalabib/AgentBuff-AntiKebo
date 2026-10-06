import { bacaFotoPublik, POLA_NAMA_FOTO } from "@/lib/layanan/foto";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ nama: string }> };

// Tautan rahasia foto/klip kamera (32 karakter acak = kunci aksesnya, tanpa sesi),
// supaya gambar bisa tampil di chat AgentBuff, Telegram, dan notifikasi.
// Kedaluwarsa 7 hari. Tidak pernah di-cache publik (private) dan tidak diindeks.

function tolak(status: number) {
  return new Response(status === 404 ? "Foto tidak ditemukan atau sudah lewat 7 hari." : "Permintaan tidak sah.", {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

export async function GET(req: Request, { params }: Param) {
  const { nama } = await params;
  const m = POLA_NAMA_FOTO.exec(nama);
  if (!m) return tolak(404);
  let f: Awaited<ReturnType<typeof bacaFotoPublik>>;
  try {
    f = await bacaFotoPublik(m[1]);
  } catch (e) {
    log.error({ err: (e as Error)?.message }, "baca foto publik gagal");
    return tolak(503);
  }
  if (!f) return tolak(404);

  const umur = Math.max(0, Math.floor((f.kedaluwarsa.getTime() - Date.now()) / 1000));
  const dasar: Record<string, string> = {
    "content-type": f.mime,
    "cache-control": `private, max-age=${Math.min(umur, 86_400)}`,
    "x-robots-tag": "noindex, nofollow",
    "content-disposition": "inline",
    "accept-ranges": "bytes",
    "last-modified": f.dibuat.toUTCString(),
  };

  // Range: pemutar video (terutama Safari) meminta potongan, bukan seluruh berkas.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const total = f.isi.length;
    let mulai = range[1] ? Number(range[1]) : total - Number(range[2]);
    let akhir = range[1] && range[2] ? Number(range[2]) : total - 1;
    mulai = Math.max(0, mulai);
    akhir = Math.min(akhir, total - 1);
    if (mulai > akhir || mulai >= total) {
      return new Response(null, { status: 416, headers: { ...dasar, "content-range": `bytes */${total}` } });
    }
    const potong = f.isi.subarray(mulai, akhir + 1);
    return new Response(new Uint8Array(potong), {
      status: 206,
      headers: { ...dasar, "content-range": `bytes ${mulai}-${akhir}/${total}`, "content-length": String(potong.length) },
    });
  }
  return new Response(new Uint8Array(f.isi), { status: 200, headers: { ...dasar, "content-length": String(f.isi.length) } });
}
