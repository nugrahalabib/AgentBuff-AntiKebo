import type { Metadata } from "next";
import { LayarUnduhPc } from "@/components/layar/siaga";
import { kamusServer } from "@/lib/i18n/server";
import { ALAMAT_TETAP, infoUnduhPc } from "@/lib/unduh";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.unduh.judul };
}

/** Unduh AntiKebo untuk PC (docs/09 §4 butir 1, §8): pemasang terbaru + panduan layar biru + SHA-256. */
export default async function HalamanUnduhPc() {
  const info = await infoUnduhPc();
  return info ? (
    <LayarUnduhPc hrefUnduh={`/unduh/pc/${ALAMAT_TETAP}`} ukuranMb={Math.max(1, Math.round(info.ukuran / 1_048_576))} sha256={info.sha256} versi={info.versi} />
  ) : (
    <LayarUnduhPc />
  );
}
