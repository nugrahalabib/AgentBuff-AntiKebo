import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { isiDariBaris } from "@/lib/alarm/baris";
import type { IsiAlarm } from "@/lib/alarm/isi";
import { daftarSuara, type DaftarSuara } from "@/lib/agentbuff/pintu";
import { db, denganPengguna, schema, type Tx } from "@/lib/db";
import { isi as isiTeks } from "@/lib/i18n";
import { GAYA, hashKalimat, naskahAlarm, type Kalimat } from "@/lib/suara/naskah";
import { GalatLayanan } from "./dasar";
import { konteksPengguna, type KonteksPengguna } from "./konteks";

/**
 * Suara omelan per alarm (docs/10-SUARA.md §4, PRD F2 sampai F7). Layanan ini menghitung kalimat
 * yang dibutuhkan, menaruh yang belum punya klip ke antrean `naskah_suara` (dikerjakan worker lewat
 * pintu suara AgentBuff milik pengguna), dan melaporkan status per alarm. AntiKebo tidak pernah
 * memegang kunci suara pengguna.
 */

export type StatusSuara = { status: "siap" } | { status: "dibuat"; n: number; total: number } | { status: "belum"; alasan: string };

/** Kalimat yang dibutuhkan alarm ini untuk pengguna ini (nama panggilan, bahasa, agenda). */
export function kalimatAlarm(isi: Pick<IsiAlarm, "karakter" | "agendaJudul" | "suaraId" | "kalimatPribadi">, k: KonteksPengguna): Kalimat[] {
  const agenda = isi.agendaJudul.trim() && isi.agendaJudul.trim() !== k.t.alarmBaru.judulBawaan ? isi.agendaJudul.trim() : null;
  // Salinan isi kejadian lama (sebelum kalimat pribadi ada) tidak membawa kolom ini.
  return naskahAlarm({ karakter: isi.karakter, bahasa: k.bahasa, nama: k.namaSapaan, agenda, suaraId: isi.suaraId, pribadi: isi.kalimatPribadi ?? [] });
}

/** Masukkan kalimat yang belum punya baris naskah ke antrean (idempoten). */
export async function rencanakanNaskah(tx: Tx, k: KonteksPengguna, kalimat: readonly Kalimat[], suaraId: string | null): Promise<number> {
  if (!kalimat.length) return 0;
  const r = await tx
    .insert(schema.naskahSuara)
    .values(kalimat.map((x) => ({ penggunaId: k.id, hash: x.hash, teks: x.teks, bahasa: k.bahasa, suaraId, gaya: GAYA })))
    .onConflictDoNothing()
    .returning({ id: schema.naskahSuara.id });
  return r.length;
}

/** Rencanakan naskah untuk satu alarm aktif (dipanggil layanan alarm di transaksi yang sama). */
export async function rencanakanNaskahAlarm(tx: Tx, k: KonteksPengguna, isi: IsiAlarm): Promise<void> {
  if (!isi.aktif) return;
  await rencanakanNaskah(tx, k, kalimatAlarm(isi, k), isi.suaraId);
}

/** Semua alarm aktif pengguna (sesudah nama panggilan atau bahasa berubah). */
export async function rencanakanSemua(tx: Tx, k: KonteksPengguna): Promise<void> {
  const daftar = await tx
    .select()
    .from(schema.alarm)
    .where(and(eq(schema.alarm.penggunaId, k.id), eq(schema.alarm.aktif, true)));
  for (const a of daftar) await rencanakanNaskahAlarm(tx, k, isiDariBaris(a));
}

type BarisStatus = { hash: string; status: string; alasan: string | null };

export function hitungStatus(kalimat: readonly Kalimat[], baris: readonly BarisStatus[], k: KonteksPengguna): StatusSuara {
  if (!kalimat.length) return { status: "siap" };
  const per = new Map(baris.map((b) => [b.hash, b]));
  const gagal = kalimat.map((x) => per.get(x.hash)).find((b) => b?.status === "gagal");
  if (gagal) {
    const daftar = k.t.suara.alasan as Record<string, string>;
    return { status: "belum", alasan: daftar[gagal.alasan ?? ""] ?? daftar.umum };
  }
  const siap = kalimat.filter((x) => per.get(x.hash)?.status === "siap").length;
  return siap === kalimat.length ? { status: "siap" } : { status: "dibuat", n: siap, total: kalimat.length };
}

