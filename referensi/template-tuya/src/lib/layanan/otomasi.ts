import { and, eq, sql } from "drizzle-orm";
import { barisDari, denganPengguna, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { dalamRentang, jamSahOtomasi, pemicuButuhAngka, pemicuButuhKode, pemicuDidukung, terpicu, uraikanPemicu, type JenisPemicu, type Pantauan, type Pemicu } from "@/lib/otomasi/pemicu";
import type { PerintahRamah } from "@/lib/tuya/kemampuan";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, type Sumber } from "./dasar";
import { kirimNotifikasi, tangkapKamera, type SaluranNotifikasi } from "./ekstra";
import { cariPerangkat, kemampuanDari, kendalikan, kodeModel, menyalakan, perangkatDenganModel } from "./rumah";
import { cariSuasana, jalankanSuasana } from "./suasana";

// Otomasi "kalau X maka Y". Dibuat dari web atau agen; dievaluasi pada setiap
// perubahan keadaan perangkat (WebSocket Tuya di worker, atau kendali dari
// app ini). Satu baris diklaim secara atomik sebelum aksi dijalankan, jadi
// dua proses yang melihat perubahan yang sama tidak menembak dua kali.

export type Otomasi = typeof schema.otomasi.$inferSelect;

export type AksiOtomasi =
  | { jenis: "perangkat"; deviceId: string; perintah: Record<string, unknown>; ringkasan: string }
  | { jenis: "suasana"; suasanaId: string; ringkasan: string }
  | { jenis: "notifikasi"; judul: string; isi: string; ringkasan: string }
  | { jenis: "foto"; deviceId: string; kirim: KirimFoto; ringkasan: string };

/** Ke mana tautan foto otomasi dikirim. "simpan" = hanya disimpan (lihat lewat agen/app). */
export type KirimFoto = Exclude<SaluranNotifikasi, "telepon"> | "simpan";
const LABEL_KIRIM: Record<KirimFoto, string> = { app: "app Smart Life", email: "email", sms: "SMS", simpan: "galeri foto" };

export type PemicuTersimpan = Pemicu & { ringkasan: string };

export type MasukanAksi =
  | { perangkat: string; perintah: PerintahRamah; ringkasan: string }
  | { suasana: string }
  | { notifikasi: { judul: string; isi: string } }
  | { foto: { perangkat: string; kirim?: KirimFoto } };

export type MasukanOtomasi = {
  nama?: string;
  pemicu: { perangkat: string; jenis: JenisPemicu; nilai?: number; kode?: string; sama?: string | number | boolean };
  aksi: MasukanAksi[];
  hanyaAntara?: { mulai: string; akhir: string } | null;
  jedaMenit?: number;
  /** Agen: true hanya sesudah pengguna setuju aksi yang MENYALAKAN perangkat sensitif. */
  konfirmasi?: boolean;
};

const MAKS_OTOMASI = 50;
const MAKS_AKSI = 10;

