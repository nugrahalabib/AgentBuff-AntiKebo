import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayarContoh } from "@/components/prototipe/layar-contoh";
import { DAFTAR_LAYAR, type IdLayar } from "@/lib/prototipe/layar";
import { kamusServer } from "@/lib/i18n/server";

type Props = { params: Promise<{ layar: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ layar }, { t }] = await Promise.all([params, kamusServer()]);
  return { title: (DAFTAR_LAYAR as readonly string[]).includes(layar) ? t.prototipe.layar[layar as IdLayar] : t.prototipe.judul };
}

export default async function HalamanPrototipe({ params, searchParams }: Props) {
  const [{ layar }, cari] = await Promise.all([params, searchParams]);
  if (!(DAFTAR_LAYAR as readonly string[]).includes(layar)) notFound();
  const berlalu = Number(cari.berlalu);
  return <LayarContoh id={layar as IdLayar} cari={{ berlalu: Number.isFinite(berlalu) && berlalu > 0 ? Math.min(berlalu, 3600) : 0, klip: cari.klip === "1" }} />;
}
