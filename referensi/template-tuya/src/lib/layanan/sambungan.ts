import { eq } from "drizzle-orm";
import { denganPengguna, schema } from "@/lib/db";
import { bukaRahasia, sandikanRahasia } from "@/lib/kripto";
import { log } from "@/lib/log";
import { GalatTuya, KlienTuya } from "@/lib/tuya/klien";
import { bacaKunci, samarkanKunci, WILAYAH, type KodeWilayah } from "@/lib/tuya/wilayah";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, type Sumber } from "./dasar";
import { sinkronkan, type RingkasanSinkron } from "./rumah";

// Sambungan Tuya: kunci `sk-...` milik pemilik. Disimpan terenkripsi (AAD
// terikat pengguna), dibuka hanya di server tepat sebelum memanggil Tuya.

const aad = (penggunaId: string) => `tuya:${penggunaId}`;

function opsiKlien() {
  const basis = process.env.TUYA_BASIS_UJI?.trim();
  return basis ? { basisOverride: basis } : {};
}

export type Sambungan = typeof schema.sambunganTuya.$inferSelect;

export async function bacaSambungan(penggunaId: string): Promise<Sambungan | null> {
  const [s] = await denganPengguna(penggunaId, (tx) =>
    tx.select().from(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId)).limit(1),
  );
  return s ?? null;
}

/** Klien Tuya untuk pemilik ini, atau galat yang menjelaskan kenapa belum bisa. */
export async function klienUntuk(penggunaId: string, s?: Sambungan | null): Promise<KlienTuya> {
  const sambungan = s === undefined ? await bacaSambungan(penggunaId) : s;
  if (!sambungan) {
    throw new GalatLayanan("belum_tersambung", "Rumah belum disambungkan. Buka tuya.agentbuff.id lalu tempel kunci dari tuya.ai (3 menit).");
  }
  if (sambungan.status === "kunci_bermasalah") {
    throw new GalatLayanan("kunci_bermasalah", "Kunci Tuya sudah tidak berlaku (biasanya kedaluwarsa). Perbarui di tuya.agentbuff.id: ambil kunci baru di tuya.ai, lalu tempel.");
  }
  return new KlienTuya(bukaRahasia(sambungan.kunciSandi, aad(penggunaId)), opsiKlien());
}

/** Terjemahkan galat Tuya ke galat layanan; kunci ditolak -> tandai sambungan bermasalah. */
export async function tanganiGalatTuya(penggunaId: string, e: unknown): Promise<never> {
  if (e instanceof GalatLayanan) throw e;
  if (e instanceof GalatTuya) {
    switch (e.jenis) {
      case "kunci_tidak_sah":
        await denganPengguna(penggunaId, (tx) =>
          tx
            .update(schema.sambunganTuya)
            .set({ status: "kunci_bermasalah", statusPesan: `Tuya menolak kunci (${e.kode ?? "?"})`, diubah: new Date() })
            .where(eq(schema.sambunganTuya.penggunaId, penggunaId)),
        );
        throw new GalatLayanan("kunci_bermasalah", "Tuya menolak kunci rumahmu (biasanya kedaluwarsa). Ambil kunci baru di tuya.ai lalu tempel di tuya.agentbuff.id.");
      case "perangkat_tak_ada":
        throw new GalatLayanan("tidak_ditemukan", "Perangkat tidak ada lagi di akun Smart Life/Tuya-mu. Coba muat ulang daftar perangkat.");
      case "perangkat_offline":
        throw new GalatLayanan("offline", "Perangkat sedang offline menurut Tuya. Periksa listrik dan Wi-Fi perangkatnya, lalu coba lagi.");
      case "model_tak_ada":
        throw new GalatLayanan("tidak_didukung", "Tuya belum menyediakan pengendalian untuk perangkat ini.");
      case "parameter":
        throw new GalatLayanan("nilai_tidak_sah", "Tuya menolak perintah itu untuk perangkat ini.");
      case "batas_laju":
        throw new GalatLayanan("batas_laju", "Tuya sedang membatasi permintaan. Coba lagi dalam satu menit.");
      case "batas_notifikasi":
        throw new GalatLayanan("batas_laju", "Batas notifikasi harian Tuya sudah tercapai.");
      case "tidak_ada_kontak":
        throw new GalatLayanan("tidak_didukung", "Akun Smart Life/Tuya-mu belum punya nomor/email untuk menerima notifikasi.");
      default:
        log.warn({ jenis: e.jenis, kode: e.kode }, "galat Tuya");
        throw new GalatLayanan("tuya_gangguan", "Server Tuya sedang tidak bisa dihubungi. Coba lagi sebentar lagi.");
    }
  }
  throw e;
}

