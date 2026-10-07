import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { isiDariBaris } from "@/lib/alarm/baris";
import { barisDari, schema, type Tx } from "@/lib/db";
import { materialisasi } from "@/lib/layanan/alarm";
import {
  saluranCekTampilTiruan,
  saluranKabarTerlewatTiruan,
  saluranNotifikasiTiruan,
  saluranSpamTiruan,
  saluranTuyaTiruan,
  type BarisKejadian,
  type BarisLangkah,
  type HasilLangkah,
  type IsiKejadian,
  type RencanaLangkah,
  type Saluran,
} from "./saluran";

/**
 * Mesin status kejadian (arsitektur §4). Semua fungsi menerima transaksi dan tidak tahu siapa
 * pemanggilnya (worker, web, uji), jadi aturan transisi ada di SATU tempat. Peristiwa ke perangkat
 * dikirim pemicu DB (`kabar_kejadian`, migrasi 0003) saat transaksi berhasil.
 *
 *   menunggu ──(jadwal tiba)──▶ berbunyi ──(soal benar)──▶ cek_bangun ──(ketuk "Masih!")──▶ bangun
 *      │                          │  ▲  ▲                     │ (Masih bangun mati: langsung bangun)
 *      │ (> 30 mnt terlambat)     │  │  └──(tidak diketuk)────┘
 *      ▼                          │  └──(tunda habis)── ditunda ◀──(soal tunda benar)
 *   terlewat                      ▼
 *                             tidak_bangun (batas waktu, PRD C4)
 */

export const STATUS_AKTIF = ["berbunyi", "ditunda", "cek_bangun"] as const;
/** Kejadian yang terlambat lebih dari ini (server sempat mati) dicatat terlewat, tidak dibunyikan (PRD C6). */
export const BATAS_TERLAMBAT_MS = 30 * 60_000;
/** Langkah berstatus `jalan` lebih lama dari ini dianggap ditinggal worker yang mati: diulang. */
export const LANGKAH_MACET_MS = 2 * 60_000;

// ------------------------------------------------------------------ saluran

/** Batas berhenti sendiri (PRD C4): sesudah X menit berbunyi tanpa jawaban = tidak bangun. */
export const saluranBatas: Saluran = {
  jenis: "batas",
  saatTunda: "lanjut",
  rencana: (isi, mulai) => (isi.batasMenit ? [{ jatuhTempo: new Date(mulai.getTime() + isi.batasMenit * 60_000) }] : []),
  async jalankan() {
    return { hasil: { batas: true }, akhiri: "tidak_bangun" };
  },
};

/** Batas mengetuk "Masih bangun?" lewat: alarm kembali penuh, tanpa tunda, soal baru (PRD E2). */
export const saluranCekBatas: Saluran = {
  jenis: "cek_batas",
  saatTunda: "lanjut",
  rencana: () => [],
  async jalankan() {
    return { hasil: { tidakDiketuk: true }, bunyikanLagi: true };
  },
};

const SALURAN_BAWAAN: Saluran[] = [
  saluranNotifikasiTiruan,
  saluranSpamTiruan,
  saluranTuyaTiruan,
  saluranKabarTerlewatTiruan,
  saluranCekTampilTiruan,
  saluranBatas,
  saluranCekBatas,
];
/** Saluran milik "Masih bangun?": hanya pantas saat status cek_bangun. */
const SALURAN_CEK = new Set(["cek_tampil", "cek_batas"]);
let saluran: Saluran[] = SALURAN_BAWAAN;

/** Ganti daftar saluran (paket P5 sampai P7 memasang implementasi asli; uji memasang pencatat). */
export function pasangSaluran(daftar: Saluran[] | null) {
  saluran = daftar ?? SALURAN_BAWAAN;
}
export function cariSaluran(jenis: string): Saluran | undefined {
  return saluran.find((s) => s.jenis === jenis);
}

// ------------------------------------------------------------------ pembantu

/** Urutan pertama yang belum terpakai di blok `urutanDasar` (rencana ulang sesudah tunda tidak bentrok dengan langkah lama). */
async function urutanBebas(tx: Tx, kejadianId: string, jenis: string, urutanDasar: number): Promise<number> {
  const blok = Math.floor(urutanDasar / 100_000) * 100_000;
  const [r] = barisDari<{ n: number | null }>(
    await tx.execute(
      sql`select max(urutan) as n from langkah_kejadian where kejadian_id = ${kejadianId} and jenis = ${jenis} and urutan >= ${blok} and urutan < ${blok + 100_000}`,
    ),
  );
  return r?.n === null || r?.n === undefined ? urutanDasar : Math.max(urutanDasar, Number(r.n) + 1);
}

