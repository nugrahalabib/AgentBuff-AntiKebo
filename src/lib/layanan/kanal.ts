import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { daftarKanal, kirimKabar, type GagalPintu, type Kanal } from "@/lib/agentbuff/pintu";
import { db, denganPengguna, schema, type Tx } from "@/lib/db";
import { isi } from "@/lib/i18n";
import { acakBase64Url } from "@/lib/kripto";
import { notifUji, pesanUji } from "@/lib/pesan";
import { hapusLangganan, kirimPush, SkemaLangganan, simpanLangganan, endpointSah, type HasilPush } from "@/lib/push";
import { catatAudit } from "./audit";
import { GalatLayanan, type Sumber } from "./dasar";
import { konteksPengguna, type KonteksPengguna } from "./konteks";

/**
 * Kanal pesan dan notifikasi (PRD G1, G5, G6, G7). Daftar kanal selalu diambil langsung dari
 * AgentBuff pengguna (kebenaran di sana). Setiap pesan tercatat di `kiriman_kanal` tanpa isinya.
 */

export type JenisKiriman = "spam" | "penutup" | "cek" | "terlewat" | "pengingat" | "uji" | "beku";
export type StatusKiriman = "terkirim" | "gagal" | "ditunda";

export type BarisKiriman = {
  penggunaId: string;
  kejadianId: string | null;
  kanalId: string;
  platform: string | null;
  jenis: JenisKiriman;
  ke?: number | null;
  status: StatusKiriman;
  alasan?: string | null;
  idKiriman?: string | null;
  kunci: string;
};

/** Catat satu kiriman (idempoten per kunci: langkah yang diulang tidak tercatat dua kali). */
export async function catatKiriman(tx: Tx, b: BarisKiriman): Promise<void> {
  await tx
    .insert(schema.kirimanKanal)
    .values({ ...b, ke: b.ke ?? null, alasan: b.alasan ?? null, idKiriman: b.idKiriman ?? null })
    .onConflictDoNothing();
}

/** Kalimat ramah untuk alasan gagal dari pintu kabar. */
export function alasanRamah(k: KonteksPengguna, g: Pick<GagalPintu, "alasan" | "ulangiSetelahMs">): string {
  const A = k.t.kanal.alasan;
  if (g.alasan === "terlalu_cepat") return isi(A.terlalu_cepat, { n: Math.max(1, Math.ceil((g.ulangiSetelahMs ?? 5_000) / 1000)) });
  if (g.alasan === "kanal_tidak_siap" || g.alasan === "agen_tidak_aktif" || g.alasan === "belum_diizinkan") return A[g.alasan];
  return A.umum;
}

async function subPengguna(penggunaId: string): Promise<string> {
  const [p] = await db().select({ sub: schema.pengguna.agentbuffSub }).from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId));
  if (!p) throw new GalatLayanan("tidak_ditemukan", "Pengguna tidak ditemukan.");
  return p.sub;
}

/** Daftar kanal agen pengguna (PRD G1): platform, nama bot/agen, siap atau tidak + alasan. */
export async function daftarKanalPengguna(penggunaId: string): Promise<{ kanal: Kanal[] }> {
  const sub = await subPengguna(penggunaId);
  const k = await denganPengguna(penggunaId, (tx) => konteksPengguna(tx, penggunaId));
  const h = await daftarKanal(sub);
  if (h.ok) return { kanal: h.kanal };
  if (h.alasan === "belum_diizinkan") throw new GalatLayanan("perlu_izin", k.t.kanal.alasan.belum_diizinkan);
  throw new GalatLayanan("kanal_gagal", k.t.kanal.gagalMuat, { alasan: h.alasan });
}

const SkemaUji = z.strictObject({ kanal: z.string().min(1).max(100) });