export async function denganTuya<T>(penggunaId: string, fn: (k: KlienTuya) => Promise<T>): Promise<T> {
  const k = await klienUntuk(penggunaId);
  try {
    return await fn(k);
  } catch (e) {
    return tanganiGalatTuya(penggunaId, e);
  }
}

export type HasilSimpanKunci = RingkasanSinkron & { wilayah: { kode: KodeWilayah; nama: string } };

/**
 * Simpan / perbarui kunci. Kunci diuji ke Tuya DULU; yang ditolak tidak pernah
 * disimpan. Sesudah tersimpan, rumah + perangkat langsung disinkronkan.
 */
export async function simpanKunci(penggunaId: string, masukan: string, sumber: Sumber = "web"): Promise<HasilSimpanKunci> {
  const baca = bacaKunci(masukan);
  if (!baca.ok) {
    const pesan = {
      kosong: "Tempel kuncinya dulu.",
      bukan_kunci: 'Itu belum terlihat seperti kunci Tuya. Kunci diawali "sk-" lalu huruf dan angka.',
      wilayah_tak_dikenal: "Kunci ini dari wilayah yang belum dikenali. Pastikan kunci disalin utuh dari tuya.ai.",
    }[baca.alasan];
    throw new GalatLayanan("kunci_tidak_sah", pesan);
  }
  const klien = new KlienTuya(baca.kunci, opsiKlien());
  try {
    await klien.rumah();
  } catch (e) {
    if (e instanceof GalatTuya && e.jenis === "kunci_tidak_sah") {
      throw new GalatLayanan("kunci_tidak_sah", "Tuya menolak kunci ini. Pastikan disalin utuh dan masih berlaku, atau buat kunci baru di tuya.ai.");
    }
    if (e instanceof GalatTuya && e.jenis === "jaringan") {
      throw new GalatLayanan("tuya_gangguan", `Server Tuya ${baca.wilayah.nama.id} tidak bisa dihubungi. Coba lagi sebentar lagi.`);
    }
    throw new GalatLayanan("tuya_gangguan", "Tuya belum bisa memeriksa kunci ini. Coba lagi sebentar lagi.");
  }

  const nilai = {
    kunciSandi: sandikanRahasia(baca.kunci, aad(penggunaId)),
    kunciSamar: samarkanKunci(baca.kunci),
    wilayah: baca.wilayah.kode,
    status: "aktif",
    statusPesan: null,
    tersambungPada: new Date(),
    diperiksaPada: new Date(),
    diubah: new Date(),
  };
  await denganPengguna(penggunaId, (tx) =>
    tx
      .insert(schema.sambunganTuya)
      .values({ penggunaId, ...nilai })
      .onConflictDoUpdate({ target: schema.sambunganTuya.penggunaId, set: nilai }),
  );
  const ringkas = await sinkronkan(penggunaId, klien);
  await catatAktivitas(penggunaId, {
    sumber,
    jenis: "sambungan",
    ringkasan: `Rumah tersambung: ${ringkas.perangkat} perangkat di ${ringkas.rumah} rumah`,
    detail: { wilayah: baca.wilayah.kode },
  });
  return { ...ringkas, wilayah: { kode: baca.wilayah.kode, nama: baca.wilayah.nama.id } };
}

/** Putuskan: kunci + cermin perangkat dihapus. Suasana & jadwal disimpan (berlaku lagi bila akun sama disambungkan). */
export async function putuskan(penggunaId: string, sumber: Sumber = "web"): Promise<void> {
  await denganPengguna(penggunaId, async (tx) => {
    await tx.delete(schema.perangkat).where(eq(schema.perangkat.penggunaId, penggunaId));
    await tx.delete(schema.sambunganTuya).where(eq(schema.sambunganTuya.penggunaId, penggunaId));
  });
  await catatAktivitas(penggunaId, { sumber, jenis: "sambungan", ringkasan: "Sambungan rumah diputus; kunci dihapus dari server" });
}

export function namaWilayah(kode: string): string {
  return WILAYAH[kode as KodeWilayah]?.nama.id ?? kode;
}
