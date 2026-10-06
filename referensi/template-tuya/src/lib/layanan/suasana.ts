import { and, asc, eq } from "drizzle-orm";
import { denganPengguna, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, normal, type Sumber } from "./dasar";
import { daftarPerangkat, kemampuanDari, kendalikan, type PerangkatRamah } from "./rumah";

// Suasana (scene) milik kita: API end-user Tuya tidak menyediakan scene, jadi
// suasana = daftar {perangkat, properti} yang dikirim berurutan.

export type Suasana = typeof schema.suasana.$inferSelect;
export type AksiSuasana = { deviceId: string; properti: Record<string, unknown> };

const KODE_KEADAAN = (k: ReturnType<typeof kemampuanDari>): string[] =>
  [
    k.daya?.kode,
    ...(k.saluran?.map((s) => s.kode) ?? []),
    k.terang?.kode,
    k.suhuPutih?.kode,
    k.warna?.kode,
    k.modeKerja?.kode,
    k.suhuTarget?.kode,
    k.modeAc?.kode,
    k.kipas?.kode,
    k.posisi?.kode,
  ].filter((x): x is string => !!x);

/** Ambil keadaan sekarang dari cermin perangkat (bukan dari Tuya - sudah segar lewat WebSocket). */
export async function potretKeadaan(penggunaId: string, ids: string[]): Promise<AksiSuasana[]> {
  const baris = await denganPengguna(penggunaId, (tx) => tx.select().from(schema.perangkat).where(eq(schema.perangkat.penggunaId, penggunaId)));
  const peta = new Map(baris.map((b) => [b.deviceId, b]));
  const aksi: AksiSuasana[] = [];
  for (const id of ids) {
    const b = peta.get(id);
    if (!b || !b.properti) continue;
    const k = kemampuanDari(b);
    const kode = KODE_KEADAAN(k);
    const prop: Record<string, unknown> = {};
    for (const c of kode) if (c in b.properti) prop[c] = b.properti[c];
    // Perangkat mati: cukup simpan "mati" - nilai warna/terang tidak relevan.
    const daya = k.daya?.kode;
    if (daya && prop[daya] === false) {
      aksi.push({ deviceId: id, properti: { [daya]: false } });
      continue;
    }
    // Lampu berwarna: kirim warna saja; lampu putih: terang+suhu saja (hindari kedip mode).
    if (k.modeKerja && prop[k.modeKerja.kode] === "colour") {
      if (k.terang) delete prop[k.terang.kode];
      if (k.suhuPutih) delete prop[k.suhuPutih.kode];
    } else if (k.modeKerja && prop[k.modeKerja.kode] === "white" && k.warna) delete prop[k.warna.kode];
    if (Object.keys(prop).length) aksi.push({ deviceId: id, properti: prop });
  }
  return aksi;
}

export async function daftarSuasana(penggunaId: string): Promise<Suasana[]> {
  return denganPengguna(penggunaId, (tx) =>
    tx.select().from(schema.suasana).where(eq(schema.suasana.penggunaId, penggunaId)).orderBy(asc(schema.suasana.urutan), asc(schema.suasana.dibuat)),
  );
}

export async function cariSuasana(penggunaId: string, rujukan: string): Promise<Suasana> {
  const semua = await daftarSuasana(penggunaId);
  const byId = semua.find((s) => s.id === rujukan);
  if (byId) return byId;
  const r = normal(rujukan.replace(/^(suasana|scene|mode)\s+/i, ""));
  const cocok = semua.filter((s) => normal(s.nama) === r);
  const cocok2 = cocok.length ? cocok : semua.filter((s) => normal(s.nama).includes(r));
  if (cocok2.length === 1) return cocok2[0];
  if (cocok2.length > 1) throw new GalatLayanan("ambigu", `Ada beberapa suasana yang cocok dengan "${rujukan}".`, { kandidat: cocok2.map((s) => s.nama) });
  throw new GalatLayanan("tidak_ditemukan", `Suasana "${rujukan}" belum ada.`, { tersedia: semua.map((s) => s.nama) });
}

const IKON_SAH = new Set(["sparkles", "sun", "moon", "film", "briefcase", "coffee", "bed", "home", "party-popper", "book-open", "utensils", "dumbbell", "leaf", "power"]);
const WARNA_SAH = new Set(["nila", "biru", "sian", "hijau", "kuning", "oranye", "merah", "merah_muda", "ungu", "abu"]);

