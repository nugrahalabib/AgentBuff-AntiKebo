import { klienSql } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Peristiwa waktu nyata (arsitektur §5). Satu LISTEN `antikebo_peristiwa` per proses web,
 * disebar ke pelanggan SSE per pengguna. Muatan dari pemicu DB hanya berisi id, isi dibaca ulang
 * lewat API ber-RLS. Uji memasang sumber lain (PGlite) lewat `pasangSumberPeristiwa`.
 */

export type JenisPeristiwa = "jadwal" | "berbunyi" | "berhenti" | "tunda" | "cek" | "klip_siap" | "cabut" | "perangkat";
export type Peristiwa = { p: string; j: JenisPeristiwa; k?: string; d?: string };

type Pendengar = (e: Peristiwa) => void;
type Sumber = (cb: (muatan: string) => void) => Promise<unknown>;

const sumberBawaan: Sumber = (cb) => klienSql().listen("antikebo_peristiwa", cb);
let sumber: Sumber = sumberBawaan;
const pelanggan = new Map<string, Set<Pendengar>>();
let mulai: Promise<void> | null = null;

export function pasangSumberPeristiwa(s: Sumber | null) {
  sumber = s ?? sumberBawaan;
  mulai = null;
}

function sebar(muatan: string) {
  let e: Peristiwa;
  try {
    e = JSON.parse(muatan) as Peristiwa;
  } catch {
    return;
  }
  if (typeof e?.p !== "string") return;
  for (const f of pelanggan.get(e.p) ?? []) {
    try {
      f(e);
    } catch (err) {
      log.warn({ err: (err as Error)?.message }, "pendengar peristiwa gagal");
    }
  }
}

function pastikanDengar(): Promise<void> {
  if (!mulai) {
    mulai = sumber(sebar)
      .then(() => undefined)
      .catch((e) => {
        log.error({ err: (e as Error)?.message }, "LISTEN antikebo_peristiwa gagal");
        mulai = null;
        throw e;
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

/**
 * Aliran SSE untuk satu pelanggan (sesi web atau perangkat). `saring` memilih peristiwa yang
 * dikirim; `tutupBila` menutup aliran (mis. perangkat ini dicabut). Peristiwa pertama `halo`
 * membawa jam server supaya perangkat bisa mengoreksi selisih jamnya sendiri.
 */
export function aliranPeristiwa(req: Request, penggunaId: string, opsi: { saring?: (e: Peristiwa) => boolean; tutupBila?: (e: Peristiwa) => boolean } = {}): Response {
  const enc = new TextEncoder();
  let lepas: (() => void) | null = null;
  let detak: ReturnType<typeof setInterval> | null = null;
  let tertutup = false;

  const aliran = new ReadableStream<Uint8Array>({
    async start(c) {
      const kirim = (teks: string) => {
        if (tertutup) return;
        try {
          c.enqueue(enc.encode(teks));
        } catch {
          /* aliran sudah ditutup */
        }
      };
      const tutup = () => {
        if (tertutup) return;
        tertutup = true;
        lepas?.();
        if (detak) clearInterval(detak);
        try {
          c.close();
        } catch {
          /* sudah ditutup */
        }
      };
      kirim(`retry: 3000\nevent: halo\ndata: ${JSON.stringify({ waktuServer: new Date().toISOString() })}\n\n`);
      try {
        lepas = await langganan(penggunaId, (e) => {
          if (opsi.tutupBila?.(e)) {
            kirim(`event: ${e.j}\ndata: ${JSON.stringify({ d: e.d ?? null })}\n\n`);
            tutup();
            return;
          }
          if (opsi.saring && !opsi.saring(e)) return;
          kirim(`event: ${e.j}\ndata: ${JSON.stringify({ k: e.k ?? null, d: e.d ?? null, waktuServer: new Date().toISOString() })}\n\n`);
        });
      } catch {
        tutup();
        return;
      }
      detak = setInterval(() => kirim(": detak\n\n"), 20_000);
      req.signal.addEventListener("abort", tutup);
    },
    cancel() {
      tertutup = true;
      lepas?.();
      if (detak) clearInterval(detak);
    },
  });
  return new Response(aliran, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
