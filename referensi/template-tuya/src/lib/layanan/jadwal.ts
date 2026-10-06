import { and, asc, eq, sql } from "drizzle-orm";
import { barisDari, db, denganPengguna, schema } from "@/lib/db";
import { log } from "@/lib/log";
import type { PerintahRamah } from "@/lib/tuya/kemampuan";
import { berikutnya, jamSah, uraikanJadwal, type JenisJadwal } from "@/lib/waktu/jadwal";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, type Sumber } from "./dasar";
import { cariPerangkat, kendalikan } from "./rumah";
import { cariSuasana, jalankanSuasana } from "./suasana";

export type Jadwal = typeof schema.jadwal.$inferSelect;
const MAKS_JADWAL = 60;

export type MasukanJadwal = {
  nama?: string;
  /** Salah satu: `dalamMenit` (timer), `pada` (ISO, sekali), atau `jam` (+`hari` untuk mingguan). */
  dalamMenit?: number;
  pada?: string;
  jam?: string;
  hari?: number[];
  zona?: string;
  target: { perangkat: string; perintah: PerintahRamah; ringkasan: string } | { suasana: string };
};

export async function buatJadwal(penggunaId: string, m: MasukanJadwal, sumber: Sumber): Promise<Jadwal> {
  const [u] = await db().select({ zona: schema.pengguna.zonaWaktu }).from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId)).limit(1);
  const zona = m.zona ?? u?.zona ?? "Asia/Jakarta";
  const sekarang = new Date();

  let jenis: JenisJadwal;
  let pada: Date | null = null;
  let waktuLokal: string | null = null;
  let hari: number[] | null = null;
  if (m.dalamMenit !== undefined) {
    if (!Number.isFinite(m.dalamMenit) || m.dalamMenit < 1 || m.dalamMenit > 7 * 24 * 60) throw new GalatLayanan("masukan", "Timer antara 1 menit dan 7 hari.");
    jenis = "sekali";
    pada = new Date(sekarang.getTime() + Math.round(m.dalamMenit) * 60_000);
  } else if (m.pada) {
    const t = new Date(m.pada);
    if (Number.isNaN(t.getTime())) throw new GalatLayanan("masukan", "Waktu tidak bisa dibaca. Pakai format ISO, contoh 2026-10-04T23:00:00+07:00.");
    if (t.getTime() <= sekarang.getTime() + 30_000) throw new GalatLayanan("masukan", "Waktunya sudah lewat. Pilih waktu di masa depan.");
    jenis = "sekali";
    pada = t;
  } else if (m.jam) {
    if (!jamSah(m.jam)) throw new GalatLayanan("masukan", 'Jam harus format 24 jam "HH:MM", contoh "23:00".');
    waktuLokal = m.jam;
    if (m.hari?.length) {
      const h = [...new Set(m.hari.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))];
      if (!h.length) throw new GalatLayanan("masukan", "Hari 0 (Minggu) sampai 6 (Sabtu).");
      jenis = h.length === 7 ? "harian" : "mingguan";
      hari = h.length === 7 ? null : h.sort();
    } else jenis = "harian";
  } else {
    throw new GalatLayanan("masukan", "Tentukan kapan: dalam berapa menit, pada waktu tertentu, atau jam berapa tiap hari.");
  }

  let target: Jadwal["target"];
  if ("suasana" in m.target) {
    const s = await cariSuasana(penggunaId, m.target.suasana);
    target = { jenis: "suasana", suasanaId: s.id, ringkasan: `Suasana ${s.nama}` };
  } else {
    const p = await cariPerangkat(penggunaId, m.target.perangkat);
    target = { jenis: "perangkat", deviceId: p.id, perintah: m.target.perintah as Record<string, unknown>, ringkasan: `${p.nama}: ${m.target.ringkasan}` };
  }

  const nextRun = berikutnya({ jenis, waktuLokal, hari, zona, pada }, sekarang);
  if (!nextRun) throw new GalatLayanan("masukan", "Jadwal ini tidak akan pernah berjalan. Periksa jam & harinya.");
  const nama = (m.nama?.trim() || target.ringkasan).slice(0, 80);

  const baru = await denganPengguna(penggunaId, async (tx) => {
    const [{ n }] = barisDari<{ n: number }>(await tx.execute(sql`select count(*)::int as n from jadwal where pengguna_id = ${penggunaId} and aktif`));
    if (n >= MAKS_JADWAL) throw new GalatLayanan("masukan", `Paling banyak ${MAKS_JADWAL} jadwal aktif. Hapus yang tidak dipakai dulu.`);
    const [j] = await tx
      .insert(schema.jadwal)
      .values({ penggunaId, nama, jenis, waktuLokal, hari, zona, target, aktif: true, berikutnya: nextRun, dibuatOleh: sumber === "agen" ? "agen" : "web" })
      .returning();
    return j;
  });
  await catatAktivitas(penggunaId, { sumber, jenis: "jadwal", ringkasan: `Jadwal dibuat: ${nama} (${uraikanJadwal({ jenis, waktuLokal, hari, zona, pada: nextRun })})` });
  return baru;
}

