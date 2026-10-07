import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { denganPengguna, schema } from "@/lib/db";
import type { Kamus } from "@/lib/i18n";
import { tambahHari } from "@/lib/jadwal/tanggal";
import { bukaSegel, segel } from "@/lib/kripto";
import { hariBeruntun, menitSampaiBangun, skorHarian, skorKejadian } from "@/lib/skor";
import { GalatLayanan } from "./dasar";
import { kirimanKejadian, type KirimanTampil } from "./kanal";
import { jamTampil, konteksPengguna } from "./konteks";

/**
 * Riwayat dan statistik (PRD K1 sampai K3). Skor dari `src/lib/skor.ts` (contoh emas
 * `tests/emas/skor.json`); ringkasan murni (`ringkasRiwayat`) supaya bisa dites tanpa basis data.
 * Hanya kejadian sungguhan yang sudah selesai: uji, dibatalkan, dan yang masih berjalan tidak masuk.
 */

export const HARI_GRAFIK = 30;
/** Hari beruntun dihitung dari 1 tahun terakhir. */
const HARI_BERUNTUN = 366;
const STATUS_RIWAYAT = ["bangun", "cek_bangun", "tidak_bangun", "terlewat"] as const;

export type BarisRiwayat = {
  id: string;
  tanggal: string;
  jam: string;
  judul: string;
  status: string;
  berbunyiPada: Date | null;
  bangunPada: Date | null;
  jumlahTunda: number;
  gagalCek: boolean;
  pesanKanal: number;
};

export type KejadianRiwayat = {
  id: string;
  tanggal: string;
  jam: string;
  judul: string;
  status: "bangun" | "tidak_bangun" | "terlewat";
  skor: number | null;
  tunda: number;
  menitSampaiBangun: number;
  pesanKanal: number;
};

export type RingkasanRiwayat = {
  skorHariIni: number | null;
  beruntun: number;
  /** Rata-rata menit dari berbunyi sampai soal terjawab (30 hari), null bila belum ada. */
  rataMenit: number | null;
  totalTunda: number;
  /** Skor harian 30 hari terakhir (lama ke baru) dan tanggalnya. */
  skor30: (number | null)[];
  hari30: string[];
  /** Kejadian 30 hari terakhir, terbaru dulu. */
  kejadian: KejadianRiwayat[];
};

const statusTampil = (s: string): KejadianRiwayat["status"] => (s === "tidak_bangun" ? "tidak_bangun" : s === "terlewat" ? "terlewat" : "bangun");

/** Ringkasan murni dari baris riwayat (boleh lebih dari 30 hari: hari beruntun memakai semuanya). */
export function ringkasRiwayat(baris: readonly BarisRiwayat[], hariIni: string, n = HARI_GRAFIK): RingkasanRiwayat {
  const hari = Array.from({ length: n }, (_, i) => tambahHari(hariIni, i - n + 1));
  const awal = hari[0];
  const perHari = new Map<string, (number | null)[]>();
  const kejadian: KejadianRiwayat[] = [];
  let tunda = 0;
  const menit: number[] = [];
  const urut = [...baris].sort((a, b) => (a.tanggal === b.tanggal ? b.jam.localeCompare(a.jam) : b.tanggal.localeCompare(a.tanggal)));
  for (const b of urut) {
    if (b.tanggal > hariIni) continue;
    const skor = skorKejadian({ status: b.status, uji: false, berbunyiPada: b.berbunyiPada, bangunPada: b.bangunPada, jumlahTunda: b.jumlahTunda, gagalCek: b.gagalCek });
    perHari.set(b.tanggal, [...(perHari.get(b.tanggal) ?? []), skor]);
    if (b.tanggal < awal) continue;
    const m = menitSampaiBangun(b);
    kejadian.push({
      id: b.id,
      tanggal: b.tanggal,
      jam: b.jam,
      judul: b.judul,
      status: statusTampil(b.status),
      skor,
      tunda: b.jumlahTunda,
      menitSampaiBangun: m,
      pesanKanal: b.pesanKanal,
    });
    tunda += b.jumlahTunda;
    if (b.bangunPada && b.berbunyiPada) menit.push(m);
  }
  return {
    skorHariIni: skorHarian(perHari.get(hariIni) ?? []),
    beruntun: hariBeruntun(perHari),
    rataMenit: menit.length ? Math.round(menit.reduce((a, b) => a + b, 0) / menit.length) : null,
    totalTunda: tunda,
    skor30: hari.map((h) => skorHarian(perHari.get(h) ?? [])),
    hari30: hari,
    kejadian,
  };
}