export async function buatOtomasi(penggunaId: string, m: MasukanOtomasi, sumber: Sumber): Promise<Otomasi> {
  const p = await cariPerangkat(penggunaId, m.pemicu.perangkat);
  const pemicu: Pemicu = { deviceId: p.id, jenis: m.pemicu.jenis };
  if (pemicuButuhAngka(m.pemicu.jenis)) {
    if (typeof m.pemicu.nilai !== "number" || !Number.isFinite(m.pemicu.nilai)) throw new GalatLayanan("masukan", "Pemicu ini butuh angka batas, misalnya suhu di atas 30.");
    pemicu.nilai = m.pemicu.nilai;
  }
  if (pemicuButuhKode(m.pemicu.jenis)) {
    if (!m.pemicu.kode) throw new GalatLayanan("masukan", "Pemicu ini butuh kode properti (lihat get_device: readings / settings).");
    pemicu.kode = m.pemicu.kode;
  }
  if (m.pemicu.jenis === "properti_sama") {
    if (m.pemicu.sama === undefined) throw new GalatLayanan("masukan", "Pemicu properti butuh nilainya.");
    pemicu.sama = m.pemicu.sama;
  }
  const baris = await perangkatDenganModel(penggunaId, p.id).catch(() => null);
  if (baris?.model && !pemicuDidukung(pemicu, kemampuanDari(baris), kodeModel(baris))) {
    throw new GalatLayanan("tidak_didukung", `"${p.nama}" tidak melaporkan keadaan itu, jadi tidak bisa dipakai sebagai pemicu ini.`, { bisa: p.bisa });
  }

  if (!m.aksi.length) throw new GalatLayanan("masukan", "Tentukan minimal satu aksi: atur perangkat, jalankan suasana, kirim notifikasi, atau ambil foto kamera.");
  if (m.aksi.length > MAKS_AKSI) throw new GalatLayanan("masukan", `Satu otomasi paling banyak ${MAKS_AKSI} aksi.`);
  const aksi: AksiOtomasi[] = [];
  let adaNotif = false;
  let adaFoto = false;
  for (const a of m.aksi) {
    if ("foto" in a) {
      const kam = await cariPerangkat(penggunaId, a.foto.perangkat);
      if (kam.jenis !== "kamera") throw new GalatLayanan("tidak_didukung", `"${kam.nama}" bukan kamera, jadi tidak bisa mengambil foto.`);
      const kirim = a.foto.kirim ?? "app";
      if (!(kirim in LABEL_KIRIM)) throw new GalatLayanan("masukan", "Kirim foto ke: app, email, sms, atau simpan.");
      adaFoto = true;
      if (kirim !== "simpan") adaNotif = true;
      aksi.push({ jenis: "foto", deviceId: kam.id, kirim, ringkasan: `ambil foto ${kam.nama}${kirim === "simpan" ? " (disimpan)" : ` lalu kirim ke ${LABEL_KIRIM[kirim]}`}` });
    } else if ("suasana" in a) {
      const s = await cariSuasana(penggunaId, a.suasana);
      aksi.push({ jenis: "suasana", suasanaId: s.id, ringkasan: `suasana ${s.nama}` });
    } else if ("notifikasi" in a) {
      const judul = a.notifikasi.judul.trim().slice(0, 50), isi = a.notifikasi.isi.trim().slice(0, 300);
      if (!judul || !isi) throw new GalatLayanan("masukan", "Notifikasi butuh judul dan isi.");
      adaNotif = true;
      aksi.push({ jenis: "notifikasi", judul, isi, ringkasan: `kirim notifikasi "${judul}"` });
    } else {
      if (!Object.keys(a.perintah).length) throw new GalatLayanan("masukan", "Aksi perangkat butuh perintah, misalnya nyalakan atau matikan.");
      const t = await cariPerangkat(penggunaId, a.perangkat);
      if (sumber === "agen" && t.sensitif && menyalakan(a.perintah) && !m.konfirmasi) {
        throw new GalatLayanan("perlu_konfirmasi", `Otomasi ini akan menyalakan "${t.nama}" tanpa diawasi. Tanyakan dulu ke pengguna, lalu ulangi dengan confirm: true.`, { perangkat: t.nama });
      }
      aksi.push({ jenis: "perangkat", deviceId: t.id, perintah: a.perintah as Record<string, unknown>, ringkasan: `${t.nama}: ${a.ringkasan}` });
    }
  }

  const r = m.hanyaAntara;
  if (r && (!jamSahOtomasi(r.mulai) || !jamSahOtomasi(r.akhir))) throw new GalatLayanan("masukan", 'Rentang jam pakai format "HH:MM", contoh 18:00 sampai 06:00.');
  // Notifikasi Tuya dibatasi per hari: jeda minimal 10 menit supaya tidak habis karena sensor yang ramai.
  // Foto kamera butuh ~30 dtk unggah ke awan: minimal 2 menit walau tidak dikirim ke mana pun.
  const jeda = Math.min(Math.max(Math.round(m.jedaMenit ?? 5), adaNotif ? 10 : adaFoto ? 2 : 1), 1440);
  const ringkasPemicu = uraikanPemicu(pemicu, p.nama);
  const simpanPemicu: PemicuTersimpan = { ...pemicu, ringkasan: ringkasPemicu };
  const nama = (m.nama?.trim() || `Saat ${ringkasPemicu}`).slice(0, 80);

  const baru = await denganPengguna(penggunaId, async (tx) => {
    // Kunci per pemilik: dua permintaan serentak tidak bisa sama-sama lolos batas.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"otomasi:" + penggunaId}))`);
    const [{ n }] = barisDari<{ n: number }>(await tx.execute(sql`select count(*)::int as n from otomasi where pengguna_id = ${penggunaId}`));
    if (n >= MAKS_OTOMASI) throw new GalatLayanan("masukan", `Paling banyak ${MAKS_OTOMASI} otomasi. Hapus yang tidak dipakai dulu.`);
    const [o] = await tx
      .insert(schema.otomasi)
      .values({ penggunaId, nama, pemicu: simpanPemicu, aksi, hanyaAntara: r ?? null, jedaMenit: jeda, aktif: true, dibuatOleh: sumber === "agen" ? "agen" : "web" })
      .returning();
    return o;
  });
  await catatAktivitas(penggunaId, { sumber, jenis: "otomasi", ringkasan: `Otomasi dibuat: ${nama}` });
  return baru;
}