/** Status suara banyak alarm sekaligus (beranda, MCP `get_voice_status`). */
export async function statusSuaraAlarm(tx: Tx, k: KonteksPengguna, daftar: ReadonlyArray<{ id: string; isi: IsiAlarm }>): Promise<Map<string, StatusSuara>> {
  const kalimat = new Map(daftar.map((a) => [a.id, kalimatAlarm(a.isi, k)]));
  const semuaHash = [...new Set([...kalimat.values()].flat().map((x) => x.hash))];
  const baris = semuaHash.length
    ? await tx
        .select({ hash: schema.naskahSuara.hash, status: schema.naskahSuara.status, alasan: schema.naskahSuara.alasan })
        .from(schema.naskahSuara)
        .where(and(eq(schema.naskahSuara.penggunaId, k.id), inArray(schema.naskahSuara.hash, semuaHash)))
    : [];
  return new Map(daftar.map((a) => [a.id, hitungStatus(kalimat.get(a.id)!, baris, k)]));
}

export type OmelanPerangkat = { jenis: Kalimat["jenis"]; menit?: number; teks: string; klip: string | null };

/** Kalimat + klip siap (hash) untuk salinan jadwal perangkat dan layar berbunyi. */
export async function omelanUntuk(tx: Tx, k: KonteksPengguna, isi: IsiAlarm): Promise<OmelanPerangkat[]> {
  const kalimat = kalimatAlarm(isi, k);
  if (!kalimat.length) return [];
  const siap = new Set(
    (
      await tx
        .select({ hash: schema.naskahSuara.hash })
        .from(schema.naskahSuara)
        .where(
          and(
            eq(schema.naskahSuara.penggunaId, k.id),
            eq(schema.naskahSuara.status, "siap"),
            inArray(
              schema.naskahSuara.hash,
              kalimat.map((x) => x.hash),
            ),
          ),
        )
    ).map((x) => x.hash),
  );
  return kalimat.map((x) => ({ jenis: x.jenis, ...(x.menit ? { menit: x.menit } : {}), teks: x.teks, klip: siap.has(x.hash) ? x.hash : null }));
}

/** Audio klip milik pengguna (unduhan perangkat). Menandai dipakai, paling sering sejam sekali. */
export async function ambilKlip(penggunaId: string, hash: string): Promise<{ audio: Buffer; mime: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  return denganPengguna(penggunaId, async (tx) => {
    const [r] = await tx
      .select()
      .from(schema.klipSuara)
      .where(and(eq(schema.klipSuara.penggunaId, penggunaId), eq(schema.klipSuara.hash, hash)));
    if (!r) return null;
    if (Date.now() - r.dipakaiTerakhir.getTime() > 3_600_000) await tx.update(schema.klipSuara).set({ dipakaiTerakhir: new Date() }).where(eq(schema.klipSuara.id, r.id));
    return { audio: r.audio, mime: r.mime };
  });
}

/** Pilihan suara dari AgentBuff pengguna (PRD F5). */
export async function pilihanSuara(penggunaId: string): Promise<DaftarSuara> {
  const [p] = await db().select({ sub: schema.pengguna.agentbuffSub, bahasa: schema.pengguna.bahasa }).from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId));
  const k = await denganPengguna(penggunaId, (tx) => konteksPengguna(tx, penggunaId));
  const h = await daftarSuara(p.sub, p.bahasa === "en" ? "en" : "id");
  if (h.ok) return { penyedia: h.penyedia, bawaan: h.bawaan, suara: h.suara };
  if (h.alasan === "belum_diizinkan") throw new GalatLayanan("perlu_izin", k.t.suara.alasan.belum_diizinkan);
  throw new GalatLayanan("masukan", k.t.suara.alasan.umum);
}

