import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { isiDariBaris, kolomDariIsi, type BarisAlarm } from "@/lib/alarm/baris";
import { BAWAAN_SISTEM, MAKS_ALARM, SkemaIsiAlarmUtuh, SkemaMasukanAlarm, type IsiAlarm, type MasukanAlarm } from "@/lib/alarm/isi";
import { keadaanKunci, periksaKomitmen, type KeadaanKunci } from "@/lib/alarm/komitmen";
import { barisDari, denganPengguna, schema, type Tx } from "@/lib/db";
import { isi as isiTeks } from "@/lib/i18n";
import { cocok, kejadianBerikutnya, SkemaTanggal, tanggalSekaliBerikutnya, type Kejadian } from "@/lib/jadwal/pengulangan";
import { catatAudit } from "./audit";
import { GalatLayanan, pesanMasukan, type Sumber } from "./dasar";
import { pastikanKodeQrMilik } from "./kode-qr";
import { periksaAturanTuya } from "./tuya";
import { rencanakanNaskahAlarm, statusSuaraAlarm, type StatusSuara } from "./suara";
import { jamTampil, konteksPengguna, type KonteksPengguna } from "./konteks";
import { cariTemplate } from "./template";

/**
 * Layanan alarm (PRD B1 sampai B4, B10, B11, E3; arsitektur §4.1). Dipakai web (P8), MCP (P12),
 * dan aplikasi PC lewat API. Aturan inti:
 *
 *  - ID alarm tetap seumur hidup; ubah menulis baris yang sama.
 *  - Alarm aktif punya TEPAT SATU kejadian `menunggu` untuk jadwal berikutnya, ditulis di
 *    transaksi yang sama dengan perubahan alarm (`materialisasi`). Alarm aktif yang tidak akan
 *    pernah berbunyi lagi ditolak, jadi invarian ini tidak pernah dilanggar.
 *  - Alarm yang sedang berbunyi (berbunyi, ditunda, cek bangun) tidak bisa diubah, dihapus,
 *    dimatikan, atau dilewati dari mana pun: hanya soal di layar alarm (aturan teknis 2).
 *  - Mode Komitmen diperiksa satu modul murni (`src/lib/alarm/komitmen.ts`).
 */

export type Opsi = { sekarang?: Date };

const STATUS_AKTIF = ["berbunyi", "ditunda", "cek_bangun"] as const;

export type AlarmLengkap = IsiAlarm & {
  id: string;
  zona: string;
  dariTemplate: string | null;
  dibuat: Date;
  diubah: Date;
  /** Kejadian berikutnya (null bila nonaktif). */
  berikutnya: Kejadian | null;
  /** Tanggal lokal yang dilewati, hari ini dan sesudahnya. */
  lewati: string[];
  /** Mode Komitmen sedang mengunci alarm ini sampai jam tersebut. */
  terkunciSampai: Date | null;
  /** Sedang berbunyi, ditunda, atau menunggu konfirmasi bangun. */
  berbunyi: boolean;
  /** Suara omelan: siap, sedang dibuat, atau belum bisa dibuat + alasan (PRD F4). */
  suara: StatusSuara;
};

// ------------------------------------------------------------------ pembantu

const idSah = (id: string) => z.uuid().safeParse(id).success;

async function ambilBaris(tx: Tx, k: KonteksPengguna, id: string, kunci = false): Promise<BarisAlarm> {
  if (!idSah(id)) throw new GalatLayanan("tidak_ditemukan", k.t.galat.alarmTidakAda);
  const q = tx
    .select()
    .from(schema.alarm)
    .where(and(eq(schema.alarm.penggunaId, k.id), eq(schema.alarm.id, id)));
  const [a] = kunci ? await q.for("update") : await q;
  if (!a) throw new GalatLayanan("tidak_ditemukan", k.t.galat.alarmTidakAda);
  return a;
}

async function daftarLewati(tx: Tx, alarmId: string): Promise<string[]> {
  const r = await tx.select({ tanggal: schema.lewatiAlarm.tanggal }).from(schema.lewatiAlarm).where(eq(schema.lewatiAlarm.alarmId, alarmId));
  return r.map((x) => x.tanggal);
}

async function kejadianMenunggu(tx: Tx, alarmId: string, kunci = false) {
  const q = tx
    .select()
    .from(schema.kejadianAlarm)
    .where(and(eq(schema.kejadianAlarm.alarmId, alarmId), eq(schema.kejadianAlarm.status, "menunggu"), eq(schema.kejadianAlarm.uji, false)));
  const [m] = kunci ? await q.for("update") : await q;
  return m ?? null;
}

