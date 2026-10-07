import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { denganPengguna, schema, type Tx } from "@/lib/db";
import type { TampilSoal } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { acakBase64Url } from "@/lib/kripto";
import { konfirmasiBangun, lolosKejadian, tundaKejadian, type Penghenti } from "@/lib/penjadwal/mesin";
import type { BarisKejadian, IsiKejadian } from "@/lib/penjadwal/saluran";
import { bakukanJawaban, buatSoal, periksaLuring, sesudahJawab, SALAH_UNTUK_TURUN, type JenisSoalDibuat, type Tingkat } from "@/lib/soal/soal";
import { catatAudit } from "./audit";
import { GalatLayanan } from "./dasar";
import { namaTempatQr, pindaianCocok } from "./kode-qr";
import { konteksPengguna, type KonteksPengguna } from "./konteks";

/**
 * SATU-SATUNYA jalan menghentikan atau menunda alarm yang berbunyi (aturan teknis 2, PRD D1 sampai
 * D8, E1, E2): menjawab soal di layar alarm dengan sesi pemilik atau token perangkat siaga
 * miliknya. Tidak ada alat MCP atau kunci internal yang memanggil modul ini (dijaga `jaga`,
 * penjaga `jalur-alarm`). Jawaban hanya disimpan sebagai HMAC bergaram dan tidak pernah dikirim ke
 * peramban atau dicatat.
 */

export type Penjawab = { penggunaId: string; perangkatId: string | null; oleh: "sesi" | "perangkat" };
export type Tujuan = "bangun" | "tunda";

export type SoalUntukLayar = {
  id: string;
  tujuan: Tujuan;
  jenis: "hitungan" | "ingat" | "ketik" | "qr";
  tingkat: Tingkat;
  tampil: TampilSoal;
  /** Benar berturut-turut yang dibutuhkan dan yang sudah didapat. */
  target: number;
  benarBeruntun: number;
  /** Gabungan: tahap sekarang dan jumlah tahap. */
  tahap: number;
  jumlahTahap: number;
};

export type HasilJawab =
  | { hasil: "benar" | "salah" | "tahap" | "diganti"; soal: SoalUntukLayar }
  | { hasil: "selesai"; status: "bangun" | "cek_bangun"; cekPada: Date | null }
  | { hasil: "ditunda"; sampai: Date };

const STATUS_BOLEH: Record<Tujuan, readonly string[]> = { bangun: ["berbunyi", "ditunda"], tunda: ["berbunyi"] };

// ------------------------------------------------------------------ hash jawaban

function kunciHmac(): Buffer {
  return createHmac("sha256", "antikebo-soal").update(env("SESSION_SECRET")).digest();
}

/** HMAC-SHA256(garam + ":" + jawaban baku). Kunci rahasia server: hash di DB tidak bisa ditebak luring. */
export function hashJawaban(garam: string, jawabanBaku: string): string {
  return createHmac("sha256", kunciHmac()).update(`${garam}:${jawabanBaku}`).digest("hex");
}

function samaHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

// ------------------------------------------------------------------ pembuat soal

function jenisTahap(isi: IsiKejadian, tujuan: Tujuan, tahap: number): SoalUntukLayar["jenis"] {
  if (tujuan === "tunda") return "hitungan";
  const j = isi.soal.jenis;
  if (j === "gabungan") return tahap === 0 ? "hitungan" : "qr";
  return j;
}

function jumlahTahap(isi: IsiKejadian, tujuan: Tujuan): number {
  return tujuan === "bangun" && isi.soal.jenis === "gabungan" ? 2 : 1;
}

function sumberKetik(isi: IsiKejadian, k: KonteksPengguna): string[] {
  const judul = isi.agendaJudul.trim();
  return Array.from(judul).length >= 8 ? [judul] : [...k.t.jawab.kalimat];
}

type Keadaan = { tingkat: Tingkat; benarBeruntun: number; salahBeruntun: number };