/** Contoh dengar satu suara (PRD F5): satu kalimat pendek lewat antrean biasa. */
export async function contohSuara(penggunaId: string, suaraId: unknown): Promise<{ hash: string; status: string }> {
  const s = z
    .string()
    .min(1)
    .max(120)
    .nullable()
    .safeParse(suaraId ?? null);
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    if (!s.success) throw new GalatLayanan("masukan", k.t.suara.alasan.tidak_dikenal);
    const teks = isiTeks(k.t.suara.contoh, { nama: k.namaSapaan });
    const hash = hashKalimat(teks, s.data, k.bahasa);
    await rencanakanNaskah(tx, k, [{ jenis: "umum", teks, hash }], s.data);
    const [r] = await tx
      .select({ status: schema.naskahSuara.status })
      .from(schema.naskahSuara)
      .where(and(eq(schema.naskahSuara.penggunaId, penggunaId), eq(schema.naskahSuara.hash, hash)));
    return { hash, status: r?.status ?? "menunggu" };
  });
}

/** Izin suara baru diberi: naskah yang gagal karena belum diizinkan dicoba lagi. */
export async function antreUlangSesudahIzin(penggunaId: string): Promise<number> {
  return denganPengguna(penggunaId, async (tx) => {
    const r = await tx
      .update(schema.naskahSuara)
      .set({ status: "menunggu", alasan: null, percobaan: 0, cobaLagiSetelah: new Date(), diubah: new Date() })
      .where(and(eq(schema.naskahSuara.penggunaId, penggunaId), eq(schema.naskahSuara.status, "gagal"), eq(schema.naskahSuara.alasan, "belum_diizinkan")))
      .returning({ id: schema.naskahSuara.id });
    return r.length;
  });
}

/**
 * Buat ulang suara omelan (MCP `regenerate_voice`, mis. sesudah agen di AgentBuff diperbaiki): naskah
 * yang gagal dicoba lagi dan kalimat alarm aktif yang belum punya naskah direncanakan.
 */
export async function buatUlangSuara(penggunaId: string): Promise<number> {
  return denganPengguna(penggunaId, async (tx) => {
    const k = await konteksPengguna(tx, penggunaId);
    const r = await tx
      .update(schema.naskahSuara)
      .set({ status: "menunggu", alasan: null, percobaan: 0, cobaLagiSetelah: new Date(), diubah: new Date() })
      .where(and(eq(schema.naskahSuara.penggunaId, penggunaId), eq(schema.naskahSuara.status, "gagal")))
      .returning({ id: schema.naskahSuara.id });
    await rencanakanSemua(tx, k);
    return r.length;
  });
}

/**
 * Bersih-bersih (worker): naskah dan klip yang tidak dibutuhkan alarm mana pun dan tidak dipakai
 * 30 hari dihapus (docs/03-ARSITEKTUR.md §2).
 */
export async function bersihkanSuara(tx: Tx, sekarang: Date): Promise<number> {
  const batas = new Date(sekarang.getTime() - 30 * 86_400_000);
  const pengguna = await tx.selectDistinct({ id: schema.naskahSuara.penggunaId }).from(schema.naskahSuara).where(lt(schema.naskahSuara.diubah, batas));
  let n = 0;
  for (const { id } of pengguna) {
    const k = await konteksPengguna(tx, id);
    const perlu = new Set<string>();
    for (const a of await tx.select().from(schema.alarm).where(eq(schema.alarm.penggunaId, id))) for (const x of kalimatAlarm(isiDariBaris(a), k)) perlu.add(x.hash);
    const lama = await tx
      .select({ hash: schema.naskahSuara.hash })
      .from(schema.naskahSuara)
      .where(and(eq(schema.naskahSuara.penggunaId, id), lt(schema.naskahSuara.diubah, batas)));
    const buang = lama.map((x) => x.hash).filter((h) => !perlu.has(h));
    if (!buang.length) continue;
    const terpakai = await tx
      .select({ hash: schema.klipSuara.hash })
      .from(schema.klipSuara)
      .where(and(eq(schema.klipSuara.penggunaId, id), inArray(schema.klipSuara.hash, buang), sql`${schema.klipSuara.dipakaiTerakhir} >= ${batas.toISOString()}`));
    const hapus = buang.filter((h) => !terpakai.some((x) => x.hash === h));
    if (!hapus.length) continue;
    await tx.delete(schema.naskahSuara).where(and(eq(schema.naskahSuara.penggunaId, id), inArray(schema.naskahSuara.hash, hapus)));
    await tx.delete(schema.klipSuara).where(and(eq(schema.klipSuara.penggunaId, id), inArray(schema.klipSuara.hash, hapus)));
    n += hapus.length;
  }
  return n;
}