async function pastikanTidakBerbunyi(tx: Tx, k: KonteksPengguna, alarmId: string) {
  const r = await tx
    .select({ id: schema.kejadianAlarm.id })
    .from(schema.kejadianAlarm)
    .where(and(eq(schema.kejadianAlarm.alarmId, alarmId), inArray(schema.kejadianAlarm.status, [...STATUS_AKTIF])))
    .limit(1);
  if (r.length) throw new GalatLayanan("sedang_berbunyi", k.t.galat.sedangBerbunyi);
}

function hitungBerikutnya(i: IsiAlarm, zona: string, lewati: string[], sekarang: Date): Kejadian | null {
  return i.aktif ? kejadianBerikutnya(i.pengulangan, i.jam, zona, sekarang, { lewati, liburNasional: i.liburNasional }) : null;
}

/**
 * Pastikan kejadian `menunggu` alarm ini sesuai isinya sekarang: satu baris bila aktif dan masih
 * akan berbunyi, nol baris bila tidak. Dipakai juga worker (P3) sesudah kejadian diklaim.
 */
export async function materialisasi(tx: Tx, a: BarisAlarm, sekarang: Date): Promise<Kejadian | null> {
  const k = hitungBerikutnya(isiDariBaris(a), a.zona, await daftarLewati(tx, a.id), sekarang);
  const ada = await kejadianMenunggu(tx, a.id, true);
  if (!k) {
    if (ada) await tx.delete(schema.kejadianAlarm).where(eq(schema.kejadianAlarm.id, ada.id));
    return null;
  }
  const nilai = { jadwalUtc: k.utc, tanggalLokal: k.tanggal, jamLokal: a.jam, judul: a.agendaJudul, diubah: sekarang };
  if (ada) await tx.update(schema.kejadianAlarm).set(nilai).where(eq(schema.kejadianAlarm.id, ada.id));
  else await tx.insert(schema.kejadianAlarm).values({ penggunaId: a.penggunaId, alarmId: a.id, ...nilai });
  return k;
}

async function kunciSekarang(tx: Tx, k: KonteksPengguna, a: BarisAlarm, sekarang: Date): Promise<KeadaanKunci> {
  const m = await kejadianMenunggu(tx, a.id);
  return keadaanKunci(a, m?.jadwalUtc ?? null, k.jamTidur, a.zona, sekarang);
}

async function tegakkanKomitmen(
  tx: Tx,
  k: KonteksPengguna,
  a: BarisAlarm,
  sekarang: Date,
  aksi: "ubah" | "hapus" | "aktif" | "lewati",
  baru: IsiAlarm | null,
  jadwalBaru: Date | null,
) {
  const kunci = await kunciSekarang(tx, k, a, sekarang);
  const alasan = periksaKomitmen({ kunci, aksi, lama: isiDariBaris(a), baru, jadwalBaru });
  if (alasan && kunci.terkunci) {
    throw new GalatLayanan("komitmen_terkunci", isiTeks(k.t.galat.komitmen[alasan], { jam: jamTampil(kunci.sampai, a.zona, k.bahasa) }), {
      alasan,
      terkunciSampai: kunci.sampai.toISOString(),
    });
  }
}

/** Gabung lapisan isi (bawaan sistem, bawaan pengguna, template, lama, masukan) lalu periksa utuh. */
function rakit(lapisan: Array<Partial<MasukanAlarm> | Partial<IsiAlarm>>, k: KonteksPengguna, zona: string, sekarang: Date): IsiAlarm {
  const gabung: Record<string, unknown> = {};
  for (const l of lapisan) {
    for (const [kunci, nilai] of Object.entries(l)) {
      if (nilai === undefined) continue;
      const lama = gabung[kunci];
      // Isian bersarang (soal, tunda, spam, masih bangun) digabung per kunci.
      gabung[kunci] = nilai && typeof nilai === "object" && !Array.isArray(nilai) && kunci !== "pengulangan" && lama && typeof lama === "object" ? { ...lama, ...nilai } : nilai;
    }
  }
  const p = gabung.pengulangan as { jenis?: string; tanggal?: string } | undefined;
  if (p?.jenis === "sekali" && !p.tanggal && typeof gabung.jam === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(gabung.jam)) {
    gabung.pengulangan = { jenis: "sekali", tanggal: tanggalSekaliBerikutnya(gabung.jam, zona, sekarang) };
  }
  const h = SkemaIsiAlarmUtuh.safeParse(gabung);
  if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
  return h.data;
}

