import type { Metadata } from "next";
import { HalamanLegal } from "@/components/legal/halaman-legal";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.legal.halamanPrivasi.judul };
}

/** Kebijakan privasi publik (PRD N5, `docs/GERBANG-RILIS.md` butir 12). */
export default async function HalamanPrivasi() {
  const { t } = await kamusServer();
  return <HalamanLegal t={t} isi={t.legal.halamanPrivasi} lain={{ href: "/ketentuan", label: t.legal.halamanKetentuan.judul }} />;
}