export async function daftarOtomasi(penggunaId: string): Promise<Otomasi[]> {
  return denganPengguna(penggunaId, (tx) =>
    tx.select().from(schema.otomasi).where(eq(schema.otomasi.penggunaId, penggunaId)).orderBy(sql`${schema.otomasi.aktif} desc`, schema.otomasi.dibuat),
  );
}

export function deskripsiOtomasi(o: Otomasi): string {
  const pm = o.pemicu as PemicuTersimpan;
  const aksi = (o.aksi as AksiOtomasi[]).map((a) => a.ringkasan).join(", ");
  const r = o.hanyaAntara ? ` (hanya ${o.hanyaAntara.mulai}-${o.hanyaAntara.akhir})` : "";
  return `Saat ${pm.ringkasan}${r}: ${aksi}`;
}

export async function cariOtomasi(penggunaId: string, rujukan: string): Promise<Otomasi> {
  const semua = await daftarOtomasi(penggunaId);
  const persis = semua.find((o) => o.id === rujukan.trim());
  if (persis) return persis;
  const r = rujukan.trim().toLowerCase();
  const cocok = semua.filter((o) => o.nama.toLowerCase().includes(r));
  if (cocok.length === 1) return cocok[0];
  if (cocok.length > 1) throw new GalatLayanan("ambigu", `Ada ${cocok.length} otomasi yang cocok. Sebutkan id-nya.`, { kandidat: cocok.map((o) => ({ id: o.id, nama: o.nama })) });
  throw new GalatLayanan("tidak_ditemukan", "Otomasi tidak ditemukan.");
}

export async function hapusOtomasi(penggunaId: string, id: string, sumber: Sumber): Promise<void> {
  const [o] = await denganPengguna(penggunaId, (tx) =>
    tx.delete(schema.otomasi).where(and(eq(schema.otomasi.penggunaId, penggunaId), eq(schema.otomasi.id, id))).returning({ nama: schema.otomasi.nama }),
  );
  if (!o) throw new GalatLayanan("tidak_ditemukan", "Otomasi tidak ditemukan.");
  await catatAktivitas(penggunaId, { sumber, jenis: "otomasi", ringkasan: `Otomasi dihapus: ${o.nama}` });
}

export async function aturAktifOtomasi(penggunaId: string, id: string, aktif: boolean, sumber: Sumber): Promise<Otomasi> {
  const [o] = await denganPengguna(penggunaId, (tx) =>
    tx.update(schema.otomasi).set({ aktif }).where(and(eq(schema.otomasi.penggunaId, penggunaId), eq(schema.otomasi.id, id))).returning(),
  );
  if (!o) throw new GalatLayanan("tidak_ditemukan", "Otomasi tidak ditemukan.");
  await catatAktivitas(penggunaId, { sumber, jenis: "otomasi", ringkasan: `Otomasi ${aktif ? "dinyalakan" : "dijeda"}: ${o.nama}` });
  return o;
}

async function jalankanAksi(penggunaId: string, a: AksiOtomasi, o: Otomasi): Promise<string | null> {
  if (a.jenis === "perangkat") {
    await kendalikan(penggunaId, a.deviceId, a.perintah as PerintahRamah, { sumber: "otomasi" });
    return null;
  }
  if (a.jenis === "suasana") {
    const r = await jalankanSuasana(penggunaId, a.suasanaId, "otomasi");
    return r.gagal.length ? r.gagal.map((g) => `${g.nama} ${g.alasan}`).join("; ") : null;
  }
  if (a.jenis === "foto") return ambilFotoOtomasi(penggunaId, a, o);
  await kirimNotifikasi(penggunaId, a.judul, a.isi, "otomasi");
  return null;
}