function periksaMasukan(masukan: unknown, k: KonteksPengguna): MasukanAlarm {
  const h = SkemaMasukanAlarm.safeParse(masukan ?? {});
  if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
  return h.data;
}

/** Alarm aktif yang tidak akan pernah berbunyi = ditolak (sekali yang sudah lewat, semua tanggal dilewati). */
function tolakBila<T>(k: KonteksPengguna, i: IsiAlarm, berikutnya: T | null): void {
  if (i.aktif && !berikutnya) throw new GalatLayanan("masukan", i.pengulangan.jenis === "sekali" && !i.liburNasional ? k.t.galat.sudahLewat : k.t.galat.tidakAkanBunyi);
}

async function lengkapi(tx: Tx, k: KonteksPengguna, daftar: BarisAlarm[], sekarang: Date): Promise<AlarmLengkap[]> {
  if (!daftar.length) return [];
  const ids = daftar.map((a) => a.id);
  const kej = await tx
    .select({ alarmId: schema.kejadianAlarm.alarmId, status: schema.kejadianAlarm.status, jadwalUtc: schema.kejadianAlarm.jadwalUtc, tanggal: schema.kejadianAlarm.tanggalLokal })
    .from(schema.kejadianAlarm)
    .where(and(inArray(schema.kejadianAlarm.alarmId, ids), inArray(schema.kejadianAlarm.status, ["menunggu", ...STATUS_AKTIF]), eq(schema.kejadianAlarm.uji, false)));
  const lw = await tx
    .select({ alarmId: schema.lewatiAlarm.alarmId, tanggal: schema.lewatiAlarm.tanggal })
    .from(schema.lewatiAlarm)
    .where(inArray(schema.lewatiAlarm.alarmId, ids))
    .orderBy(asc(schema.lewatiAlarm.tanggal));
  const suara = await statusSuaraAlarm(
    tx,
    k,
    daftar.map((a) => ({ id: a.id, isi: isiDariBaris(a) })),
  );
  return daftar.map((a) => {
    const m = kej.find((x) => x.alarmId === a.id && x.status === "menunggu");
    const berikutnya = m ? { utc: m.jadwalUtc, tanggal: m.tanggal } : null;
    const kunci = keadaanKunci(a, berikutnya?.utc ?? null, k.jamTidur, a.zona, sekarang);
    const hariIni = new Intl.DateTimeFormat("en-CA", { timeZone: a.zona }).format(sekarang);
    return {
      ...isiDariBaris(a),
      id: a.id,
      zona: a.zona,
      dariTemplate: a.dariTemplate,
      dibuat: a.dibuat,
      diubah: a.diubah,
      berikutnya,
      lewati: lw.filter((x) => x.alarmId === a.id && x.tanggal >= hariIni).map((x) => x.tanggal),
      terkunciSampai: kunci.terkunci ? kunci.sampai : null,
      berbunyi: kej.some((x) => x.alarmId === a.id && x.status !== "menunggu"),
      suara: suara.get(a.id) ?? { status: "siap" },
    };
  });
}

const ringkas = (i: { jam: string; agendaJudul: string }) => `${i.jam} ${i.agendaJudul}`;

// ------------------------------------------------------------------ baca

export async function daftarAlarm(penggunaId: string, opsi: Opsi = {}): Promise<AlarmLengkap[]> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const daftar = await tx.select().from(schema.alarm).where(eq(schema.alarm.penggunaId, penggunaId)).orderBy(asc(schema.alarm.jam), asc(schema.alarm.dibuat));
    return lengkapi(tx, k, daftar, sekarang);
  });
}

export async function ambilAlarm(penggunaId: string, id: string, opsi: Opsi = {}): Promise<AlarmLengkap> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const [a] = await lengkapi(tx, k, [await ambilBaris(tx, k, id)], sekarang);
    return a;
  });
}

/** Alarm yang paling dulu berbunyi (PRD B7), atau null. */
export async function alarmBerikutnya(penggunaId: string, opsi: Opsi = {}): Promise<AlarmLengkap | null> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const [m] = barisDari<{ alarm_id: string }>(
      await tx.execute(
        sql`select alarm_id from kejadian_alarm where pengguna_id = ${penggunaId} and status = 'menunggu' and not uji and alarm_id is not null order by jadwal_utc limit 1`,
      ),
    );
    if (!m) return null;
    const [a] = await lengkapi(tx, k, [await ambilBaris(tx, k, m.alarm_id)], sekarang);
    return a;
  });
}