async function tulisRencana(tx: Tx, k: BarisKejadian, s: Saluran, rencana: RencanaLangkah[], sekarang: Date) {
  for (const r of rencana) {
    await tx
      .insert(schema.langkahKejadian)
      .values({
        penggunaId: k.penggunaId,
        kejadianId: k.id,
        jenis: s.jenis,
        urutan: await urutanBebas(tx, k.id, s.jenis, r.urutan ?? 0),
        jatuhTempoUtc: r.jatuhTempo,
        parameter: r.parameter ?? null,
        dibuat: sekarang,
        diubah: sekarang,
      })
      .onConflictDoNothing();
  }
}

async function batalkanLangkah(tx: Tx, kejadianId: string, sekarang: Date, hanyaJenis?: string[]) {
  await tx
    .update(schema.langkahKejadian)
    .set({ status: "dibatalkan", diubah: sekarang })
    .where(
      and(
        eq(schema.langkahKejadian.kejadianId, kejadianId),
        eq(schema.langkahKejadian.status, "menunggu"),
        hanyaJenis ? inArray(schema.langkahKejadian.jenis, hanyaJenis) : undefined,
      ),
    );
}

// ------------------------------------------------------------------ transisi

export type HasilKlaim = { kejadian: BarisKejadian; hasil: "berbunyi" | "terlewat" };

/**
 * Klaim kejadian `menunggu` yang jadwalnya tiba (FOR UPDATE SKIP LOCKED: dua worker tidak pernah
 * mengambil kejadian yang sama), ubah ke `berbunyi` (atau `terlewat` bila > 30 menit), rencanakan
 * langkahnya, lalu materialisasi kejadian berikutnya alarm itu, semua dalam SATU transaksi.
 */
export async function klaimJatuhTempo(tx: Tx, sekarang: Date, batas = 20): Promise<HasilKlaim[]> {
  const ids = barisDari<{ id: string }>(
    await tx.execute(
      sql`select id from kejadian_alarm where status = 'menunggu' and jadwal_utc <= ${sekarang.toISOString()} order by jadwal_utc limit ${batas} for update skip locked`,
    ),
  );
  const hasil: HasilKlaim[] = [];
  for (const { id } of ids) {
    const [k] = await tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, id));
    // Alarm dikunci SKIP LOCKED: bila layanan sedang mengubahnya, kejadian ini dicoba lagi di
    // putaran berikutnya (± 1 dtk). Urutan kunci layanan (alarm lalu kejadian) dan worker
    // (kejadian lalu alarm) tidak pernah saling menunggu, jadi tidak ada kebuntuan.
    const [a] = k.alarmId ? await tx.select().from(schema.alarm).where(eq(schema.alarm.id, k.alarmId)).for("update", { skipLocked: true }) : [];
    if (k.alarmId && !a) continue;
    const terlambatMs = Math.max(0, sekarang.getTime() - k.jadwalUtc.getTime());
    const isi: IsiKejadian | null = (k.isi as IsiKejadian | null) ?? (a ? { ...isiDariBaris(a), zona: a.zona } : null);

    let baru: BarisKejadian;
    if (terlambatMs > BATAS_TERLAMBAT_MS) {
      [baru] = await tx.update(schema.kejadianAlarm).set({ status: "terlewat", isi, diubah: sekarang }).where(eq(schema.kejadianAlarm.id, id)).returning();
      for (const s of saluran) if (s.rencanaTerlewat) await tulisRencana(tx, baru, s, s.rencanaTerlewat(isi, sekarang, baru), sekarang);
      hasil.push({ kejadian: baru, hasil: "terlewat" });
    } else {
      [baru] = await tx
        .update(schema.kejadianAlarm)
        .set({ status: "berbunyi", berbunyiPada: sekarang, terlambatDtk: Math.round(terlambatMs / 1000), isi, diubah: sekarang })
        .where(eq(schema.kejadianAlarm.id, id))
        .returning();
      if (isi) for (const s of saluran) await tulisRencana(tx, baru, s, s.rencana(isi, sekarang, baru), sekarang);
      hasil.push({ kejadian: baru, hasil: "berbunyi" });
    }

    // Kejadian berikutnya alarm ini (uji alarm tidak menggeser jadwal asli).
    if (a && !k.uji) {
      if (a.pengulangan.jenis === "sekali") {
        await tx.update(schema.alarm).set({ aktif: false, diubah: sekarang }).where(eq(schema.alarm.id, a.id));
      } else {
        // Terlewat: lompat ke kejadian sesudah SEKARANG (tidak menumpuk kejadian terlewat tiap hari).
        await materialisasi(tx, a, terlambatMs > BATAS_TERLAMBAT_MS ? sekarang : k.jadwalUtc);
      }
    }
  }
  return hasil;
}

