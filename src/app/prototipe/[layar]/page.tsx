import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LayarContoh } from "@/components/prototipe/layar-contoh";
import { DAFTAR_LAYAR, type IdLayar } from "@/lib/prototipe/layar";
import { kamusServer } from "@/lib/i18n/server";

type Props = { params: Promise<{ layar: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ layar }, { t }] = await Promise.all([params, kamusServer()]);
  return { title: (DAFTAR_LAYAR as readonly string[]).includes(layar) ? t.prototipe.layar[layar as IdLayar] : t.prototipe.judul };
}

export default async function HalamanPrototipe({ params }: Props) {
  const { layar } = await params;
  if (!(DAFTAR_LAYAR as readonly string[]).includes(layar)) notFound();
  return <LayarContoh id={layar as IdLayar} />;
}