function hariIniDi(zona: string, sekarang: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(sekarang);
}

async function barisRiwayat(penggunaId: string, sejak: string | null, batas: number): Promise<BarisRiwayat[]> {
  return denganPengguna(penggunaId, async (tx) => {
    const r = await tx
      .select()
      .from(schema.kejadianAlarm)
      .where(
        and(
          eq(schema.kejadianAlarm.penggunaId, penggunaId),
          eq(schema.kejadianAlarm.uji, false),
          inArray(schema.kejadianAlarm.status, [...STATUS_RIWAYAT]),
          ...(sejak ? [gte(schema.kejadianAlarm.tanggalLokal, sejak)] : []),
        ),
      )
      .orderBy(desc(schema.kejadianAlarm.jadwalUtc))
      .limit(batas);
    const id = r.map((x) => x.id);
    const pesan = id.length
      ? await tx
          .select({ kejadianId: schema.kirimanKanal.kejadianId, n: sql<number>`count(*)::int` })
          .from(schema.kirimanKanal)
          .where(
            and(
              eq(schema.kirimanKanal.penggunaId, penggunaId),
              inArray(schema.kirimanKanal.kejadianId, id),
              eq(schema.kirimanKanal.jenis, "spam"),
              eq(schema.kirimanKanal.status, "terkirim"),
            ),
          )
          .groupBy(schema.kirimanKanal.kejadianId)
      : [];
    const per = new Map(pesan.map((p) => [p.kejadianId, p.n]));
    return r.map((x) => ({
      id: x.id,
      tanggal: x.tanggalLokal,
      jam: x.jamLokal,
      judul: x.judul,
      status: x.status,
      berbunyiPada: x.berbunyiPada,
      bangunPada: x.bangunPada,
      jumlahTunda: x.jumlahTunda,
      gagalCek: x.tanpaTunda,
      pesanKanal: per.get(x.id) ?? 0,
    }));
  });
}

/** Riwayat + statistik 30 hari untuk tab Riwayat dan alat MCP `get_history` (P12). */
export async function riwayatPengguna(penggunaId: string, sekarang = new Date()): Promise<RingkasanRiwayat> {
  const zona = await denganPengguna(penggunaId, async (tx) => (await konteksPengguna(tx, penggunaId)).zona);
  const hariIni = hariIniDi(zona, sekarang);
  return ringkasRiwayat(await barisRiwayat(penggunaId, tambahHari(hariIni, -HARI_BERUNTUN), 5_000), hariIni);
}

export type SoalRiwayat = { jenis: string; tingkat: string; tujuan: string; status: string };

export type RincianKejadian = {
  id: string;
  judul: string;
  tanggal: string;
  jam: string;
  status: KejadianRiwayat["status"];
  skor: number | null;
  berbunyi: string | null;
  bangun: string | null;
  terlambatDtk: number | null;
  tunda: number;
  gagalCek: boolean;
  /** Siapa yang menghentikan: sesi (web/HP), perangkat (aplikasi PC), luring (PC tanpa internet). */
  selesaiOleh: string | null;
  perangkat: string | null;
  /** Perangkat siaga saat alarm mulai berbunyi (detak < 2 menit). */
  perangkatBerbunyi: { nama: string; jenis: "pc" | "web" }[];
  soal: SoalRiwayat[];
  kiriman: KirimanTampil[];
  /** Aksi rumah pintar (langkah `tuya_pra` dan `tuya`): dijalankan, offline, atau gagal. */
  rumah: RumahRiwayat[];
};