async function soalBaru(
  tx: Tx,
  k: KonteksPengguna,
  kej: BarisKejadian,
  isi: IsiKejadian,
  tujuan: Tujuan,
  tahap: number,
  keadaan: Keadaan,
  paksa?: { jenis: "hitungan"; target: number },
) {
  const jenis = paksa?.jenis ?? jenisTahap(isi, tujuan, tahap);
  const tingkat: Tingkat = tujuan === "tunda" ? "ringan" : keadaan.tingkat;
  const target = paksa?.target ?? (tujuan === "tunda" || jenis === "qr" ? 1 : isi.soal.benar);
  const garam = acakBase64Url(16);
  let tampil: TampilSoal;
  let hash: string | null = null;
  let kodeQr: string[] = [];
  if (jenis === "qr") {
    kodeQr = isi.soal.kodeQr;
    tampil = { teks: "", tempat: await namaTempatQr(tx, k.id, kodeQr) };
  } else {
    const s = buatSoal(jenis as JenisSoalDibuat, tingkat, randomInt(0, 2 ** 32), sumberKetik(isi, k));
    hash = hashJawaban(garam, bakukanJawaban(s.jenis, s.jawaban));
    tampil = jenis === "ingat" ? { teks: s.teks, sembunyiSetelahMs: 3_000 } : { teks: s.teks };
  }
  const [r] = await tx
    .insert(schema.soalKejadian)
    .values({
      penggunaId: k.id,
      kejadianId: kej.id,
      tujuan,
      jenis,
      tingkat,
      target,
      tahap,
      tampil,
      hashJawaban: hash,
      garam,
      kodeQr,
      benarBeruntun: keadaan.benarBeruntun,
      salahBeruntun: keadaan.salahBeruntun,
    })
    .returning();
  return r;
}

function untukLayar(r: typeof schema.soalKejadian.$inferSelect, isi: IsiKejadian): SoalUntukLayar {
  return {
    id: r.id,
    tujuan: r.tujuan as Tujuan,
    jenis: r.jenis as SoalUntukLayar["jenis"],
    tingkat: r.tingkat as Tingkat,
    tampil: r.tampil,
    target: r.target,
    benarBeruntun: r.benarBeruntun,
    tahap: r.tahap,
    jumlahTahap: jumlahTahap(isi, r.tujuan as Tujuan),
  };
}

// ------------------------------------------------------------------ pembantu kejadian

async function kejadianMilik(tx: Tx, k: KonteksPengguna, kejadianId: string): Promise<BarisKejadian> {
  const [kej] = z.uuid().safeParse(kejadianId).success
    ? await tx
        .select()
        .from(schema.kejadianAlarm)
        .where(and(eq(schema.kejadianAlarm.penggunaId, k.id), eq(schema.kejadianAlarm.id, kejadianId)))
        .for("update")
    : [];
  if (!kej) throw new GalatLayanan("tidak_ditemukan", k.t.galat.alarmTidakAda);
  return kej;
}

function isiKejadian(kej: BarisKejadian, k: KonteksPengguna): IsiKejadian {
  const isi = kej.isi as IsiKejadian | null;
  if (!isi) throw new GalatLayanan("masukan", k.t.jawab.tidakBerbunyi);
  return isi;
}

function pastikanBoleh(kej: BarisKejadian, isi: IsiKejadian, tujuan: Tujuan, k: KonteksPengguna) {
  if (!STATUS_BOLEH[tujuan].includes(kej.status)) throw new GalatLayanan("masukan", k.t.jawab.tidakBerbunyi);
  if (tujuan === "tunda" && (kej.tanpaTunda || kej.jumlahTunda >= isi.tunda.jatah)) throw new GalatLayanan("masukan", k.t.jawab.tundaHabis);
}

async function soalAktif(tx: Tx, kejadianId: string, tujuan: Tujuan) {
  const [r] = await tx
    .select()
    .from(schema.soalKejadian)
    .where(and(eq(schema.soalKejadian.kejadianId, kejadianId), eq(schema.soalKejadian.tujuan, tujuan), eq(schema.soalKejadian.status, "aktif")))
    .for("update");
  return r ?? null;
}

// ------------------------------------------------------------------ API layanan

/** Soal yang sedang berlaku untuk kejadian ini (dibuat bila belum ada). */
export async function ambilSoal(p: Penjawab, kejadianId: string, tujuan: Tujuan): Promise<SoalUntukLayar> {
  return denganPengguna(p.penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, p.penggunaId);
    const kej = await kejadianMilik(tx, k, kejadianId);
    const isi = isiKejadian(kej, k);
    pastikanBoleh(kej, isi, tujuan, k);
    const ada = await soalAktif(tx, kej.id, tujuan);
    if (ada) return untukLayar(ada, isi);
    // Lanjutkan tahap terakhir yang sudah dicapai (gabungan) bila ada riwayat soal.
    const [terakhir] = await tx
      .select({ tahap: schema.soalKejadian.tahap })
      .from(schema.soalKejadian)
      .where(and(eq(schema.soalKejadian.kejadianId, kej.id), eq(schema.soalKejadian.tujuan, tujuan)))
      .orderBy(desc(schema.soalKejadian.dibuat))
      .limit(1);
    const r = await soalBaru(tx, k, kej, isi, tujuan, terakhir?.tahap ?? 0, { tingkat: isi.soal.tingkat, benarBeruntun: 0, salahBeruntun: 0 });
    return untukLayar(r, isi);
  });
}

