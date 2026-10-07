import type { Metadata } from "next";
import { HalamanLegal } from "@/components/legal/halaman-legal";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.legal.halamanKetentuan.judul };
}

/** Ketentuan pemakaian publik, termasuk pernyataan "bukan jaminan" (PRD N5). */
export default async function HalamanKetentuan() {
  const { t } = await kamusServer();
  return <HalamanLegal t={t} isi={t.legal.halamanKetentuan} lain={{ href: "/privasi", label: t.legal.halamanPrivasi.judul }} />;
}