export type RumahRiwayat = { nama: string | null; hasil: "jalan" | "offline" | "gagal" };

function hasilRumah(h: unknown): RumahRiwayat["hasil"] | null {
  const x = (h ?? {}) as { perangkat?: unknown; status?: unknown; lewat?: unknown };
  if (typeof x.perangkat !== "string") return null;
  if (typeof x.status === "string") return "jalan";
  return x.lewat === "offline" ? "offline" : "gagal";
}

/** Rincian satu kejadian (PRD K1): soal, kiriman kanal, perangkat yang siaga dan yang menghentikan, rumah pintar. */
export async function rincianKejadian(penggunaId: string, kejadianId: string): Promise<RincianKejadian> {
  if (!z.uuid().safeParse(kejadianId).success) throw new GalatLayanan("tidak_ditemukan", "Kejadian tidak ditemukan.");
  const r = await denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const [kej] = await tx
      .select()
      .from(schema.kejadianAlarm)
      .where(and(eq(schema.kejadianAlarm.penggunaId, penggunaId), eq(schema.kejadianAlarm.id, kejadianId)));
    if (!kej) throw new GalatLayanan("tidak_ditemukan", k.t.riwayat.tidakAda);
    const soal = await tx
      .select({ jenis: schema.soalKejadian.jenis, tingkat: schema.soalKejadian.tingkat, tujuan: schema.soalKejadian.tujuan, status: schema.soalKejadian.status })
      .from(schema.soalKejadian)
      .where(
        and(
          eq(schema.soalKejadian.penggunaId, penggunaId),
          eq(schema.soalKejadian.kejadianId, kejadianId),
          inArray(schema.soalKejadian.status, ["benar", "salah", "diganti", "aktif"]),
        ),
      )
      .orderBy(asc(schema.soalKejadian.dibuat));
    const [p] = kej.perangkatSelesai
      ? await tx.select({ nama: schema.perangkatSiaga.nama }).from(schema.perangkatSiaga).where(eq(schema.perangkatSiaga.id, kej.perangkatSelesai))
      : [];
    const langkah = await tx
      .select({ hasil: schema.langkahKejadian.hasil })
      .from(schema.langkahKejadian)
      .where(
        and(
          eq(schema.langkahKejadian.penggunaId, penggunaId),
          eq(schema.langkahKejadian.kejadianId, kejadianId),
          inArray(schema.langkahKejadian.jenis, ["tuya_pra", "tuya"]),
          inArray(schema.langkahKejadian.status, ["selesai", "gagal"]),
        ),
      )
      .orderBy(asc(schema.langkahKejadian.jatuhTempoUtc), asc(schema.langkahKejadian.urutan));
    const ids = [...new Set(langkah.map((l) => (l.hasil as { perangkat?: unknown } | null)?.perangkat).filter((x): x is string => typeof x === "string"))];
    const nama = new Map(
      (ids.length
        ? await tx
            .select({ id: schema.perangkatTuya.deviceId, nama: schema.perangkatTuya.nama })
            .from(schema.perangkatTuya)
            .where(and(eq(schema.perangkatTuya.penggunaId, penggunaId), inArray(schema.perangkatTuya.deviceId, ids)))
        : []
      ).map((x) => [x.id, x.nama]),
    );
    const rumah = langkah.flatMap((l): RumahRiwayat[] => {
      const h = hasilRumah(l.hasil);
      return h ? [{ nama: nama.get((l.hasil as { perangkat: string }).perangkat) ?? null, hasil: h }] : [];
    });
    return { k, kej, soal, perangkat: p?.nama ?? null, rumah };
  });
  const { k, kej } = r;
  return {
    id: kej.id,
    judul: kej.judul,
    tanggal: kej.tanggalLokal,
    jam: kej.jamLokal,
    status: statusTampil(kej.status),
    skor: skorKejadian({ status: kej.status, uji: kej.uji, berbunyiPada: kej.berbunyiPada, bangunPada: kej.bangunPada, jumlahTunda: kej.jumlahTunda, gagalCek: kej.tanpaTunda }),
    berbunyi: kej.berbunyiPada ? jamTampil(kej.berbunyiPada, k.zona, k.bahasa) : null,
    bangun: kej.bangunPada ? jamTampil(kej.bangunPada, k.zona, k.bahasa) : null,
    terlambatDtk: kej.terlambatDtk,
    tunda: kej.jumlahTunda,
    gagalCek: kej.tanpaTunda,
    selesaiOleh: kej.selesaiOleh,
    perangkat: r.perangkat,
    perangkatBerbunyi: kej.perangkatBerbunyi.map((x) => ({ nama: x.nama, jenis: x.jenis === "pc" ? ("pc" as const) : ("web" as const) })),
    soal: r.soal,
    kiriman: await kirimanKejadian(penggunaId, kejadianId),
    rumah: r.rumah,
  };
}