/** Periksa satu jawaban. Benar cukup = lolos (atau tahap berikut / tunda); salah = soal baru. */
export async function jawab(p: Penjawab, kejadianId: string, soalId: string, jawaban: string, sekarang = new Date()): Promise<HasilJawab> {
  return denganPengguna(p.penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, p.penggunaId);
    const kej = await kejadianMilik(tx, k, kejadianId);
    const isi = isiKejadian(kej, k);
    const [s] = z.uuid().safeParse(soalId).success
      ? await tx
          .select()
          .from(schema.soalKejadian)
          .where(and(eq(schema.soalKejadian.id, soalId), eq(schema.soalKejadian.kejadianId, kej.id), eq(schema.soalKejadian.status, "aktif")))
          .for("update")
      : [];
    if (!s) throw new GalatLayanan("masukan", k.t.jawab.soalBerganti);
    const tujuan = s.tujuan as Tujuan;
    pastikanBoleh(kej, isi, tujuan, k);

    const masukan = String(jawaban).slice(0, 300);
    const benar =
      s.jenis === "qr"
        ? await pindaianCocok(tx, k.id, s.kodeQr, masukan)
        : !!s.hashJawaban && samaHash(hashJawaban(s.garam, bakukanJawaban(s.jenis as JenisSoalDibuat, masukan)), s.hashJawaban);
    await tx
      .update(schema.soalKejadian)
      .set({ status: benar ? "benar" : "salah", dijawabPada: sekarang })
      .where(eq(schema.soalKejadian.id, s.id));
    const keadaan = sesudahJawab({ tingkat: s.tingkat as Tingkat, benarBeruntun: s.benarBeruntun, salahBeruntun: s.salahBeruntun }, benar);

    if (keadaan.benarBeruntun >= s.target) {
      if (tujuan === "tunda") {
        const sampai = new Date(sekarang.getTime() + isi.tunda.menit * 60_000);
        await tundaKejadian(tx, kej.id, sampai, sekarang);
        await catatAudit(k.id, { sumber: p.oleh === "perangkat" ? "perangkat" : "web", jenis: "kejadian", ringkasan: "Alarm ditunda", detail: { kejadianId: kej.id } }, tx);
        return { hasil: "ditunda", sampai };
      }
      if (s.tahap + 1 < jumlahTahap(isi, tujuan)) {
        const r = await soalBaru(tx, k, kej, isi, tujuan, s.tahap + 1, { tingkat: isi.soal.tingkat, benarBeruntun: 0, salahBeruntun: 0 });
        return { hasil: "tahap", soal: untukLayar(r, isi) };
      }
      const oleh: Penghenti = { oleh: p.oleh, perangkatId: p.perangkatId };
      const h = await lolosKejadian(tx, kej.id, sekarang, oleh);
      await catatAudit(k.id, { sumber: p.oleh === "perangkat" ? "perangkat" : "web", jenis: "kejadian", ringkasan: "Soal alarm terjawab", detail: { kejadianId: kej.id } }, tx);
      return { hasil: "selesai", status: h?.status === "cek_bangun" ? "cek_bangun" : "bangun", cekPada: h?.cekPada ?? null };
    }

    // Misi QR gagal 3 kali (salah kode, PRD D6): diganti hitungan Berat 3 soal.
    if (s.jenis === "qr" && !benar && s.salahBeruntun + 1 >= SALAH_UNTUK_TURUN) {
      const r = await soalBaru(tx, k, kej, isi, tujuan, s.tahap, { tingkat: "berat", benarBeruntun: 0, salahBeruntun: 0 }, { jenis: "hitungan", target: 3 });
      return { hasil: "diganti", soal: untukLayar(r, isi) };
    }
    const lanjutQr = s.jenis === "qr" ? { tingkat: s.tingkat as Tingkat, benarBeruntun: 0, salahBeruntun: s.salahBeruntun + 1 } : keadaan;
    const paksa = s.jenis === "hitungan" && s.target !== (tujuan === "tunda" ? 1 : isi.soal.benar) ? { jenis: "hitungan" as const, target: s.target } : undefined;
    const r = await soalBaru(tx, k, kej, isi, tujuan, s.tahap, lanjutQr, paksa);
    return { hasil: benar ? "benar" : "salah", soal: untukLayar(r, isi) };
  });
}