/** Pesan uji ke satu kanal (PRD G7). */
export async function ujiKanal(penggunaId: string, masukan: unknown, sumber: Sumber): Promise<{ terkirim: true; pesan: string }> {
  const sub = await subPengguna(penggunaId);
  const k = await denganPengguna(penggunaId, (tx) => konteksPengguna(tx, penggunaId));
  const m = SkemaUji.safeParse(masukan ?? {});
  if (!m.success) throw new GalatLayanan("masukan", k.t.kanal.alasan.kanal_tidak_siap);
  const kunci = `uji:${acakBase64Url(18)}`;
  const h = await kirimKabar(sub, { kanal: m.data.kanal, teks: pesanUji({ bahasa: k.bahasa, nama: k.namaSapaan }), kunci });
  await denganPengguna(penggunaId, async (tx) => {
    await catatKiriman(tx, {
      penggunaId,
      kejadianId: null,
      kanalId: m.data.kanal,
      platform: null,
      jenis: "uji",
      status: h.ok ? "terkirim" : h.alasan === "terlalu_cepat" ? "ditunda" : "gagal",
      alasan: h.ok ? null : h.alasan,
      idKiriman: h.ok ? h.id : null,
      kunci,
    });
    await catatAudit(
      penggunaId,
      { sumber, jenis: "lainnya", ringkasan: h.ok ? "Pesan uji kanal terkirim" : "Pesan uji kanal gagal", detail: { alasan: h.ok ? null : h.alasan }, berhasil: h.ok },
      tx,
    );
  });
  if (h.ok) return { terkirim: true, pesan: k.t.kanal.ujiTerkirim };
  if (h.alasan === "belum_diizinkan") throw new GalatLayanan("perlu_izin", alasanRamah(k, h));
  if (h.alasan === "terlalu_cepat") throw new GalatLayanan("batas_laju", alasanRamah(k, h), { ulangiSetelahMs: h.ulangiSetelahMs ?? null });
  throw new GalatLayanan("kanal_gagal", alasanRamah(k, h), { alasan: h.alasan });
}

export type KirimanTampil = { kanalId: string; platform: string | null; jenis: JenisKiriman; ke: number | null; status: StatusKiriman; alasan: string | null; waktu: Date };

/** Jejak kiriman satu kejadian (PRD G6), untuk riwayat. Tanpa isi pesan. */
export async function kirimanKejadian(penggunaId: string, kejadianId: string): Promise<KirimanTampil[]> {
  if (!z.uuid().safeParse(kejadianId).success) return [];
  return denganPengguna(penggunaId, async (tx) => {
    const r = await tx
      .select()
      .from(schema.kirimanKanal)
      .where(and(eq(schema.kirimanKanal.penggunaId, penggunaId), eq(schema.kirimanKanal.kejadianId, kejadianId)))
      .orderBy(asc(schema.kirimanKanal.dibuat));
    return r.map((x) => ({
      kanalId: x.kanalId,
      platform: x.platform,
      jenis: x.jenis as JenisKiriman,
      ke: x.ke,
      status: x.status as StatusKiriman,
      alasan: x.alasan,
      waktu: x.dibuat,
    }));
  });
}

// ------------------------------------------------------------------ notifikasi web (PRD G5)

const SkemaDaftarPush = z.strictObject({ langganan: SkemaLangganan, perangkatId: z.uuid().nullable().optional() });

/** Simpan langganan Web Push peramban ini. Endpoint di luar layanan push peramban ditolak. */
export async function daftarkanPush(penggunaId: string, masukan: unknown, sumber: Sumber): Promise<{ menyala: true }> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const m = SkemaDaftarPush.safeParse(masukan ?? {});
    if (!m.success || !endpointSah(m.data.langganan.endpoint)) throw new GalatLayanan("masukan", k.t.notifikasi.gagal);
    let perangkatId: string | null = null;
    if (m.data.perangkatId) {
      const [p] = await tx
        .select({ id: schema.perangkatSiaga.id })
        .from(schema.perangkatSiaga)
        .where(and(eq(schema.perangkatSiaga.id, m.data.perangkatId), eq(schema.perangkatSiaga.penggunaId, penggunaId)));
      perangkatId = p?.id ?? null;
    }
    await simpanLangganan(tx, penggunaId, m.data.langganan, perangkatId);
    await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: "Notifikasi alarm dinyalakan di satu peramban" }, tx);
    return { menyala: true as const };
  });
}

export async function lepasPush(penggunaId: string, masukan: unknown, sumber: Sumber): Promise<{ dilepas: boolean }> {
  const m = z.strictObject({ endpoint: z.string().min(1).max(1000) }).safeParse(masukan ?? {});
  if (!m.success) return { dilepas: false };
  return denganPengguna(penggunaId, async (tx) => {
    const ada = await hapusLangganan(tx, penggunaId, m.data.endpoint);
    if (ada) await catatAudit(penggunaId, { sumber, jenis: "perangkat", ringkasan: "Notifikasi alarm dimatikan di satu peramban" }, tx);
    return { dilepas: ada };
  });
}

/** Notifikasi uji ke semua peramban pengguna. */
export async function ujiPush(penggunaId: string): Promise<HasilPush & { pesan: string }> {
  const k = await denganPengguna(penggunaId, (tx) => konteksPengguna(tx, penggunaId));
  const h = await kirimPush((fn) => denganPengguna(penggunaId, fn), penggunaId, notifUji({ bahasa: k.bahasa, url: "/app/pengaturan" }));
  if (!h.terkirim) throw new GalatLayanan("kanal_gagal", k.t.notifikasi.gagal, { ...h });
  return { ...h, pesan: k.t.notifikasi.ujiTerkirim };
}