export async function daftarJadwal(penggunaId: string): Promise<Jadwal[]> {
  return denganPengguna(penggunaId, (tx) =>
    tx.select().from(schema.jadwal).where(eq(schema.jadwal.penggunaId, penggunaId)).orderBy(sql`${schema.jadwal.aktif} desc`, asc(schema.jadwal.berikutnya)),
  );
}

export async function hapusJadwal(penggunaId: string, id: string, sumber: Sumber): Promise<void> {
  const [j] = await denganPengguna(penggunaId, (tx) =>
    tx.delete(schema.jadwal).where(and(eq(schema.jadwal.penggunaId, penggunaId), eq(schema.jadwal.id, id))).returning({ nama: schema.jadwal.nama }),
  );
  if (!j) throw new GalatLayanan("tidak_ditemukan", "Jadwal tidak ditemukan.");
  await catatAktivitas(penggunaId, { sumber, jenis: "jadwal", ringkasan: `Jadwal dihapus: ${j.nama}` });
}

export async function aturAktifJadwal(penggunaId: string, id: string, aktif: boolean): Promise<Jadwal> {
  return denganPengguna(penggunaId, async (tx) => {
    const [j] = await tx.select().from(schema.jadwal).where(and(eq(schema.jadwal.penggunaId, penggunaId), eq(schema.jadwal.id, id)));
    if (!j) throw new GalatLayanan("tidak_ditemukan", "Jadwal tidak ditemukan.");
    const nextRun = aktif ? (j.jenis === "sekali" ? (j.berikutnya && j.berikutnya > new Date() ? j.berikutnya : null) : berikutnya({ ...j, jenis: j.jenis as JenisJadwal }, new Date())) : j.berikutnya;
    if (aktif && !nextRun) throw new GalatLayanan("masukan", "Timer sekali ini sudah lewat waktunya. Buat timer baru.");
    const [u] = await tx.update(schema.jadwal).set({ aktif, berikutnya: nextRun }).where(eq(schema.jadwal.id, id)).returning();
    return u;
  });
}

export function deskripsiJadwal(j: Jadwal): string {
  return uraikanJadwal({ jenis: j.jenis as JenisJadwal, waktuLokal: j.waktuLokal, hari: j.hari, zona: j.zona, pada: j.berikutnya ?? j.terakhirJalan });
}

/**
 * Worker: klaim jadwal jatuh tempo (FOR UPDATE SKIP LOCKED), majukan `berikutnya`
 * LEBIH DULU (paling banyak sekali jalan walau worker mati di tengah), lalu jalankan.
 * Jadwal yang telat > 15 menit (server sempat mati) dilewati, tidak ditembakkan terlambat.
 */
export async function jalankanJatuhTempo(batas = 20): Promise<number> {
  const diklaim = await db().transaction(async (tx) => {
    const rows = barisDari<{ id: string }>(
      await tx.execute(sql`select id from jadwal where aktif and berikutnya <= now() order by berikutnya limit ${batas} for update skip locked`),
    );
    const hasil: Array<Jadwal & { telat: boolean }> = [];
    for (const { id } of rows) {
      const [j] = await tx.select().from(schema.jadwal).where(eq(schema.jadwal.id, id));
      if (!j?.berikutnya) continue;
      const telat = Date.now() - j.berikutnya.getTime() > 15 * 60_000;
      const nextRun = j.jenis === "sekali" ? null : berikutnya({ ...j, jenis: j.jenis as JenisJadwal }, new Date());
      await tx
        .update(schema.jadwal)
        .set({ berikutnya: nextRun, aktif: nextRun != null, terakhirJalan: new Date(), terakhirHasil: telat ? "dilewati: server sempat tidak aktif" : "berjalan" })
        .where(eq(schema.jadwal.id, id));
      hasil.push({ ...j, telat });
    }
    return hasil;
  });

  for (const j of diklaim) {
    if (j.telat) continue;
    let hasil = "ok";
    try {
      if (j.target.jenis === "perangkat") {
        await kendalikan(j.penggunaId, j.target.deviceId, j.target.perintah as PerintahRamah, { sumber: "jadwal" });
      } else {
        const r = await jalankanSuasana(j.penggunaId, j.target.suasanaId, "jadwal");
        if (r.gagal.length) hasil = `sebagian: ${r.gagal.map((g) => `${g.nama} ${g.alasan}`).join("; ")}`;
      }
    } catch (e) {
      hasil = `gagal: ${e instanceof GalatLayanan ? e.message : "galat tak terduga"}`;
      if (!(e instanceof GalatLayanan)) log.error({ err: (e as Error)?.message, jadwal: j.id }, "jadwal gagal");
    }
    await denganPengguna(j.penggunaId, (tx) => tx.update(schema.jadwal).set({ terakhirHasil: hasil.slice(0, 300) }).where(eq(schema.jadwal.id, j.id)));
  }
  return diklaim.length;
}