// ------------------------------------------------------------------ ubah

export async function buatAlarm(penggunaId: string, masukan: unknown, sumber: Sumber, opsi: Opsi & { template?: string } = {}): Promise<AlarmLengkap> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const m = periksaMasukan(masukan, k);
    const [{ n }] = barisDari<{ n: number }>(await tx.execute(sql`select count(*)::int as n from alarm where pengguna_id = ${penggunaId}`));
    if (n >= MAKS_ALARM) throw new GalatLayanan("masukan", isiTeks(k.t.galat.batasAlarm, { n: MAKS_ALARM }));
    const tpl = opsi.template ? await cariTemplate(tx, k, opsi.template) : null;
    const dasar: Partial<IsiAlarm> = { ...BAWAAN_SISTEM, ...k.bawaan, agendaJudul: k.t.alarmBaru.judulBawaan, agendaDetail: null, tuya: [], kalimatPribadi: [], aktif: true };
    const isiBaru = rakit([dasar, { pengulangan: { jenis: "sekali" } }, tpl?.isi ?? {}, m], k, k.zona, sekarang);
    await pastikanKodeQrMilik(tx, k, isiBaru.soal.kodeQr);
    await periksaAturanTuya(tx, k, isiBaru.tuya);
    tolakBila(k, isiBaru, hitungBerikutnya(isiBaru, k.zona, [], sekarang));
    const [a] = await tx
      .insert(schema.alarm)
      .values({ penggunaId, zona: k.zona, dariTemplate: tpl?.id ?? null, ...kolomDariIsi(isiBaru) })
      .returning();
    await materialisasi(tx, a, sekarang);
    await rencanakanNaskahAlarm(tx, k, isiBaru);
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Alarm dibuat: ${ringkas(isiBaru)}`, detail: { alarmId: a.id, template: tpl?.id ?? null } }, tx);
    const [hasil] = await lengkapi(tx, k, [a], sekarang);
    return hasil;
  });
}

export async function ubahAlarm(penggunaId: string, id: string, masukan: unknown, sumber: Sumber, opsi: Opsi = {}): Promise<AlarmLengkap> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const a = await ambilBaris(tx, k, id, true);
    const m = periksaMasukan(masukan, k);
    await pastikanTidakBerbunyi(tx, k, a.id);
    const isiBaru = rakit([isiDariBaris(a), m], k, a.zona, sekarang);
    await pastikanKodeQrMilik(tx, k, isiBaru.soal.kodeQr);
    // Aturan rumah pintar diperiksa hanya bila diubah (perangkat lama yang hilang tidak menghalangi ubah jam).
    if ((m as { tuya?: unknown }).tuya !== undefined) await periksaAturanTuya(tx, k, isiBaru.tuya);
    const berikutnya = hitungBerikutnya(isiBaru, a.zona, await daftarLewati(tx, a.id), sekarang);
    await tegakkanKomitmen(tx, k, a, sekarang, "ubah", isiBaru, berikutnya?.utc ?? null);
    tolakBila(k, isiBaru, berikutnya);
    const [b] = await tx
      .update(schema.alarm)
      .set({ ...kolomDariIsi(isiBaru), diubah: sekarang })
      .where(eq(schema.alarm.id, a.id))
      .returning();
    await materialisasi(tx, b, sekarang);
    await rencanakanNaskahAlarm(tx, k, isiBaru);
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Alarm diubah: ${ringkas(isiBaru)}`, detail: { alarmId: a.id, isian: Object.keys(m) } }, tx);
    const [hasil] = await lengkapi(tx, k, [b], sekarang);
    return hasil;
  });
}