/** Hentikan kejadian aktif (soal benar = bangun, batas waktu = tidak_bangun). Tidak berbuat apa-apa bila sudah berhenti. */
export async function hentikanKejadian(tx: Tx, kejadianId: string, status: "bangun" | "tidak_bangun" | "dibatalkan", sekarang: Date): Promise<BarisKejadian | null> {
  const [k] = await tx
    .update(schema.kejadianAlarm)
    .set({ status, bangunPada: status === "bangun" ? sekarang : null, tundaSampai: null, diubah: sekarang })
    .where(and(eq(schema.kejadianAlarm.id, kejadianId), inArray(schema.kejadianAlarm.status, [...STATUS_AKTIF])))
    .returning();
  if (k) await batalkanLangkah(tx, kejadianId, sekarang);
  return k ?? null;
}

export type Penghenti = { oleh: "sesi" | "perangkat" | "luring"; perangkatId?: string | null };

/**
 * Soal terjawab (layanan jawab): bila "Masih bangun?" aktif, alarm diam dan pindah ke `cek_bangun`
 * (cek tampil N menit lagi, batas mengetuk sesudahnya); selain itu langsung `bangun`. Waktu bangun
 * dicatat sekarang (skor dihitung dari berbunyi sampai lolos).
 */
export async function lolosKejadian(tx: Tx, kejadianId: string, sekarang: Date, oleh: Penghenti): Promise<BarisKejadian | null> {
  const [k] = await tx
    .select()
    .from(schema.kejadianAlarm)
    .where(and(eq(schema.kejadianAlarm.id, kejadianId), inArray(schema.kejadianAlarm.status, ["berbunyi", "ditunda"])))
    .for("update");
  if (!k) return null;
  const isi = k.isi as IsiKejadian | null;
  const penanda = { selesaiOleh: oleh.oleh, perangkatSelesai: oleh.perangkatId ?? null };
  if (!isi?.masihBangun.aktif || k.uji) {
    const h = await hentikanKejadian(tx, k.id, "bangun", sekarang);
    if (h) await tx.update(schema.kejadianAlarm).set(penanda).where(eq(schema.kejadianAlarm.id, k.id));
    return h ? { ...h, ...penanda } : null;
  }
  const cekPada = new Date(sekarang.getTime() + isi.masihBangun.menit * 60_000);
  const cekBatas = new Date(cekPada.getTime() + isi.masihBangun.batasDtk * 1000);
  const [b] = await tx
    .update(schema.kejadianAlarm)
    .set({ status: "cek_bangun", bangunPada: sekarang, tundaSampai: null, cekPada, cekBatas, ...penanda, diubah: sekarang })
    .where(eq(schema.kejadianAlarm.id, k.id))
    .returning();
  await batalkanLangkah(tx, k.id, sekarang);
  await tulisRencana(tx, b, saluranCekTampilTiruan, [{ jatuhTempo: cekPada }], sekarang);
  await tulisRencana(tx, b, saluranCekBatas, [{ jatuhTempo: cekBatas }], sekarang);
  return b;
}

/** "Masih!" diketuk dalam jendela cek: bangun. Null bila bukan saatnya (belum tampil atau sudah lewat). */
export async function konfirmasiBangun(tx: Tx, kejadianId: string, sekarang: Date): Promise<BarisKejadian | null> {
  const [k] = await tx
    .update(schema.kejadianAlarm)
    .set({ status: "bangun", diubah: sekarang })
    .where(
      and(
        eq(schema.kejadianAlarm.id, kejadianId),
        eq(schema.kejadianAlarm.status, "cek_bangun"),
        lte(schema.kejadianAlarm.cekPada, new Date(sekarang.getTime() + 5_000)),
        sql`${schema.kejadianAlarm.cekBatas} >= ${sekarang.toISOString()}`,
      ),
    )
    .returning();
  if (k) await batalkanLangkah(tx, kejadianId, sekarang);
  return k ?? null;
}

