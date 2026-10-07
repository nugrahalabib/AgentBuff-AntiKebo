import { and, asc, eq, gt, isNull, lte, ne, or } from "drizzle-orm";
import { akhirTenggang, alarmDitahan } from "@/lib/agentbuff/aturan-beku";
import { kirimKabar as kirimKabarAsli } from "@/lib/agentbuff/pintu";
import { SkemaBawaan } from "@/lib/alarm/isi";
import { schema, type Db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { bagianLokal, instanLokal } from "@/lib/jadwal/zona";
import { notifPengingat, pesanPengingat, waktuPanjang, type BekuPengingat } from "@/lib/pesan";
import { kirimPush, type KirimPermintaan } from "@/lib/push";
import { tautanPerpanjangMutlak } from "./beku";
import { catatKiriman } from "./kanal";
import { konteksPengguna } from "./konteks";
import { SIAGA_MS } from "./perangkat";

/**
 * Pengingat malam (PRD G4): tiap malam pada jam tidur pengguna, satu pesan ke kanal pilihan
 * (kanal bawaan; bila kosong, kanal alarm berikutnya) + notifikasi web: alarm berikutnya, agenda,
 * dan status perangkat siaga. Paling banyak satu per malam (`pengguna.pengingat_terkirim`), hanya
 * bila ada alarm dalam 24 jam, dan tidak dikirim bila worker baru menyala lebih dari 2 jam sesudah
 * jam tidur (pengingat basi tidak berguna).
 */

export const JENDELA_PENGINGAT_MS = 2 * 3_600_000;

/** Malam pengingat terakhir yang sudah dimulai: tanggal lokal dan instan jam tidurnya. */
export function malamTerakhir(sekarang: Date, jamTidur: string, zona: string): { tanggal: string; mulai: Date } {
  const [j, m] = jamTidur.split(":").map(Number);
  const hariIni = bagianLokal(sekarang, zona).tanggal;
  const mulaiHariIni = instanLokal(hariIni, j, m, zona);
  if (mulaiHariIni.getTime() <= sekarang.getTime()) return { tanggal: hariIni, mulai: mulaiHariIni };
  const kemarin = new Date(Date.parse(`${hariIni}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return { tanggal: kemarin, mulai: instanLokal(kemarin, j, m, zona) };
}

export type OpsiPengingat = { sekarang?: Date; kirimKabar?: typeof kirimKabarAsli; kirimPermintaanPush?: KirimPermintaan; asal?: string };

export async function prosesPengingatMalam(db: () => Db, opsi: OpsiPengingat = {}): Promise<{ dikirim: number }> {
  const sekarang = opsi.sekarang ?? new Date();
  const jalankan = <T>(fn: (tx: Tx) => Promise<T>) => db().transaction(fn);
  // Pemilik beku ikut diperiksa walau pengingat malam dimatikan: malam sebelum alarm pertama yang
  // tidak lagi berbunyi, mereka wajib diberi tahu terang-terangan (PRD A4, K-07).
  const calon = await jalankan((tx) =>
    tx
      .select({ id: schema.pengguna.id, zona: schema.pengguna.zonaWaktu, jamTidur: schema.pengguna.jamTidur, terkirim: schema.pengguna.pengingatTerkirim })
      .from(schema.pengguna)
      .leftJoin(schema.statusHak, eq(schema.statusHak.penggunaId, schema.pengguna.id))
      .where(and(or(eq(schema.pengguna.pengingatMalam, true), eq(schema.statusHak.aktif, false)), isNull(schema.pengguna.dihapusPada))),
  );
  let dikirim = 0;
  for (const p of calon) {
    const malam = malamTerakhir(sekarang, p.jamTidur, p.zona);
    if (p.terkirim === malam.tanggal || sekarang.getTime() - malam.mulai.getTime() > JENDELA_PENGINGAT_MS) continue;
    // Klaim malam ini dulu (dua worker tidak mengirim dua kali), baru kirim.
    const [klaim] = await jalankan((tx) =>
      tx
        .update(schema.pengguna)
        .set({ pengingatTerkirim: malam.tanggal })
        .where(and(eq(schema.pengguna.id, p.id), or(isNull(schema.pengguna.pengingatTerkirim), ne(schema.pengguna.pengingatTerkirim, malam.tanggal))))
        .returning({ id: schema.pengguna.id }),
    );
    if (!klaim) continue;
    if (await kirimPengingat(jalankan, p.id, malam.tanggal, sekarang, opsi)) dikirim++;
  }
  return { dikirim };
}

async function kirimPengingat(jalankan: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>, penggunaId: string, tanggal: string, sekarang: Date, opsi: OpsiPengingat): Promise<boolean> {
  const data = await jalankan(async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const [p] = await tx
      .select({ sub: schema.pengguna.agentbuffSub, bawaan: schema.pengguna.bawaan, pengingatMalam: schema.pengguna.pengingatMalam })
      .from(schema.pengguna)
      .where(eq(schema.pengguna.id, penggunaId));
    const [hak] = await tx
      .select({ aktif: schema.statusHak.aktif, bekuSejak: schema.statusHak.bekuSejak, alasan: schema.statusHak.alasan })
      .from(schema.statusHak)
      .where(eq(schema.statusHak.penggunaId, penggunaId));
    const [kej] = await tx
      .select()
      .from(schema.kejadianAlarm)
      .where(
        and(
          eq(schema.kejadianAlarm.penggunaId, penggunaId),
          eq(schema.kejadianAlarm.status, "menunggu"),
          eq(schema.kejadianAlarm.uji, false),
          gt(schema.kejadianAlarm.jadwalUtc, sekarang),
          lte(schema.kejadianAlarm.jadwalUtc, new Date(sekarang.getTime() + 24 * 3_600_000)),
        ),
      )
      .orderBy(asc(schema.kejadianAlarm.jadwalUtc))
      .limit(1);
    if (!kej) return null;
    const [alarm] = kej.alarmId ? await tx.select().from(schema.alarm).where(eq(schema.alarm.id, kej.alarmId)) : [];
    const perangkat = await tx
      .select({ nama: schema.perangkatSiaga.nama, terakhir: schema.perangkatSiaga.terakhirTerlihat })
      .from(schema.perangkatSiaga)
      .where(and(eq(schema.perangkatSiaga.penggunaId, penggunaId), isNull(schema.perangkatSiaga.dicabutPada)));
    const bawaan = SkemaBawaan.safeParse(p.bawaan);
    const kanalBawaan = bawaan.success ? (bawaan.data.spam?.kanal ?? []) : [];
    return {
      k,
      sub: p.sub,
      pengingatMalam: p.pengingatMalam,
      hak: hak ?? null,
      kej,
      agenda: alarm && alarm.agendaJudul.trim() !== k.t.alarmBaru.judulBawaan ? alarm.agendaJudul.trim() : null,
      kanal: kanalBawaan.length ? kanalBawaan : (alarm?.spam.kanal ?? []),
      siap: perangkat.filter((x) => x.terakhir && sekarang.getTime() - x.terakhir.getTime() < SIAGA_MS).map((x) => x.nama),
    };
  });
  if (!data) return false;
  const { k, sub, kej } = data;
  const jam = k.bahasa === "id" ? kej.jamLokal.replace(":", ".") : kej.jamLokal;
  const asal = (opsi.asal ?? env("APP_ORIGIN")).replace(/\/+$/, "");
  // Beku (K-07): alarm besok ditahan = peringatan tegas; masih tenggang = baris tambahan.
  const akhir = akhirTenggang(data.hak);
  const beku: BekuPengingat | null =
    akhir && data.hak
      ? { ditahan: alarmDitahan(data.hak, kej.jadwalUtc), sampai: waktuPanjang(akhir, k.zona, k.bahasa), tautan: tautanPerpanjangMutlak(data.hak.alasan, asal) }
      : null;
  if (!data.pengingatMalam && !beku?.ditahan) return false;
  const m = { bahasa: k.bahasa, nama: k.namaSapaan, jam, agenda: data.agenda, perangkatSiap: data.siap, beku };
  const kirimKabar = opsi.kirimKabar ?? kirimKabarAsli;
  await Promise.all([
    kirimPush(jalankan, penggunaId, notifPengingat({ ...m, url: "/app" }), { kirim: opsi.kirimPermintaanPush, ttlDtk: 3_600 }),
    ...data.kanal.map(async (kanal, i) => {
      const kunci = `pengingat:${penggunaId}:${tanggal}:${i}`;
      const r = await kirimKabar(sub, { kanal, teks: pesanPengingat({ ...m, tautan: `${asal}/app` }), kunci });
      await jalankan((tx) =>
        catatKiriman(tx, {
          penggunaId,
          kejadianId: kej.id,
          kanalId: kanal,
          platform: null,
          jenis: "pengingat",
          status: r.ok ? "terkirim" : r.alasan === "terlalu_cepat" ? "ditunda" : "gagal",
          alasan: r.ok ? null : r.alasan,
          idKiriman: r.ok ? r.id : null,
          kunci,
        }),
      );
    }),
  ]);
  return true;
}