export async function hapusAlarm(penggunaId: string, id: string, sumber: Sumber, opsi: Opsi = {}): Promise<void> {
  const sekarang = opsi.sekarang ?? new Date();
  await denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const a = await ambilBaris(tx, k, id, true);
    await pastikanTidakBerbunyi(tx, k, a.id);
    await tegakkanKomitmen(tx, k, a, sekarang, "hapus", null, null);
    // Kejadian menunggu ikut hilang; kejadian lama tetap jadi riwayat (alarm_id = null).
    await tx.delete(schema.kejadianAlarm).where(and(eq(schema.kejadianAlarm.alarmId, a.id), eq(schema.kejadianAlarm.status, "menunggu")));
    await tx.delete(schema.alarm).where(eq(schema.alarm.id, a.id));
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Alarm dihapus: ${ringkas(a)}`, detail: { alarmId: a.id } }, tx);
  });
}

export async function aturAktifAlarm(penggunaId: string, id: string, aktif: boolean, sumber: Sumber, opsi: Opsi = {}): Promise<AlarmLengkap> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const a = await ambilBaris(tx, k, id, true);
    await pastikanTidakBerbunyi(tx, k, a.id);
    let isiBaru: IsiAlarm = { ...isiDariBaris(a), aktif };
    // Menyalakan lagi alarm sekali yang tanggalnya sudah lewat = kemunculan jam itu berikutnya (seperti jam weker).
    if (aktif && isiBaru.pengulangan.jenis === "sekali" && !hitungBerikutnya(isiBaru, a.zona, [], sekarang)) {
      isiBaru = { ...isiBaru, pengulangan: { jenis: "sekali", tanggal: tanggalSekaliBerikutnya(isiBaru.jam, a.zona, sekarang) } };
    }
    const berikutnya = hitungBerikutnya(isiBaru, a.zona, await daftarLewati(tx, a.id), sekarang);
    await tegakkanKomitmen(tx, k, a, sekarang, "aktif", isiBaru, berikutnya?.utc ?? null);
    tolakBila(k, isiBaru, berikutnya);
    const [b] = await tx.update(schema.alarm).set({ aktif, pengulangan: isiBaru.pengulangan, diubah: sekarang }).where(eq(schema.alarm.id, a.id)).returning();
    await materialisasi(tx, b, sekarang);
    await rencanakanNaskahAlarm(tx, k, isiBaru);
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Alarm ${aktif ? "dinyalakan" : "dimatikan"}: ${ringkas(a)}`, detail: { alarmId: a.id } }, tx);
    const [hasil] = await lengkapi(tx, k, [b], sekarang);
    return hasil;
  });
}

async function lewati(penggunaId: string, id: string, pilihTanggal: (tx: Tx, k: KonteksPengguna, a: BarisAlarm) => Promise<string>, sumber: Sumber, sekarang: Date) {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const a = await ambilBaris(tx, k, id, true);
    await pastikanTidakBerbunyi(tx, k, a.id);
    const tanggal = await pilihTanggal(tx, k, a);
    const daftar = await daftarLewati(tx, a.id);
    const isiA = isiDariBaris(a);
    const berikutnya = hitungBerikutnya(isiA, a.zona, [...daftar, tanggal], sekarang);
    await tegakkanKomitmen(tx, k, a, sekarang, "lewati", isiA, berikutnya?.utc ?? null);
    tolakBila(k, isiA, berikutnya);
    await tx.insert(schema.lewatiAlarm).values({ penggunaId, alarmId: a.id, tanggal }).onConflictDoNothing();
    await materialisasi(tx, a, sekarang);
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Alarm dilewati ${tanggal}: ${ringkas(a)}`, detail: { alarmId: a.id, tanggal } }, tx);
    const [hasil] = await lengkapi(tx, k, [a], sekarang);
    return hasil;
  });
}

/** Lewati sekali: kejadian berikutnya tidak berbunyi, alarm tetap aktif (PRD B4). */
export async function lewatiBerikutnya(penggunaId: string, id: string, sumber: Sumber, opsi: Opsi = {}): Promise<AlarmLengkap> {
  return lewati(
    penggunaId,
    id,
    async (tx, k, a) => {
      const m = await kejadianMenunggu(tx, a.id);
      if (!m) throw new GalatLayanan("masukan", k.t.galat.tidakAkanBunyi);
      return m.tanggalLokal;
    },
    sumber,
    opsi.sekarang ?? new Date(),
  );
}

/** Lewati tanggal lokal tertentu (YYYY-MM-DD). */
export async function lewatiTanggal(penggunaId: string, id: string, tanggal: unknown, sumber: Sumber, opsi: Opsi = {}): Promise<AlarmLengkap> {
  return lewati(
    penggunaId,
    id,
    async (_tx, k, a) => {
      const h = SkemaTanggal.safeParse(tanggal);
      if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
      if (!cocok(a.pengulangan, h.data)) throw new GalatLayanan("masukan", k.t.galat.tidakBunyiDiTanggal);
      return h.data;
    },
    sumber,
    opsi.sekarang ?? new Date(),
  );
}

/** Batalkan lewati: alarm kembali berbunyi pada tanggal itu. Selalu boleh (tidak melemahkan Komitmen). */
export async function batalLewati(penggunaId: string, id: string, tanggal: unknown, sumber: Sumber, opsi: Opsi = {}): Promise<AlarmLengkap> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const a = await ambilBaris(tx, k, id, true);
    const h = SkemaTanggal.safeParse(tanggal);
    if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
    await tx.delete(schema.lewatiAlarm).where(and(eq(schema.lewatiAlarm.alarmId, a.id), eq(schema.lewatiAlarm.tanggal, h.data)));
    await materialisasi(tx, a, sekarang);
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Lewati dibatalkan ${h.data}: ${ringkas(a)}`, detail: { alarmId: a.id, tanggal: h.data } }, tx);
    const [hasil] = await lengkapi(tx, k, [a], sekarang);
    return hasil;
  });
}

