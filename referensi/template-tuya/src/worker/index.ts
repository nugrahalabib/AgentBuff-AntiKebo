import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { periksaEnv } from "@/lib/env";
import { bukaRahasia } from "@/lib/kripto";
import { jalankanJatuhTempo } from "@/lib/layanan/jadwal";
import { hapusFotoKedaluwarsa } from "@/lib/layanan/foto";
import { evaluasiPerubahan } from "@/lib/layanan/otomasi";
import { sinkronkanPengguna } from "@/lib/layanan/rumah";
import { log } from "@/lib/log";
import { sambungWs } from "@/lib/tuya/ws";
import type { PesanWs } from "@/lib/tuya/tipe";

// Worker Tuya MCP (proses terpisah, peran DB tuya_worker):
//  - jadwal jatuh tempo tiap 20 dtk
//  - satu WebSocket Tuya per rumah aktif -> cermin `perangkat` selalu segar + otomasi berpemicu
//  - sinkron struktur berkala (rumah/ruangan/perangkat baru) tiap 6 jam per pemilik
//  - bersih-bersih: aktivitas > 90 hari, jti & sesi kedaluwarsa
//  - foto/klip kamera lewat 7 hari dihapus tiap jam
// Setiap putaran berbatas waktu; satu putaran menggantung tidak boleh mengunci yang lain.

periksaEnv("worker");

async function detak(nama: string, catatan?: string) {
  await db()
    .insert(schema.detakPekerja)
    .values({ nama, terakhir: new Date(), catatan: catatan ?? null })
    .onConflictDoUpdate({ target: schema.detakPekerja.nama, set: { terakhir: new Date(), catatan: catatan ?? null } })
    .catch(() => {});
}

function denganBatas<T>(ms: number, p: Promise<T>): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, tolak) => (t = setTimeout(() => tolak(new Error(`batas waktu ${ms} ms`)), ms)))]).finally(() => clearTimeout(t));
}

function putaran(nama: string, setiapMs: number, fn: () => Promise<string | void>) {
  let jalan = false;
  const sekali = async () => {
    if (jalan) return;
    jalan = true;
    try {
      const c = await denganBatas(Math.max(setiapMs * 3, 60_000), fn());
      await detak(nama, c ?? undefined);
    } catch (e) {
      log.warn({ err: (e as Error)?.message, putaran: nama }, "putaran worker gagal");
    } finally {
      jalan = false;
    }
  };
  setTimeout(sekali, 2_000);
  setInterval(sekali, setiapMs);
}

// ------------------------------------------------------------ WebSocket

type Sambungan = { tutup(): void; mulai: number };
const aktif = new Map<string, Sambungan>();
const jedaSampai = new Map<string, { sampai: number; gagal: number }>();

// Pesan untuk perangkat yang SAMA diproses berurutan: Tuya sering mengirim
// beberapa laporan beruntun, dan otomasi butuh pasangan sebelum->sesudah yang
// benar (dibaca sesudah tulisan sebelumnya selesai), bukan dua kali baca basi.
const antrean = new Map<string, Promise<void>>();
function antrekan(kunci: string, kerja: () => Promise<void>) {
  const lanjut = (antrean.get(kunci) ?? Promise.resolve())
    .then(kerja)
    .catch((e) => log.warn({ err: (e as Error)?.message }, "terapkan pesan ws gagal"));
  antrean.set(kunci, lanjut);
  void lanjut.finally(() => {
    if (antrean.get(kunci) === lanjut) antrean.delete(kunci);
  });
}

async function terapkanPesan(penggunaId: string, p: PesanWs) {
  const kunci = and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, p.data.devId));
  const [lama] = await db().select({ online: schema.perangkat.online, properti: schema.perangkat.properti }).from(schema.perangkat).where(kunci).limit(1);
  if (!lama) return;
  const sebelum = { online: lama.online, properti: lama.properti ?? {} };
  if (p.eventType === "onlineStatusChange") {
    const online = p.data.status === "online";
    await db().update(schema.perangkat).set({ online, diubah: new Date() }).where(kunci);
    await evaluasiPerubahan(penggunaId, p.data.devId, sebelum, { ...sebelum, online });
    return;
  }
  const ubah: Record<string, unknown> = {};
  for (const s of p.data.status ?? []) if (s && typeof s.code === "string") ubah[s.code] = s.value;
  if (!Object.keys(ubah).length) return;
  // Gabung di SQL (jsonb ||) supaya dua pesan beruntun tidak saling menimpa.
  await db()
    .update(schema.perangkat)
    .set({ properti: sql`coalesce(${schema.perangkat.properti}, '{}'::jsonb) || ${JSON.stringify(ubah)}::jsonb`, propertiDiperbarui: new Date(), online: true })
    .where(kunci);
  await evaluasiPerubahan(penggunaId, p.data.devId, sebelum, { online: true, properti: { ...sebelum.properti, ...ubah } });
}