/** Kamera ditolak (PRD D6): Misi QR langsung diganti hitungan Berat 3 soal. */
export async function gantiSoalKamera(p: Penjawab, kejadianId: string): Promise<SoalUntukLayar> {
  return denganPengguna(p.penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, p.penggunaId);
    const kej = await kejadianMilik(tx, k, kejadianId);
    const isi = isiKejadian(kej, k);
    pastikanBoleh(kej, isi, "bangun", k);
    const s = await soalAktif(tx, kej.id, "bangun");
    if (!s || s.jenis !== "qr") throw new GalatLayanan("masukan", k.t.jawab.soalBerganti);
    await tx.update(schema.soalKejadian).set({ status: "diganti" }).where(eq(schema.soalKejadian.id, s.id));
    const r = await soalBaru(tx, k, kej, isi, "bangun", s.tahap, { tingkat: "berat", benarBeruntun: 0, salahBeruntun: 0 }, { jenis: "hitungan", target: 3 });
    return untukLayar(r, isi);
  });
}

/** Ketuk "Masih!" (PRD E2). */
export async function konfirmasiMasihBangun(p: Penjawab, kejadianId: string, sekarang = new Date()): Promise<{ status: "bangun" }> {
  return denganPengguna(p.penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, p.penggunaId);
    const kej = await kejadianMilik(tx, k, kejadianId);
    if (kej.status !== "cek_bangun") throw new GalatLayanan("masukan", k.t.jawab.tidakBerbunyi);
    if (kej.cekPada && kej.cekPada.getTime() > sekarang.getTime() + 5_000) throw new GalatLayanan("masukan", k.t.jawab.belumWaktunya);
    const h = await konfirmasiBangun(tx, kej.id, sekarang);
    if (!h) throw new GalatLayanan("masukan", k.t.jawab.lewatBatas);
    return { status: "bangun" };
  });
}

/**
 * Jawaban aplikasi PC yang dikerjakan LURING (PRD D8). Soal ke-i diturunkan dari kunci kejadian
 * (`benihLuring`), jadi server memeriksa ulang setiap jawaban; PC tidak bisa memilih soal gampang.
 */
export async function selesaiLuring(perangkat: { penggunaId: string; id: string }, kejadianId: string, jawaban: unknown, sekarang = new Date()): Promise<{ lolos: boolean }> {
  const h = z.array(z.string().max(12)).max(200).safeParse(jawaban);
  return denganPengguna(perangkat.penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, perangkat.penggunaId);
    if (!h.success) throw new GalatLayanan("masukan", k.t.jawab.soalBerganti);
    const kej = await kejadianMilik(tx, k, kejadianId);
    const isi = isiKejadian(kej, k);
    if (!STATUS_BOLEH.bangun.includes(kej.status)) return { lolos: false };
    // Masuk akal: sesudah jadwal, paling lama 6 jam kemudian.
    if (sekarang < kej.jadwalUtc || sekarang.getTime() - kej.jadwalUtc.getTime() > 6 * 3_600_000) return { lolos: false };
    const kunci = kej.uji || !kej.alarmId ? `uji:${kej.id}` : `${kej.alarmId}:${kej.tanggalLokal}`;
    const r = await periksaLuring(kunci, isi.soal.tingkat, isi.soal.benar, h.data);
    if (!r.lolos) return { lolos: false };
    await lolosKejadian(tx, kej.id, sekarang, { oleh: "luring", perangkatId: perangkat.id });
    await catatAudit(k.id, { sumber: "perangkat", jenis: "kejadian", ringkasan: "Soal luring terjawab di PC", detail: { kejadianId: kej.id, perangkatId: perangkat.id } }, tx);
    return { lolos: true };
  });
}

/** Soal yang pernah ditampilkan untuk kejadian (riwayat, PRD K1). Tanpa jawaban. */
export async function riwayatSoal(penggunaId: string, kejadianId: string) {
  return denganPengguna(penggunaId, (tx) =>
    tx
      .select({
        jenis: schema.soalKejadian.jenis,
        tingkat: schema.soalKejadian.tingkat,
        tujuan: schema.soalKejadian.tujuan,
        status: schema.soalKejadian.status,
        dijawabPada: schema.soalKejadian.dijawabPada,
      })
      .from(schema.soalKejadian)
      .where(
        and(
          eq(schema.soalKejadian.penggunaId, penggunaId),
          eq(schema.soalKejadian.kejadianId, kejadianId),
          inArray(schema.soalKejadian.status, ["benar", "salah", "diganti", "aktif"]),
        ),
      )
      .orderBy(schema.soalKejadian.dibuat),
  );
}
