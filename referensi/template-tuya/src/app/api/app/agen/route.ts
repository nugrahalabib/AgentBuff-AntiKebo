import { daftarToken } from "@/lib/agen/token";
import { rute } from "@/lib/app/rute";
import { env } from "@/lib/env";
import { daftarAktivitas } from "@/lib/layanan/aktivitas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return rute(req, { bolehBeku: true }, async ({ pengguna }) => {
    const [token, aktivitas] = await Promise.all([daftarToken(pengguna.id), daftarAktivitas(pengguna.id, { batas: 40 })]);
    return {
      alamatMcp: `${env("APP_ORIGIN")}/mcp`,
      token: token.map((t) => ({ id: t.id, label: t.label, awalan: t.awalan, sumber: t.sumber, terakhirDipakai: t.terakhirDipakai?.toISOString() ?? null, kedaluwarsa: t.kedaluwarsa?.toISOString() ?? null, dibuat: t.dibuat.toISOString() })),
      aktivitas: aktivitas.map((a) => ({ id: a.id, sumber: a.sumber, jenis: a.jenis, ringkasan: a.ringkasan, berhasil: a.berhasil, dibuat: a.dibuat.toISOString() })),
    };
  });
}
