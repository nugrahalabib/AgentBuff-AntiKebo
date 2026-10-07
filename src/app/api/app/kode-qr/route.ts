import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { buatKodeQr, daftarKodeQr } from "@/lib/layanan/kode-qr";

export const dynamic = "force-dynamic";

/** Daftar kode QR Misi QR. */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json({ kodeQr: await daftarKodeQr(s.pengguna.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Buat kode QR baru (nama tempat). Isinya hanya muncul di halaman cetak. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    const isi = await bacaJson<{ nama?: unknown }>(req, 1_024);
    const r = await buatKodeQr(k.pengguna.id, isi?.nama, "web");
    return NextResponse.json({ kodeQr: r, cetak: `/app/kode-qr/${r.id}/cetak` }, { status: 201 });
  } catch (e) {
    return dariGalat(e);
  }
}
