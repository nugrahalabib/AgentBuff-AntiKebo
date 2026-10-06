import { klienSql } from "@/lib/db";
import { log } from "@/lib/log";

// Satu LISTEN per proses (Postgres `tuya_perubahan`, dipicu trigger di migrasi
// 0001), disebar ke pelanggan SSE per pengguna. Muatan hanya id pengguna -
// peramban lalu membaca ulang datanya lewat API ber-RLS.

type Pendengar = () => void;
const pelanggan = new Map<string, Set<Pendengar>>();
let mulai: Promise<void> | null = null;

function pastikanDengar(): Promise<void> {
  if (!mulai) {
    mulai = klienSql()
      .listen("tuya_perubahan", (penggunaId) => {
        for (const f of pelanggan.get(penggunaId) ?? []) f();
      })
      .then(() => undefined)
      .catch((e) => {
        log.error({ err: (e as Error)?.message }, "LISTEN tuya_perubahan gagal");
        mulai = null;
      });
  }
  return mulai;
}

export async function langganan(penggunaId: string, f: Pendengar): Promise<() => void> {
  await pastikanDengar();
  let set = pelanggan.get(penggunaId);
  if (!set) pelanggan.set(penggunaId, (set = new Set()));
  set.add(f);
  return () => {
    set!.delete(f);
    if (!set!.size) pelanggan.delete(penggunaId);
  };
}