/** Sel CSV aman: kutip bila perlu, dan teks yang diawali = + - @ diberi tanda kutip tunggal (injeksi rumus). */
export function selCsv(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Ekspor CSV seluruh riwayat (PRD K3), kolom dalam bahasa pengguna. */
export async function csvRiwayat(penggunaId: string): Promise<string> {
  const { t, zona, bahasa } = await denganPengguna(penggunaId, async (tx) => konteksPengguna(tx, penggunaId));
  const baris = await barisRiwayat(penggunaId, null, 20_000);
  const C = (t as Kamus).riwayat.csv;
  const kepala = [C.tanggal, C.jam, C.judul, C.status, C.berbunyi, C.bangun, C.menit, C.tunda, C.skor, C.pesan];
  const isiBaris = baris.map((b) => {
    const skor = skorKejadian({ status: b.status, uji: false, berbunyiPada: b.berbunyiPada, bangunPada: b.bangunPada, jumlahTunda: b.jumlahTunda, gagalCek: b.gagalCek });
    return [
      b.tanggal,
      bahasa === "id" ? b.jam.replace(":", ".") : b.jam,
      b.judul,
      t.riwayat.status[statusTampil(b.status)],
      b.berbunyiPada ? jamTampil(b.berbunyiPada, zona, bahasa) : null,
      b.bangunPada ? jamTampil(b.bangunPada, zona, bahasa) : null,
      b.bangunPada && b.berbunyiPada ? menitSampaiBangun(b) : null,
      b.jumlahTunda,
      skor,
      b.pesanKanal,
    ];
  });
  // BOM supaya Excel membaca huruf UTF-8 dengan benar.
  return `﻿${[kepala, ...isiBaris].map((r) => r.map(selCsv).join(",")).join("\r\n")}\r\n`;
}

// ------------------------------------------------------------------ tautan unduh (MCP export_history)

const INFO_UNDUH = "antikebo-unduh-riwayat";
export const MENIT_UNDUH = 15;

/** Token unduh CSV berumur pendek (alat MCP `export_history`): tersegel, berisi pemilik + kedaluwarsa. */
export function tokenUnduhRiwayat(penggunaId: string, sekarang = new Date()): { token: string; kedaluwarsa: Date } {
  const kedaluwarsa = new Date(sekarang.getTime() + MENIT_UNDUH * 60_000);
  return { token: segel({ p: penggunaId, e: kedaluwarsa.getTime() }, INFO_UNDUH), kedaluwarsa };
}

/** Pemilik token unduh, atau null bila palsu atau kedaluwarsa. */
export function pemilikTokenUnduh(token: string, sekarang = new Date()): string | null {
  if (!token || token.length > 400) return null;
  const isi = bukaSegel<{ p?: unknown; e?: unknown }>(token, INFO_UNDUH);
  if (!isi || typeof isi.p !== "string" || typeof isi.e !== "number" || isi.e <= sekarang.getTime()) return null;
  return z.uuid().safeParse(isi.p).success ? isi.p : null;
}