export async function simpanSuasana(
  penggunaId: string,
  isi: { id?: string; nama: string; ikon?: string; warna?: string; aksi: AksiSuasana[] },
  sumber: Sumber,
): Promise<Suasana> {
  const nama = isi.nama.trim().slice(0, 40);
  if (!nama) throw new GalatLayanan("masukan", "Beri nama suasananya, misalnya Kerja atau Tidur.");
  if (!isi.aksi.length) throw new GalatLayanan("masukan", "Pilih minimal satu perangkat untuk suasana ini.");
  if (isi.aksi.length > 40) throw new GalatLayanan("masukan", "Satu suasana paling banyak 40 perangkat.");
  const nilai = {
    nama,
    ikon: isi.ikon && IKON_SAH.has(isi.ikon) ? isi.ikon : "sparkles",
    warna: isi.warna && WARNA_SAH.has(isi.warna) ? isi.warna : "nila",
    aksi: isi.aksi,
    diubah: new Date(),
  };
  const [hasil] = await denganPengguna(penggunaId, async (tx) => {
    if (isi.id) {
      return tx
        .update(schema.suasana)
        .set(nilai)
        .where(and(eq(schema.suasana.penggunaId, penggunaId), eq(schema.suasana.id, isi.id)))
        .returning();
    }
    // Nama yang sama = perbarui suasana itu ("simpan suasana Kerja" dua kali tidak membuat kembar).
    const ada = await tx.select({ id: schema.suasana.id, nama: schema.suasana.nama }).from(schema.suasana).where(eq(schema.suasana.penggunaId, penggunaId));
    const sama = ada.find((s) => normal(s.nama) === normal(nama));
    if (sama) return tx.update(schema.suasana).set(nilai).where(eq(schema.suasana.id, sama.id)).returning();
    return tx.insert(schema.suasana).values({ penggunaId, urutan: ada.length, ...nilai }).returning();
  });
  if (!hasil) throw new GalatLayanan("tidak_ditemukan", "Suasana tidak ditemukan.");
  await catatAktivitas(penggunaId, { sumber, jenis: "suasana", ringkasan: `Suasana "${nama}" disimpan (${isi.aksi.length} perangkat)` });
  return hasil;
}

export async function hapusSuasana(penggunaId: string, id: string, sumber: Sumber): Promise<void> {
  const s = await cariSuasana(penggunaId, id);
  await denganPengguna(penggunaId, (tx) => tx.delete(schema.suasana).where(and(eq(schema.suasana.penggunaId, penggunaId), eq(schema.suasana.id, s.id))));
  await catatAktivitas(penggunaId, { sumber, jenis: "suasana", ringkasan: `Suasana "${s.nama}" dihapus` });
}

export type HasilJalanSuasana = { suasana: string; berhasil: string[]; gagal: Array<{ nama: string; alasan: string }> };

/** Jalankan suasana: kirim properti tiap perangkat. Perangkat offline dilewati dan dilaporkan. */
export async function jalankanSuasana(penggunaId: string, rujukan: string, sumber: Sumber): Promise<HasilJalanSuasana> {
  const s = await cariSuasana(penggunaId, rujukan);
  const perangkat = new Map((await daftarPerangkat(penggunaId, { termasukTersembunyi: true })).map((p) => [p.id, p] as [string, PerangkatRamah]));
  const hasil: HasilJalanSuasana = { suasana: s.nama, berhasil: [], gagal: [] };
  // Lewat jalur kendali penuh: sinyal IR untuk AC remote, dan "berhasil" hanya bila perangkat melapor.
  const antre = [...s.aksi];
  const pekerja = async () => {
    for (let a = antre.shift(); a; a = antre.shift()) {
      const p = perangkat.get(a.deviceId);
      if (!p) {
        hasil.gagal.push({ nama: a.deviceId, alasan: "perangkat tidak ada lagi" });
        continue;
      }
      if (!p.online) {
        hasil.gagal.push({ nama: p.nama, alasan: "offline" });
        continue;
      }
      try {
        const r = await kendalikan(penggunaId, a.deviceId, { properti: a.properti }, { sumber, konfirmasi: true });
        if (r.status === "belum_terkonfirmasi") hasil.gagal.push({ nama: p.nama, alasan: "belum melaporkan perubahan" });
        else hasil.berhasil.push(p.nama);
      } catch (e) {
        if (!(e instanceof GalatLayanan)) log.warn({ err: (e as Error)?.message }, "aksi suasana gagal");
        hasil.gagal.push({ nama: p.nama, alasan: e instanceof GalatLayanan ? e.message : "Tuya menolak perintah" });
      }
    }
  };
  await Promise.all([pekerja(), pekerja(), pekerja()]);
  await denganPengguna(penggunaId, (tx) => tx.update(schema.suasana).set({ terakhirDipakai: new Date() }).where(eq(schema.suasana.id, s.id)));
  await catatAktivitas(penggunaId, {
    sumber,
    jenis: "suasana",
    ringkasan: `Suasana "${s.nama}" dijalankan: ${hasil.berhasil.length} berhasil${hasil.gagal.length ? `, ${hasil.gagal.length} dilewati` : ""}`,
    berhasil: hasil.gagal.length === 0,
  });
  return hasil;
}
