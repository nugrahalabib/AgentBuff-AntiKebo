import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HalamanAgen } from "@/components/app/halaman-agen";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { dataAgen } from "@/lib/layanan/agen";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.agen.judul };
}

/** Halaman Agen (PRD L3): sambungan MCP AgentBuff, aktivitas, token manual. */
export default async function Halaman() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const d = await dataAgen(s.pengguna.id);
  return (
    <HalamanAgen
      waktuServer={new Date().getTime()}
      zona={s.pengguna.zonaWaktu}
      awal={{
        alamatMcp: d.alamatMcp,
        token: d.token.map((x) => ({
          id: x.id,
          label: x.label,
          awalan: x.awalan,
          sumber: x.sumber,
          terakhirDipakai: x.terakhirDipakai?.toISOString() ?? null,
          kedaluwarsa: x.kedaluwarsa?.toISOString() ?? null,
          dibuat: x.dibuat.toISOString(),
        })),
        aktivitas: d.aktivitas.map((a) => ({ ...a, dibuat: a.dibuat.toISOString() })),
      }}
    />
  );
}
