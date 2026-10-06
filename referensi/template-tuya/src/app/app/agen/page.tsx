import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HalamanAgen } from "@/components/app/agen";
import { daftarToken } from "@/lib/agen/token";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { env } from "@/lib/env";
import { daftarAktivitas } from "@/lib/layanan/aktivitas";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await kamusServer()).t.agen.judul };
}

export default async function Halaman() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const [token, aktivitas] = await Promise.all([daftarToken(s.pengguna.id), daftarAktivitas(s.pengguna.id, { batas: 40 })]);
  return (
    <HalamanAgen
      awal={{
        alamatMcp: `${env("APP_ORIGIN")}/mcp`,
        token: token.map((x) => ({ id: x.id, label: x.label, awalan: x.awalan, sumber: x.sumber, terakhirDipakai: x.terakhirDipakai?.toISOString() ?? null, kedaluwarsa: x.kedaluwarsa?.toISOString() ?? null, dibuat: x.dibuat.toISOString() })),
        aktivitas: aktivitas.map((a) => ({ id: a.id, sumber: a.sumber, jenis: a.jenis, ringkasan: a.ringkasan, berhasil: a.berhasil, dibuat: a.dibuat.toISOString() })),
      }}
    />
  );
}