/** Tidak diketuk: kembali berbunyi penuh tanpa tunda; saluran direncanakan ulang. */
export async function bunyikanLagiDariCek(tx: Tx, kejadianId: string, sekarang: Date): Promise<BarisKejadian | null> {
  const [k] = await tx
    .update(schema.kejadianAlarm)
    .set({ status: "berbunyi", tanpaTunda: true, bangunPada: null, cekPada: null, cekBatas: null, selesaiOleh: null, perangkatSelesai: null, diubah: sekarang })
    .where(and(eq(schema.kejadianAlarm.id, kejadianId), eq(schema.kejadianAlarm.status, "cek_bangun")))
    .returning();
  if (!k) return null;
  await batalkanLangkah(tx, kejadianId, sekarang);
  const isi = k.isi as IsiKejadian | null;
  if (isi) for (const s of saluran.filter((x) => !SALURAN_CEK.has(x.jenis) && x.jenis !== "kabar_terlewat")) await tulisRencana(tx, k, s, s.rencana(isi, sekarang, k), sekarang);
  return k;
}

/** Tunda kejadian berbunyi sampai `sampai` (layanan jawab, sesudah soal tunda benar). Saluran `berhenti` dibatalkan. */
export async function tundaKejadian(tx: Tx, kejadianId: string, sampai: Date, sekarang: Date): Promise<BarisKejadian | null> {
  const [k] = await tx
    .update(schema.kejadianAlarm)
    .set({ status: "ditunda", tundaSampai: sampai, jumlahTunda: sql`${schema.kejadianAlarm.jumlahTunda} + 1`, diubah: sekarang })
    .where(and(eq(schema.kejadianAlarm.id, kejadianId), eq(schema.kejadianAlarm.status, "berbunyi"), eq(schema.kejadianAlarm.tanpaTunda, false)))
    .returning();
  if (k)
    await batalkanLangkah(
      tx,
      kejadianId,
      sekarang,
      saluran.filter((s) => s.saatTunda === "berhenti").map((s) => s.jenis),
    );
  return k ?? null;
}

/** Kejadian yang tundanya habis kembali berbunyi; saluran yang berhenti saat tunda direncanakan ulang. */
export async function bangunkanTundaHabis(tx: Tx, sekarang: Date, batas = 20): Promise<BarisKejadian[]> {
  const ids = barisDari<{ id: string }>(
    await tx.execute(
      sql`select id from kejadian_alarm where status = 'ditunda' and tunda_sampai <= ${sekarang.toISOString()} order by tunda_sampai limit ${batas} for update skip locked`,
    ),
  );
  const hasil: BarisKejadian[] = [];
  for (const { id } of ids) {
    const [k] = await tx.update(schema.kejadianAlarm).set({ status: "berbunyi", tundaSampai: null, diubah: sekarang }).where(eq(schema.kejadianAlarm.id, id)).returning();
    const isi = k.isi as IsiKejadian | null;
    if (isi) for (const s of saluran.filter((x) => x.saatTunda === "berhenti")) await tulisRencana(tx, k, s, s.rencana(isi, sekarang, k), sekarang);
    hasil.push(k);
  }
  return hasil;
}

// ------------------------------------------------------------------ langkah

export type LangkahDiklaim = { langkah: BarisLangkah; kejadian: BarisKejadian };

/** Klaim langkah jatuh tempo (SKIP LOCKED) dan tandai `jalan`. Eksekusinya di luar transaksi ini. */
export async function klaimLangkah(tx: Tx, sekarang: Date, batas = 50): Promise<LangkahDiklaim[]> {
  const ids = barisDari<{ id: number }>(
    await tx.execute(
      sql`select id from langkah_kejadian where status = 'menunggu' and jatuh_tempo_utc <= ${sekarang.toISOString()} order by jatuh_tempo_utc limit ${batas} for update skip locked`,
    ),
  );
  if (!ids.length) return [];
  const langkah = await tx
    .update(schema.langkahKejadian)
    .set({ status: "jalan", percobaan: sql`${schema.langkahKejadian.percobaan} + 1`, diubah: sekarang })
    .where(
      inArray(
        schema.langkahKejadian.id,
        ids.map((x) => Number(x.id)),
      ),
    )
    .returning();
  const kej = await tx
    .select()
    .from(schema.kejadianAlarm)
    .where(
      inArray(
        schema.kejadianAlarm.id,
        langkah.map((l) => l.kejadianId),
      ),
    );
  return langkah.map((l) => ({ langkah: l, kejadian: kej.find((k) => k.id === l.kejadianId)! }));
}

