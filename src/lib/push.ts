import { and, asc, eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import { z } from "zod";
import { schema, type Tx } from "@/lib/db";
import { env, modeTiruan } from "@/lib/env";
import { bukaRahasia, sandikanRahasia, sha256Hex } from "@/lib/kripto";
import { log } from "@/lib/log";
import type { IsiNotif } from "@/lib/pesan";

/**
 * Web Push (PRD G5, arsitektur §2 `langganan_push`). Langganan peramban disimpan tersandi amplop
 * (endpoint + kunci = rahasia, tidak pernah dikirim balik ke peramban atau dicatat). Isi
 * notifikasi dienkripsi standar Web Push (RFC 8291, aes128gcm) dan ditandatangani VAPID (RFC 8292)
 * oleh pustaka `web-push`; pengirimannya lewat `fetch` sendiri supaya batas waktu dan galat
 * terkendali. Endpoint hanya boleh ke layanan push peramban yang dikenal (bukan alamat sembarang).
 */

export const MAKS_LANGGANAN = 10;
const AAD = "langganan_push";
/** Layanan push peramban: Chrome/Edge/Android (FCM), Firefox, Edge Windows (WNS), Safari. */
const HOST_PUSH = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];
const LOKAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const SkemaLangganan = z.strictObject({
  endpoint: z.string().max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.strictObject({
    p256dh: z
      .string()
      .regex(/^[A-Za-z0-9_-]+=*$/)
      .min(80)
      .max(100),
    auth: z
      .string()
      .regex(/^[A-Za-z0-9_-]+=*$/)
      .min(16)
      .max(32),
  }),
});
export type Langganan = z.infer<typeof SkemaLangganan>;

/** Endpoint sah: https ke layanan push yang dikenal; mode tiruan (pengembangan/uji) juga localhost. */
export function endpointSah(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (modeTiruan() && LOKAL.has(u.hostname) && (u.protocol === "http:" || u.protocol === "https:")) return true;
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  return HOST_PUSH.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

export function kunciPublikVapid(): string {
  return env("VAPID_PUBLIC_KEY");
}

/** Simpan/perbarui langganan peramban milik pengguna (transaksi berkonteks pengguna). */
export async function simpanLangganan(tx: Tx, penggunaId: string, l: Langganan, perangkatId: string | null): Promise<void> {
  const endpointHash = sha256Hex(l.endpoint);
  const data = sandikanRahasia(JSON.stringify({ endpoint: l.endpoint, keys: l.keys }), AAD);
  await tx
    .insert(schema.langgananPush)
    .values({ penggunaId, perangkatId, endpointHash, data })
    .onConflictDoUpdate({ target: [schema.langgananPush.penggunaId, schema.langgananPush.endpointHash], set: { data, perangkatId, gagalBeruntun: 0 } });
  // Paling banyak 10 peramban per pengguna: yang paling lama dilepas.
  const semua = await tx
    .select({ id: schema.langgananPush.id })
    .from(schema.langgananPush)
    .where(eq(schema.langgananPush.penggunaId, penggunaId))
    .orderBy(asc(schema.langgananPush.dibuat));
  const lebih = semua.slice(0, Math.max(0, semua.length - MAKS_LANGGANAN)).map((x) => x.id);
  if (lebih.length) await tx.delete(schema.langgananPush).where(inArray(schema.langgananPush.id, lebih));
}

export async function hapusLangganan(tx: Tx, penggunaId: string, endpoint: string): Promise<boolean> {
  const r = await tx
    .delete(schema.langgananPush)
    .where(and(eq(schema.langgananPush.penggunaId, penggunaId), eq(schema.langgananPush.endpointHash, sha256Hex(endpoint))))
    .returning({ id: schema.langgananPush.id });
  return r.length > 0;
}

export type HasilPush = { terkirim: number; gagal: number; dilepas: number };

/** Kirim satu permintaan push. Diganti uji bila perlu. */
export type KirimPermintaan = (endpoint: string, init: { method: string; headers: Record<string, string>; body: Buffer | null }) => Promise<number>;

const kirimFetch: KirimPermintaan = async (endpoint, init) => {
  const r = await fetch(endpoint, { method: init.method, headers: init.headers, body: init.body ? new Uint8Array(init.body) : undefined, signal: AbortSignal.timeout(10_000) });
  await r.arrayBuffer().catch(() => null);
  return r.status;
};

/**
 * Kirim notifikasi ke semua peramban pengguna. `jalankan` = cara membuka transaksi (worker: peran
 * antikebo_worker; web: konteks pengguna). Langganan yang dijawab 404/410 (sudah dicabut
 * peramban) dilepas. Tidak pernah melempar karena jaringan.
 */
export async function kirimPush(
  jalankan: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>,
  penggunaId: string,
  notif: IsiNotif,
  opsi: { ttlDtk?: number; kirim?: KirimPermintaan } = {},
): Promise<HasilPush> {
  const h: HasilPush = { terkirim: 0, gagal: 0, dilepas: 0 };
  const baris = await jalankan((tx) => tx.select().from(schema.langgananPush).where(eq(schema.langgananPush.penggunaId, penggunaId)));
  if (!baris.length) return h;
  const vapidDetails = { subject: env("VAPID_SUBJECT"), publicKey: env("VAPID_PUBLIC_KEY"), privateKey: env("VAPID_PRIVATE_KEY") };
  const muatan = JSON.stringify(notif);
  // Topik sama = pesan yang belum terkirim diganti yang terbaru (mis. ulangan notifikasi berbunyi).
  const topic = sha256Hex(`${notif.jenis}:${notif.tag}`).slice(0, 32);
  const kirim = opsi.kirim ?? kirimFetch;
  const berhasil: string[] = [];
  const gagal: string[] = [];
  const lepas: string[] = [];
  await Promise.all(
    baris.map(async (b) => {
      try {
        const l = JSON.parse(bukaRahasia(b.data, AAD)) as { endpoint: string; keys: { p256dh: string; auth: string } };
        if (!endpointSah(l.endpoint)) {
          lepas.push(b.id);
          return;
        }
        const d = webpush.generateRequestDetails(l, muatan, { vapidDetails, TTL: opsi.ttlDtk ?? 60, urgency: notif.jenis === "pengingat" ? "normal" : "high", topic });
        const status = await kirim(l.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: (d.body as Buffer | null) ?? null });
        if (status >= 200 && status < 300) berhasil.push(b.id);
        else if (status === 404 || status === 410) lepas.push(b.id);
        else gagal.push(b.id);
      } catch (e) {
        log.warn({ err: (e as Error)?.message?.slice(0, 120) }, "push gagal dikirim");
        gagal.push(b.id);
      }
    }),
  );
  await jalankan(async (tx) => {
    if (berhasil.length) await tx.update(schema.langgananPush).set({ terakhirBerhasil: new Date(), gagalBeruntun: 0 }).where(inArray(schema.langgananPush.id, berhasil));
    if (gagal.length)
      await tx
        .update(schema.langgananPush)
        .set({ gagalBeruntun: sql`${schema.langgananPush.gagalBeruntun} + 1` })
        .where(inArray(schema.langgananPush.id, gagal));
    if (lepas.length) await tx.delete(schema.langgananPush).where(inArray(schema.langgananPush.id, lepas));
  });
  h.terkirim = berhasil.length;
  h.gagal = gagal.length;
  h.dilepas = lepas.length;
  return h;
}
