import type { Tx } from "@/lib/db";
import { isi } from "@/lib/i18n";
import { alarmTerkunci } from "./alarm";
import { GalatLayanan } from "./dasar";
import { jamTampil, type KonteksPengguna } from "./konteks";

/**
 * Aksi di luar alarm yang ikut melemahkan alarm terkunci (K-34): memutus perangkat siaga, memutus
 * rumah pintar, mematikan lapisan darurat. Ditolak selama ada alarm di jendela Mode Komitmen, di
 * web, PC, dan MCP (galat `komitmen_terkunci` + jam buka).
 */
export type AlasanKomitmenLuar = "putus_perangkat" | "putus_rumah" | "darurat_mati";

const KUNCI_TEKS = { putus_perangkat: "putusPerangkat", putus_rumah: "putusRumah", darurat_mati: "daruratMati" } as const;

export async function tolakSelamaKomitmen(tx: Tx, k: KonteksPengguna, sekarang: Date, alasan: AlasanKomitmenLuar): Promise<void> {
  const [kunci] = await alarmTerkunci(tx, k, sekarang);
  if (!kunci) return;
  throw new GalatLayanan("komitmen_terkunci", isi(k.t.galat.komitmen[KUNCI_TEKS[alasan]], { jam: jamTampil(kunci.sampai, kunci.zona, k.bahasa) }), {
    alasan,
    terkunciSampai: kunci.sampai.toISOString(),
  });
}