async function aturWebSocket(): Promise<string> {
  const rows = await db()
    .select({ penggunaId: schema.sambunganTuya.penggunaId, kunciSandi: schema.sambunganTuya.kunciSandi, status: schema.sambunganTuya.status, hakAktif: schema.statusHak.aktif })
    .from(schema.sambunganTuya)
    .leftJoin(schema.statusHak, eq(schema.statusHak.penggunaId, schema.sambunganTuya.penggunaId));
  const harus = new Map(rows.filter((r) => r.status === "aktif" && r.hakAktif !== false).map((r) => [r.penggunaId, r]));

  for (const [id, s] of aktif) {
    if (!harus.has(id)) {
      s.tutup();
      aktif.delete(id);
    }
  }
  const kini = Date.now();
  const uri = process.env.TUYA_WS_UJI?.trim() || undefined;
  for (const [id, r] of harus) {
    if (aktif.has(id) || (jedaSampai.get(id)?.sampai ?? 0) > kini) continue;
    let kunci: string;
    try {
      kunci = bukaRahasia(r.kunciSandi, `tuya:${id}`);
    } catch {
      log.error({ pengguna: id }, "kunci tidak bisa dibuka (KEK berubah?)");
      continue;
    }
    const c = sambungWs(
      kunci,
      {
        tersambung: () => {
          jedaSampai.delete(id);
          void db().update(schema.sambunganTuya).set({ wsTersambungPada: new Date() }).where(eq(schema.sambunganTuya.penggunaId, id)).catch(() => {});
        },
        pesan: (p) => antrekan(`${id}:${p.data.devId}`, () => terapkanPesan(id, p)),
        terputus: ({ kode, fatal, alasan }) => {
          aktif.delete(id);
          const g = (jedaSampai.get(id)?.gagal ?? 0) + 1;
          // Fatal (biasanya kunci ditolak) -> tunggu 30 menit; transien -> 5 dtk .. 5 menit.
          const jeda = fatal ? 30 * 60_000 : Math.min(5_000 * 2 ** Math.min(g, 6), 5 * 60_000);
          jedaSampai.set(id, { sampai: Date.now() + jeda, gagal: g });
          if (fatal || g > 3) log.warn({ kode, alasan, gagal: g }, "WebSocket Tuya terputus");
        },
      },
      { uri },
    );
    aktif.set(id, { ...c, mulai: kini });
  }
  return `${aktif.size} ws`;
}

// ------------------------------------------------------------ sinkron berkala

const SINKRON_SETIAP_MS = 6 * 60 * 60 * 1000;
async function sinkronBerkala(): Promise<string> {
  const basi = new Date(Date.now() - SINKRON_SETIAP_MS);
  const rows = await db()
    .select({ penggunaId: schema.sambunganTuya.penggunaId })
    .from(schema.sambunganTuya)
    .where(and(eq(schema.sambunganTuya.status, "aktif"), sql`coalesce(${schema.sambunganTuya.strukturDiperbarui}, 'epoch'::timestamptz) < ${basi.toISOString()}::timestamptz`))
    .limit(5);
  for (const r of rows) {
    await sinkronkanPengguna(r.penggunaId).catch((e) => log.warn({ err: (e as Error)?.message }, "sinkron berkala gagal"));
  }
  return `${rows.length} disinkron`;
}

async function bersihBersih(): Promise<string> {
  const d = await db().delete(schema.aktivitas).where(lt(schema.aktivitas.dibuat, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))).returning({ id: schema.aktivitas.id });
  await db().delete(schema.jtiTerpakai).where(lt(schema.jtiTerpakai.kedaluwarsa, new Date()));
  await db().delete(schema.sesi).where(lt(schema.sesi.kedaluwarsaMutlak, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  return `${d.length} aktivitas lama dihapus`;
}

putaran("jadwal", 20_000, async () => `${await jalankanJatuhTempo()} jadwal`);
putaran("websocket", 60_000, aturWebSocket);
putaran("sinkron", 10 * 60_000, sinkronBerkala);
putaran("bersih", 6 * 60 * 60_000, bersihBersih);
putaran("foto", 60 * 60_000, async () => `${await hapusFotoKedaluwarsa()} foto kedaluwarsa dihapus`);
log.info("worker Tuya MCP menyala");

for (const sinyal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinyal, () => {
    for (const s of aktif.values()) s.tutup();
    process.exit(0);
  });
}
