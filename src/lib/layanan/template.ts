import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isiDariBaris } from "@/lib/alarm/baris";
import { MAKS_TEMPLATE, SkemaIsiTemplate, type IsiTemplate } from "@/lib/alarm/isi";
import { AWALAN_BAWAAN, daftarTemplateBawaan, type TemplateTampil } from "@/lib/alarm/template-bawaan";
import { barisDari, denganPengguna, schema, type Tx } from "@/lib/db";
import { isi } from "@/lib/i18n";
import { catatAudit } from "./audit";
import { GalatLayanan, pesanMasukan, type Sumber } from "./dasar";
import { konteksPengguna, type KonteksPengguna } from "./konteks";

/** Template alarm (PRD B10): bawaan (kode) + buatan pengguna (tabel `template_alarm`), maks 20 per pengguna. */

const SkemaNama = z
  .string()
  .trim()
  .min(1, "nama_wajib")
  .refine((s) => Array.from(s).length <= 40, "terlalu_panjang");

export const SkemaMasukanTemplate = z.strictObject({ nama: SkemaNama, isi: SkemaIsiTemplate });
export const SkemaUbahTemplate = z.strictObject({ nama: SkemaNama.optional(), isi: SkemaIsiTemplate.optional() });

function baris(r: typeof schema.templateAlarm.$inferSelect): TemplateTampil {
  return { id: r.id, nama: r.nama, keterangan: null, bawaan: false, isi: r.isi };
}

function periksa<T>(skema: z.ZodType<T>, masukan: unknown, k: KonteksPengguna): T {
  const h = skema.safeParse(masukan);
  if (!h.success) throw new GalatLayanan("masukan", pesanMasukan(h.error, k.t));
  return h.data;
}

const idSah = (id: string) => z.uuid().safeParse(id).success;

/** Template untuk dipakai di dalam transaksi lain (membuat alarm dari template). */
export async function cariTemplate(tx: Tx, k: KonteksPengguna, id: string): Promise<TemplateTampil> {
  if (id.startsWith(AWALAN_BAWAAN)) {
    const b = daftarTemplateBawaan(k.t).find((x) => x.id === id);
    if (b) return b;
  } else if (idSah(id)) {
    const [r] = await tx
      .select()
      .from(schema.templateAlarm)
      .where(and(eq(schema.templateAlarm.penggunaId, k.id), eq(schema.templateAlarm.id, id)));
    if (r) return baris(r);
  }
  throw new GalatLayanan("tidak_ditemukan", k.t.galat.templateTidakAda);
}

export async function daftarTemplate(penggunaId: string): Promise<TemplateTampil[]> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const milik = await tx.select().from(schema.templateAlarm).where(eq(schema.templateAlarm.penggunaId, penggunaId)).orderBy(asc(schema.templateAlarm.dibuat));
    return [...daftarTemplateBawaan(k.t), ...milik.map(baris)];
  });
}

export async function ambilTemplate(penggunaId: string, id: string): Promise<TemplateTampil> {
  return denganPengguna(penggunaId, async (tx) => cariTemplate(tx, await konteksPengguna(tx, penggunaId), id));
}

async function pastikanNamaBebas(tx: Tx, k: KonteksPengguna, nama: string, kecuali?: string) {
  const ada = barisDari<{ id: string }>(
    await tx.execute(sql`select id from template_alarm where pengguna_id = ${k.id} and lower(nama) = lower(${nama}) ${kecuali ? sql`and id <> ${kecuali}` : sql``} limit 1`),
  );
  if (ada.length) throw new GalatLayanan("masukan", k.t.galat.namaTemplateDipakai);
}

async function simpanBaru(tx: Tx, k: KonteksPengguna, nama: string, isiT: IsiTemplate, sumber: Sumber): Promise<TemplateTampil> {
  const [{ n }] = barisDari<{ n: number }>(await tx.execute(sql`select count(*)::int as n from template_alarm where pengguna_id = ${k.id}`));
  if (n >= MAKS_TEMPLATE) throw new GalatLayanan("masukan", isi(k.t.galat.batasTemplate, { n: MAKS_TEMPLATE }));
  await pastikanNamaBebas(tx, k, nama);
  const [r] = await tx.insert(schema.templateAlarm).values({ penggunaId: k.id, nama, isi: isiT }).returning();
  await catatAudit(k.id, { sumber, jenis: "alarm", ringkasan: `Template dibuat: ${nama}` }, tx);
  return baris(r);
}

export async function buatTemplate(penggunaId: string, masukan: unknown, sumber: Sumber): Promise<TemplateTampil> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const m = periksa(SkemaMasukanTemplate, masukan, k);
    return simpanBaru(tx, k, m.nama, m.isi, sumber);
  });
}

/** Simpan isi alarm yang ada sebagai template baru (tanpa status aktif). */
export async function simpanAlarmSebagaiTemplate(penggunaId: string, alarmId: string, nama: unknown, sumber: Sumber): Promise<TemplateTampil> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    const n = periksa(SkemaNama, nama, k);
    const [a] = idSah(alarmId)
      ? await tx
          .select()
          .from(schema.alarm)
          .where(and(eq(schema.alarm.penggunaId, penggunaId), eq(schema.alarm.id, alarmId)))
      : [];
    if (!a) throw new GalatLayanan("tidak_ditemukan", k.t.galat.alarmTidakAda);
    const isiT: IsiTemplate & { aktif?: boolean } = isiDariBaris(a);
    delete isiT.aktif;
    return simpanBaru(tx, k, n, isiT, sumber);
  });
}

export async function ubahTemplate(penggunaId: string, id: string, masukan: unknown, sumber: Sumber): Promise<TemplateTampil> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    if (id.startsWith(AWALAN_BAWAAN)) throw new GalatLayanan("masukan", k.t.galat.templateBawaanTetap);
    const lama = await cariTemplate(tx, k, id);
    const m = periksa(SkemaUbahTemplate, masukan, k);
    if (m.nama) await pastikanNamaBebas(tx, k, m.nama, id);
    const [r] = await tx
      .update(schema.templateAlarm)
      .set({ nama: m.nama ?? lama.nama, isi: m.isi ?? lama.isi, diubah: new Date() })
      .where(and(eq(schema.templateAlarm.penggunaId, penggunaId), eq(schema.templateAlarm.id, id)))
      .returning();
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Template diubah: ${r.nama}` }, tx);
    return baris(r);
  });
}

export async function hapusTemplate(penggunaId: string, id: string, sumber: Sumber): Promise<void> {
  await denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId, true);
    if (id.startsWith(AWALAN_BAWAAN)) throw new GalatLayanan("masukan", k.t.galat.templateBawaanTetap);
    const lama = await cariTemplate(tx, k, id);
    await tx.delete(schema.templateAlarm).where(and(eq(schema.templateAlarm.penggunaId, penggunaId), eq(schema.templateAlarm.id, id)));
    await catatAudit(penggunaId, { sumber, jenis: "alarm", ringkasan: `Template dihapus: ${lama.nama}` }, tx);
  });
}