/** Ambil foto saat otomasi menembak, simpan 7 hari, lalu kirim tautannya ke pemilik. */
async function ambilFotoOtomasi(penggunaId: string, a: Extract<AksiOtomasi, { jenis: "foto" }>, o: Otomasi): Promise<string | null> {
  const kejadian = (o.pemicu as PemicuTersimpan).ringkasan;
  const h = await tangkapKamera(penggunaId, a.deviceId, "foto", 10, undefined, "otomasi", { otomasiId: o.id, catatan: kejadian });
  const url = h.tersimpan?.url ?? h.gambar;
  if (a.kirim !== "simpan" && url) {
    const judul = `Foto ${h.perangkat}`.slice(0, 50);
    const isi = `${kejadian}. Lihat foto${h.tersimpan ? " (tersimpan 7 hari)" : ""}: ${url}`.slice(0, 300);
    await kirimNotifikasi(penggunaId, judul, isi, "otomasi", a.kirim);
  }
  return h.tersimpan ? null : "foto tidak bisa disimpan, tautan dari Tuya hanya berlaku beberapa menit";
}

/**
 * Nilai otomasi berpemicu `deviceId` terhadap perubahan sebelum -> sesudah.
 * Mengembalikan jumlah otomasi yang ditembak.
 */
export async function evaluasiPerubahan(penggunaId: string, deviceId: string, sebelum: Pantauan, sesudah: Pantauan, sekarang = new Date()): Promise<number> {
  const kandidat = await denganPengguna(penggunaId, (tx) =>
    tx
      .select()
      .from(schema.otomasi)
      .where(and(eq(schema.otomasi.penggunaId, penggunaId), eq(schema.otomasi.aktif, true), sql`${schema.otomasi.pemicu}->>'deviceId' = ${deviceId}`)),
  );
  if (!kandidat.length) return 0;
  const [b] = await denganPengguna(penggunaId, (tx) =>
    tx.select().from(schema.perangkat).where(and(eq(schema.perangkat.penggunaId, penggunaId), eq(schema.perangkat.deviceId, deviceId))).limit(1),
  );
  if (!b) return 0;
  const [u] = await denganPengguna(penggunaId, (tx) => tx.select({ zona: schema.pengguna.zonaWaktu }).from(schema.pengguna).where(eq(schema.pengguna.id, penggunaId)).limit(1));
  const zona = u?.zona ?? "Asia/Jakarta";
  const k = kemampuanDari(b);

  let ditembak = 0;
  for (const o of kandidat) {
    const pm = o.pemicu as PemicuTersimpan;
    if (!terpicu(pm, k, sebelum, sesudah)) continue;
    if (!dalamRentang(o.hanyaAntara, sekarang, zona)) continue;
    // Klaim atomik + jeda: hanya satu proses yang menang, dan sensor yang ramai tidak membanjiri.
    const [klaim] = await denganPengguna(penggunaId, (tx) =>
      tx
        .update(schema.otomasi)
        .set({ terakhirJalan: sekarang, terakhirHasil: "berjalan" })
        .where(
          and(
            eq(schema.otomasi.id, o.id),
            eq(schema.otomasi.aktif, true),
            // jeda_menit integer NOT NULL (skema): make_interval menerima kolom langsung.
            sql`(${schema.otomasi.terakhirJalan} is null or ${schema.otomasi.terakhirJalan} < ${sekarang.toISOString()}::timestamptz - make_interval(mins => ${schema.otomasi.jedaMenit}))`,
          ),
        )
        .returning({ id: schema.otomasi.id }),
    );
    if (!klaim) continue;
    ditembak++;
    const catatan: string[] = [];
    for (const a of o.aksi as AksiOtomasi[]) {
      try {
        const sebagian = await jalankanAksi(penggunaId, a, o);
        if (sebagian) catatan.push(`${a.ringkasan}: ${sebagian}`);
      } catch (e) {
        catatan.push(`${a.ringkasan}: ${e instanceof GalatLayanan ? e.message : "galat tak terduga"}`);
        if (!(e instanceof GalatLayanan)) log.error({ err: (e as Error)?.message, otomasi: o.id }, "aksi otomasi gagal");
      }
    }
    const hasil = catatan.length ? `sebagian gagal: ${catatan.join("; ")}` : "ok";
    await denganPengguna(penggunaId, (tx) => tx.update(schema.otomasi).set({ terakhirHasil: hasil.slice(0, 300) }).where(eq(schema.otomasi.id, o.id)));
    await catatAktivitas(penggunaId, { sumber: "otomasi", jenis: "otomasi", ringkasan: `Otomasi "${o.nama}" berjalan`, berhasil: !catatan.length, galat: catatan.join("; ") || null });
  }
  return ditembak;
}
