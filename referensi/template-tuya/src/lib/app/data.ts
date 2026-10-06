import { daftarJadwal, deskripsiJadwal } from "@/lib/layanan/jadwal";
import { daftarOtomasi, deskripsiOtomasi } from "@/lib/layanan/otomasi";
import { bacaStruktur, daftarPerangkat, type PerangkatRamah, type Struktur } from "@/lib/layanan/rumah";
import { bacaSambungan, namaWilayah } from "@/lib/layanan/sambungan";
import { daftarSuasana } from "@/lib/layanan/suasana";

// Bentuk data yang dikirim ke peramban. TIDAK PERNAH memuat kunci (bahkan
// sandinya) - hanya samaran untuk tampilan.

export type DataSambungan = { status: "aktif" | "kunci_bermasalah"; kunciSamar: string; wilayah: string; tersambungPada: string; diperiksaPada: string | null } | null;
export type DataSuasana = { id: string; nama: string; ikon: string; warna: string; jumlah: number; perangkat: string[] };
export type DataRumah = { sambungan: DataSambungan; struktur: Struktur | null; perangkat: PerangkatRamah[]; suasana: DataSuasana[] };
export type DataJadwal = { id: string; nama: string; sekali: boolean; uraian: string; aktif: boolean; berikutnya: string | null; terakhirHasil: string | null; dibuatOleh: string; target: "perangkat" | "suasana" };

export async function dataSambungan(penggunaId: string): Promise<DataSambungan> {
  const s = await bacaSambungan(penggunaId);
  if (!s) return null;
  return {
    status: s.status === "kunci_bermasalah" ? "kunci_bermasalah" : "aktif",
    kunciSamar: s.kunciSamar,
    wilayah: namaWilayah(s.wilayah),
    tersambungPada: s.tersambungPada.toISOString(),
    diperiksaPada: s.diperiksaPada?.toISOString() ?? null,
  };
}

export async function dataRumah(penggunaId: string): Promise<DataRumah> {
  const [sambungan, struktur, perangkat, suasana] = await Promise.all([
    dataSambungan(penggunaId),
    bacaStruktur(penggunaId),
    daftarPerangkat(penggunaId, { termasukTersembunyi: true }),
    daftarSuasana(penggunaId),
  ]);
  return {
    sambungan,
    struktur,
    perangkat,
    suasana: suasana.map((s) => ({ id: s.id, nama: s.nama, ikon: s.ikon, warna: s.warna, jumlah: s.aksi.length, perangkat: s.aksi.map((a) => a.deviceId) })),
  };
}

export async function dataJadwal(penggunaId: string): Promise<DataJadwal[]> {
  return (await daftarJadwal(penggunaId)).map((j) => ({
    id: j.id,
    nama: j.nama,
    sekali: j.jenis === "sekali",
    uraian: deskripsiJadwal(j),
    aktif: j.aktif,
    berikutnya: j.berikutnya?.toISOString() ?? null,
    terakhirHasil: j.terakhirHasil,
    dibuatOleh: j.dibuatOleh,
    target: j.target.jenis,
  }));
}

export type DataOtomasi = { id: string; nama: string; uraian: string; aktif: boolean; terakhirJalan: string | null; terakhirHasil: string | null; dibuatOleh: string };

export async function dataOtomasi(penggunaId: string): Promise<DataOtomasi[]> {
  return (await daftarOtomasi(penggunaId)).map((o) => ({
    id: o.id,
    nama: o.nama,
    uraian: deskripsiOtomasi(o),
    aktif: o.aktif,
    terakhirJalan: o.terakhirJalan?.toISOString() ?? null,
    terakhirHasil: o.terakhirHasil,
    dibuatOleh: o.dibuatOleh,
  }));
}
