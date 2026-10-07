import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { buatSuara as buatSuaraAsli, type AlasanPintu, type HasilPintu, type KlipSuara } from "@/lib/agentbuff/pintu";
import { barisDari, schema, type Db } from "@/lib/db";
import { log } from "@/lib/log";

/**
 * Antrean pembuat suara di worker (docs/10-SUARA.md §4). Mengambil naskah `menunggu`, memanggil
 * pintu suara AgentBuff pengguna, menyimpan klip, dan mengabarkan `klip_siap`. Aturan:
 *  - paralel 1 per pengguna, `maks` total (bawaan 4);
 *  - klip dengan kunci sama sudah ada = dipakai ulang tanpa memanggil AgentBuff (PRD F7);
 *  - galat sementara diulang dengan jeda berlipat (1 menit, 2, 4, ... paling lama 6 jam), galat
 *    tetap berhenti dan ditampilkan di status alarm;
 *  - naskah `dibuat` yang ditinggal worker mati lebih dari 5 menit dikembalikan ke antrean.
 */

export const GALAT_TETAP: ReadonlySet<AlasanPintu> = new Set(["belum_diizinkan", "teks_tidak_sah", "permintaan_tidak_sah", "tidak_dikenal", "klien"]);
export const JEDA_MAKS_MS = 6 * 3_600_000;
const MACET_MS = 5 * 60_000;

export type BuatSuara = (sub: string, isi: { teks: string; gaya: "galak" | "biasa"; suara?: string; bahasa: "id" | "en" }) => Promise<HasilPintu<KlipSuara>>;

export function jedaUlang(percobaan: number, ulangiSetelahMs?: number): number {
  const dasar = Math.min(JEDA_MAKS_MS, 60_000 * 2 ** Math.max(0, percobaan - 1));
  return Math.min(JEDA_MAKS_MS, Math.max(dasar, ulangiSetelahMs ?? 0));
}

export type HasilPutaranSuara = { diproses: number; siap: number; ulang: number; gagal: number; dipakaiUlang: number };

export async function prosesAntreanSuara(db: () => Db, opsi: { sekarang?: () => Date; buatSuara?: BuatSuara; maks?: number } = {}): Promise<HasilPutaranSuara> {
  const jam = opsi.sekarang ?? (() => new Date());
  const buat = opsi.buatSuara ?? buatSuaraAsli;
  const maks = opsi.maks ?? 4;
  const h: HasilPutaranSuara = { diproses: 0, siap: 0, ulang: 0, gagal: 0, dipakaiUlang: 0 };

  const diklaim = await db().transaction(async (tx) => {
    const kini = jam();
    await tx
      .update(schema.naskahSuara)
      .set({ status: "menunggu", diubah: kini })
      .where(and(eq(schema.naskahSuara.status, "dibuat"), lte(schema.naskahSuara.diubah, new Date(kini.getTime() - MACET_MS))));
    const calon = barisDari<{ id: string; pengguna_id: string }>(
      await tx.execute(sql`
        select n.id, n.pengguna_id from naskah_suara n
        where n.status = 'menunggu' and n.coba_lagi_setelah <= ${kini.toISOString()}
          and not exists (select 1 from naskah_suara d where d.pengguna_id = n.pengguna_id and d.status = 'dibuat')
        order by n.coba_lagi_setelah, n.dibuat
        limit ${maks * 5}
        for update skip locked`),
    );
    const satuPerPengguna: string[] = [];
    const sudah = new Set<string>();
    for (const c of calon) {
      if (sudah.has(c.pengguna_id) || satuPerPengguna.length >= maks) continue;
      sudah.add(c.pengguna_id);
      satuPerPengguna.push(c.id);
    }
    if (!satuPerPengguna.length) return [];
    return tx
      .update(schema.naskahSuara)
      .set({ status: "dibuat", percobaan: sql`${schema.naskahSuara.percobaan} + 1`, diubah: kini })
      .where(inArray(schema.naskahSuara.id, satuPerPengguna))
      .returning();
  });

  await Promise.all(
    diklaim.map(async (n) => {
      h.diproses++;
      try {
        await db().transaction(async (tx) => {
          const [p] = await tx.select({ sub: schema.pengguna.agentbuffSub }).from(schema.pengguna).where(eq(schema.pengguna.id, n.penggunaId));
          const [ada] = await tx
            .select({ id: schema.klipSuara.id })
            .from(schema.klipSuara)
            .where(and(eq(schema.klipSuara.penggunaId, n.penggunaId), eq(schema.klipSuara.hash, n.hash)));
          let klipId = ada?.id ?? null;
          if (klipId) h.dipakaiUlang++;
          else {
            const r = await buat(p.sub, { teks: n.teks, gaya: n.gaya === "biasa" ? "biasa" : "galak", suara: n.suaraId ?? undefined, bahasa: n.bahasa === "en" ? "en" : "id" });
            if (!r.ok) {
              const tetap = GALAT_TETAP.has(r.alasan);
              await tx
                .update(schema.naskahSuara)
                .set({
                  status: tetap ? "gagal" : "menunggu",
                  alasan: r.alasan,
                  cobaLagiSetelah: new Date(jam().getTime() + (tetap ? 0 : jedaUlang(n.percobaan, r.ulangiSetelahMs))),
                  diubah: jam(),
                })
                .where(eq(schema.naskahSuara.id, n.id));
              if (tetap) h.gagal++;
              else h.ulang++;
              return;
            }
            const [k] = await tx
              .insert(schema.klipSuara)
              .values({ penggunaId: n.penggunaId, hash: n.hash, audio: r.audio, mime: r.mime, durasiMs: r.durasiMs, penyedia: r.penyedia, suara: r.suara })
              .onConflictDoUpdate({ target: [schema.klipSuara.penggunaId, schema.klipSuara.hash], set: { dipakaiTerakhir: jam() } })
              .returning({ id: schema.klipSuara.id });
            klipId = k.id;
          }
          await tx.update(schema.naskahSuara).set({ status: "siap", alasan: null, klipId, diubah: jam() }).where(eq(schema.naskahSuara.id, n.id));
          await tx.execute(sql`select pg_notify('antikebo_peristiwa', ${JSON.stringify({ p: n.penggunaId, j: "klip_siap" })})`);
          h.siap++;
        });
      } catch (e) {
        // Galat tak terduga (DB): kembalikan ke antrean dengan jeda, tanpa mencatat teks naskah.
        log.warn({ err: (e as Error)?.message, naskah: n.id }, "antrean suara gagal");
        await db()
          .update(schema.naskahSuara)
          .set({ status: "menunggu", cobaLagiSetelah: new Date(jam().getTime() + jedaUlang(n.percobaan)), diubah: jam() })
          .where(eq(schema.naskahSuara.id, n.id))
          .catch(() => {});
        h.ulang++;
      }
    }),
  );
  return h;
}