/**
 * Gandakan: salinan berisi sama tetapi NONAKTIF dan tanpa Komitmen, supaya dua alarm tidak
 * berbunyi bersamaan dan salinan tidak langsung terkunci (K-36). Pengguna mengubah jamnya lalu menyalakan.
 */
export async function gandakanAlarm(penggunaId: string, id: string, sumber: Sumber, opsi: Opsi = {}): Promise<AlarmLengkap> {
  const sekarang = opsi.sekarang ?? new Date();
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const a = await ambilBaris(tx, k, id);
    const [{ n }] = barisDari<{ n: number }>(await tx.execute(sql`select count(*)::int as n from alarm where pengguna_id = ${penggunaId}`));
    if (n >= MAKS_ALARM) throw new GalatLayanan("masukan", isiTeks(k.t.galat.batasAlarm, { n: MAKS_ALARM }));
    const [b] = await tx
      .insert(schema.alarm)
      .values({ penggunaId, zona: a.zona, dariTemplate: a.dariTemplate, ...kolomDariIsi({ ...isiDariBaris(a), aktif: false, komitmen: false }) })
      .returning();
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Alarm digandakan: ${ringkas(a)}`, detail: { dari: a.id, alarmId: b.id } }, tx);
    const [hasil] = await lengkapi(tx, k, [b], sekarang);
    return hasil;
  });
}

/**
 * Pindahkan semua alarm pengguna ke zona baru (jam lokal tetap) dan hitung ulang kejadiannya.
 * Ditolak bila ada alarm terkunci Komitmen yang jadinya berbunyi lebih lambat. Dipanggil
 * layanan preferensi di dalam transaksinya.
 */
export async function pindahZona(tx: Tx, k: KonteksPengguna, zonaBaru: string, sekarang: Date): Promise<void> {
  const daftar = await tx.select().from(schema.alarm).where(eq(schema.alarm.penggunaId, k.id)).for("update");
  for (const a of daftar) {
    if (a.zona === zonaBaru) continue;
    const isiA = isiDariBaris(a);
    const berikutnya = hitungBerikutnya(isiA, zonaBaru, await daftarLewati(tx, a.id), sekarang);
    await tegakkanKomitmen(tx, k, a, sekarang, "ubah", isiA, berikutnya?.utc ?? null);
    const [b] = await tx.update(schema.alarm).set({ zona: zonaBaru, diubah: sekarang }).where(eq(schema.alarm.id, a.id)).returning();
    await materialisasi(tx, b, sekarang);
  }
}

/** Alarm yang sedang dikunci Komitmen (untuk menolak perubahan jam tidur yang membuka kunci). */
export async function alarmTerkunci(tx: Tx, k: KonteksPengguna, sekarang: Date): Promise<Array<{ id: string; sampai: Date; zona: string }>> {
  const daftar = await tx
    .select()
    .from(schema.alarm)
    .where(and(eq(schema.alarm.penggunaId, k.id), eq(schema.alarm.komitmen, true), eq(schema.alarm.aktif, true)));
  const hasil: Array<{ id: string; sampai: Date; zona: string }> = [];
  for (const a of daftar) {
    const kunci = await kunciSekarang(tx, k, a, sekarang);
    if (kunci.terkunci) hasil.push({ id: a.id, sampai: kunci.sampai, zona: a.zona });
  }
  return hasil;
}
