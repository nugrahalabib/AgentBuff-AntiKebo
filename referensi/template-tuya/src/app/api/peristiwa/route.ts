import { sesiSaatIni } from "@/lib/auth/sesi";
import { langganan } from "@/lib/peristiwa";

// SSE: "ada perubahan di rumahmu" (perangkat berubah lewat WebSocket Tuya, agen,
// jadwal). Hanya sinyal, tanpa isi; peramban memuat ulang /api/app/rumah.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await sesiSaatIni();
  if (!s) return new Response("belum masuk", { status: 401 });
  const enc = new TextEncoder();
  let lepas: (() => void) | null = null;
  let detak: ReturnType<typeof setInterval> | null = null;
  let tunda: ReturnType<typeof setTimeout> | null = null;

  const aliran = new ReadableStream<Uint8Array>({
    async start(c) {
      const kirim = (teks: string) => {
        try {
          c.enqueue(enc.encode(teks));
        } catch {
          /* aliran sudah ditutup */
        }
      };
      kirim("retry: 3000\n: halo\n\n");
      // Banyak baris berubah sekaligus (sinkron) -> satu sinyal per 400 ms.
      lepas = await langganan(s.pengguna.id, () => {
        if (tunda) return;
        tunda = setTimeout(() => {
          tunda = null;
          kirim(`event: ubah\ndata: ${Date.now()}\n\n`);
        }, 400);
      });
      detak = setInterval(() => kirim(": detak\n\n"), 20_000);
      req.signal.addEventListener("abort", () => {
        lepas?.();
        if (detak) clearInterval(detak);
        if (tunda) clearTimeout(tunda);
        try {
          c.close();
        } catch {
          /* sudah ditutup */
        }
      });
    },
    cancel() {
      lepas?.();
      if (detak) clearInterval(detak);
      if (tunda) clearTimeout(tunda);
    },
  });
  return new Response(aliran, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
