import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { akhirTenggang } from "@/lib/agentbuff/aturan-beku";
import { kirimKabar as kirimKabarAsli } from "@/lib/agentbuff/pintu";
import { cekHak as cekHakAsli } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { SkemaBawaan } from "@/lib/alarm/isi";
import { barisDari, schema, type Db, type Tx } from "@/lib/db";
import { env } from "@/lib/env";
import { notifBeku, pesanBeku, waktuPanjang } from "@/lib/pesan";
import { kirimPush, type KirimPermintaan } from "@/lib/push";
import { catatKiriman } from "./kanal";
import { konteksPengguna } from "./konteks";

/**
 * Hak AgentBuff di worker (docs/05-INTEGRASI-AGENTBUFF.md §2, K-07). Pemilik yang punya alarm dalam
 * 48 jam diperiksa ulang ke AgentBuff bila pemeriksaan terakhir sudah lama (aktif 6 jam, beku 1 jam
 * supaya perpanjangan cepat terlihat). Begitu beku terdeteksi, kabar dikirim SEKALI (notifikasi +
 * kanal bawaan): alarm masih berbunyi sampai akhir tenggang. AgentBuff yang tak terjangkau tidak
 * mengubah apa pun (K-12).
 */

export const JENDELA_SAPU_MS = 48 * 3_600_000;
export const BASI_AKTIF_MS = 6 * 3_600_000;
export const BASI_BEKU_MS = 3_600_000;

export type OpsiSapu = {
  sekarang?: Date;
  batas?: number;
  cekHak?: typeof cekHakAsli;
  kirimKabar?: typeof kirimKabarAsli;
  kirimPermintaanPush?: KirimPermintaan;
  asal?: string;
};

export async function sapuHak(db: () => Db, opsi: OpsiSapu = {}): Promise<{ diperiksa: number; dikabari: number }> {
  const sekarang = opsi.sekarang ?? new Date();
  const cekHak = opsi.cekHak ?? cekHakAsli;
  const sampai = new Date(sekarang.getTime() + JENDELA_SAPU_MS).toISOString();
  const calon = barisDari<{ id: string; sub: string }>(
    await db().execute(sql`
      select p.id, p.agentbuff_sub as sub from pengguna p
      left join status_hak h on h.pengguna_id = p.id
      where p.dihapus_pada is null
        and exists (select 1 from kejadian_alarm k where k.pengguna_id = p.id and k.status = 'menunggu' and not k.uji and k.jadwal_utc <= ${sampai})
        and (h.pengguna_id is null or h.diperiksa_pada is null
             or (h.aktif and h.diperiksa_pada < ${new Date(sekarang.getTime() - BASI_AKTIF_MS).toISOString()})
             or (not h.aktif and h.diperiksa_pada < ${new Date(sekarang.getTime() - BASI_BEKU_MS).toISOString()}))
      order by h.diperiksa_pada nulls first
      limit ${opsi.batas ?? 20}`),
  );
  for (const c of calon) await cekHak({ id: c.id, agentbuffSub: c.sub });

  // Kabar sekali per masa beku. Diklaim dulu (dua worker tidak mengirim dua kali), baru dikirim.
  const beku = await db()
    .select({ id: schema.statusHak.penggunaId, bekuSejak: schema.statusHak.bekuSejak, alasan: schema.statusHak.alasan })
    .from(schema.statusHak)
    .where(and(eq(schema.statusHak.aktif, false), isNotNull(schema.statusHak.bekuSejak), isNull(schema.statusHak.bekuDikabari)))
    .limit(opsi.batas ?? 20);
  let dikabari = 0;
  for (const b of beku) {
    const [klaim] = await db()
      .update(schema.statusHak)
      .set({ bekuDikabari: sekarang })
      .where(and(eq(schema.statusHak.penggunaId, b.id), isNull(schema.statusHak.bekuDikabari)))
      .returning({ id: schema.statusHak.penggunaId });
    if (!klaim) continue;
    if (await kabarBeku(db, b.id, { aktif: false, bekuSejak: b.bekuSejak }, b.alasan, sekarang, opsi)) dikabari++;
  }
  return { diperiksa: calon.length, dikabari };
}

/** Tautan perpanjang mutlak (pesan keluar dari aplikasi, jadi jalur relatif diberi asal). */
export function tautanPerpanjangMutlak(alasan: string, asal: string): string {
  const url = tautanPerpanjang(alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY")) ?? "/app";
  return url.startsWith("/") ? `${asal}${url}` : url;
}

async function kabarBeku(db: () => Db, penggunaId: string, status: { aktif: boolean; bekuSejak: Date | null }, alasan: string, sekarang: Date, opsi: OpsiSapu): Promise<boolean> {
  const akhir = akhirTenggang(status);
  if (!akhir || akhir.getTime() <= sekarang.getTime()) return false;
  const jalankan = <T>(fn: (tx: Tx) => Promise<T>) => db().transaction(fn);
  const data = await jalankan(async (tx) => {
    const [kej] = await tx
      .select()
      .from(schema.kejadianAlarm)
      .where(and(eq(schema.kejadianAlarm.penggunaId, penggunaId), eq(schema.kejadianAlarm.status, "menunggu"), eq(schema.kejadianAlarm.uji, false)))
      .orderBy(asc(schema.kejadianAlarm.jadwalUtc))
      .limit(1);
    // Tanpa alarm terpasang tidak ada yang perlu dikabarkan.
    if (!kej) return null;
    const k = await konteksPengguna(tx, penggunaId);
    const [p] = await tx.select({ sub: schema.pengguna.agentbuffSub, bawaan: schema.pengguna.bawaan }).from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId));
    const [alarm] = kej.alarmId ? await tx.select({ spam: schema.alarm.spam }).from(schema.alarm).where(eq(schema.alarm.id, kej.alarmId)) : [];
    const bawaan = SkemaBawaan.safeParse(p.bawaan);
    const kanalBawaan = bawaan.success ? (bawaan.data.spam?.kanal ?? []) : [];
    return { k, sub: p.sub, kej, kanal: kanalBawaan.length ? kanalBawaan : (alarm?.spam.kanal ?? []) };
  });
  if (!data) return false;
  const { k, sub, kej } = data;
  const asal = (opsi.asal ?? env("APP_ORIGIN")).replace(/\/+$/, "");
  const tautan = tautanPerpanjangMutlak(alasan, asal);
  const m = { bahasa: k.bahasa, nama: k.namaSapaan, sampai: waktuPanjang(akhir, k.zona, k.bahasa) };
  const kirimKabar = opsi.kirimKabar ?? kirimKabarAsli;
  const tanggal = (status.bekuSejak ?? sekarang).toISOString().slice(0, 10);
  await Promise.all([
    kirimPush(jalankan, penggunaId, notifBeku({ ...m, url: tautan }), { kirim: opsi.kirimPermintaanPush, ttlDtk: 24 * 3_600 }),
    ...data.kanal.map(async (kanal, i) => {
      const kunci = `beku:${penggunaId}:${tanggal}:${i}`;
      const r = await kirimKabar(sub, { kanal, teks: pesanBeku({ ...m, tautan }), kunci });
      await jalankan((tx) =>
        catatKiriman(tx, {
          penggunaId,
          kejadianId: kej.id,
          kanalId: kanal,
          platform: null,
          jenis: "beku",
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