/** Apakah langkah ini masih pantas dijalankan untuk keadaan kejadian sekarang. */
export function langkahPantas(jenis: string, statusKejadian: string): boolean {
  const s = cariSaluran(jenis);
  if (!s) return false;
  if (jenis === "kabar_terlewat") return statusKejadian === "terlewat";
  if (SALURAN_CEK.has(jenis)) return statusKejadian === "cek_bangun";
  if (statusKejadian === "berbunyi") return true;
  return statusKejadian === "ditunda" && s.saatTunda === "lanjut";
}

/** Catat hasil satu langkah, jadwalkan ulangannya, dan terapkan permintaan mengakhiri kejadian. */
export async function catatHasilLangkah(tx: Tx, l: BarisLangkah, h: HasilLangkah & { dilewati?: boolean }, sekarang: Date) {
  await tx
    .update(schema.langkahKejadian)
    .set({ status: h.dilewati ? "dibatalkan" : h.gagal ? "gagal" : "selesai", hasil: h.hasil, diubah: sekarang })
    .where(eq(schema.langkahKejadian.id, l.id));
  if (h.dilewati) return;
  const [k] = await tx.select().from(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, l.kejadianId)).for("update");
  if (!k) return;
  if (h.akhiri && (STATUS_AKTIF as readonly string[]).includes(k.status)) {
    await hentikanKejadian(tx, k.id, h.akhiri, sekarang);
    await tx.update(schema.kejadianAlarm).set({ selesaiOleh: "batas" }).where(eq(schema.kejadianAlarm.id, k.id));
    return;
  }
  if (h.bunyikanLagi && k.status === "cek_bangun") {
    await bunyikanLagiDariCek(tx, k.id, sekarang);
    return;
  }
  if (h.ulangiPada && langkahPantas(l.jenis, k.status)) {
    await tx
      .insert(schema.langkahKejadian)
      .values({
        penggunaId: l.penggunaId,
        kejadianId: l.kejadianId,
        jenis: l.jenis,
        urutan: await urutanBebas(tx, l.kejadianId, l.jenis, l.urutan),
        jatuhTempoUtc: h.ulangiPada,
        parameter: l.parameter,
        dibuat: sekarang,
        diubah: sekarang,
      })
      .onConflictDoNothing();
  }
}

/** Langkah `jalan` yang ditinggal worker mati (restart di tengah alarm) dikembalikan ke antrean. */
export async function pulihkanLangkahMacet(tx: Tx, sekarang: Date): Promise<number> {
  const r = await tx
    .update(schema.langkahKejadian)
    .set({ status: "menunggu", diubah: sekarang })
    .where(and(eq(schema.langkahKejadian.status, "jalan"), lte(schema.langkahKejadian.diubah, new Date(sekarang.getTime() - LANGKAH_MACET_MS))))
    .returning({ id: schema.langkahKejadian.id });
  return r.length;
}

/**
 * Jaring pengaman invarian: alarm aktif tanpa kejadian `menunggu` dimaterialisasi (mis. sesudah
 * pemulihan cadangan). Dijalankan worker saat mulai dan berkala.
 */
export async function lengkapiMaterialisasi(tx: Tx, sekarang: Date): Promise<number> {
  const daftar = await tx
    .select()
    .from(schema.alarm)
    .where(and(eq(schema.alarm.aktif, true), sql`not exists (select 1 from kejadian_alarm k where k.alarm_id = "alarm"."id" and k.status = 'menunggu' and not k.uji)`));
  let n = 0;
  for (const a of daftar) if (await materialisasi(tx, a, sekarang)) n++;
  return n;
}

/** Waktu paling dekat yang perlu dibangunkan worker (kejadian, tunda, langkah), atau null. */
export async function jadwalTerdekat(tx: Tx): Promise<Date | null> {
  const [r] = barisDari<{ t: string | Date | null }>(
    await tx.execute(
      sql`select least(
        (select min(jadwal_utc) from kejadian_alarm where status = 'menunggu'),
        (select min(tunda_sampai) from kejadian_alarm where status = 'ditunda'),
        (select min(jatuh_tempo_utc) from langkah_kejadian where status = 'menunggu')
      ) as t`,
    ),
  );
  return r?.t ? new Date(r.t) : null;
}
