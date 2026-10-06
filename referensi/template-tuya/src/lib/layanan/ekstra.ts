import { log } from "@/lib/log";
import { bagianLokal } from "@/lib/waktu/jadwal";
import { catatAktivitas } from "./aktivitas";
import { GalatLayanan, type Sumber } from "./dasar";
import { simpanTangkapan, type FotoTersimpan } from "./foto";
import { bacaStruktur, cariPerangkat } from "./rumah";
import { denganTuya } from "./sambungan";

// Layanan Tuya di luar kendali perangkat: listrik, cuaca, notifikasi ke diri sendiri.

const KODE_LISTRIK = ["add_ele", "ele_usage", "electricity", "cur_power"];

export type PemakaianHarian = { perangkat: string; tanggal: string; satuan: string; total: number; perJam: Array<{ jam: string; nilai: number }> };

/** Pemakaian listrik satu hari (jendela 24 jam, aturan Tuya) dari statistik per jam. */
export async function pemakaianListrik(penggunaId: string, rujukan: string, tanggal: string | null, zona: string): Promise<PemakaianHarian> {
  const p = await cariPerangkat(penggunaId, rujukan);
  const hari = tanggal ?? (() => {
    const b = bagianLokal(new Date(), zona);
    return `${b.tahun}-${String(b.bulan).padStart(2, "0")}-${String(b.tanggal).padStart(2, "0")}`;
  })();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) throw new GalatLayanan("masukan", "Tanggal pakai format YYYY-MM-DD.");
  return denganTuya(penggunaId, async (k) => {
    const konfig = (await k.jadwalStatistik()).filter((c) => c.dev_id === p.id);
    const pilih = KODE_LISTRIK.map((kode) => konfig.find((c) => c.dp_code === kode)).find(Boolean) ?? konfig[0];
    if (!pilih) throw new GalatLayanan("tidak_didukung", `"${p.nama}" tidak mencatat pemakaian listrik di Tuya.`);
    const dasar = hari.replace(/-/g, "");
    const data = await k.statistikPerJam(p.id, pilih.dp_code, pilih.statistic_type || "SUM", `${dasar}00`, `${dasar}23`);
    const perJam = data
      .flatMap((o) => Object.entries(o))
      .map(([jam, nilai]) => ({ jam: `${jam.slice(8, 10)}:00`, nilai: Number(nilai) }))
      .filter((x) => Number.isFinite(x.nilai))
      .sort((a, b) => a.jam.localeCompare(b.jam));
    // ele_usage/add_ele di statistik Tuya dalam kWh; nilai mentah sudah desimal.
    const total = Math.round(perJam.reduce((n, x) => n + x.nilai, 0) * 1000) / 1000;
    return { perangkat: p.nama, tanggal: hari, satuan: pilih.dp_code === "cur_power" ? "W" : "kWh", total, perJam };
  });
}

export type RiwayatPerangkat = {
  perangkat: string;
  tanggal: string;
  tersedia: Array<{ kode: string; jenis: string }>;
  kode: string;
  jenis: string;
  total: number | null;
  perJam: Array<{ jam: string; nilai: number }>;
};

/**
 * Riwayat per jam APA PUN yang dicatat Tuya untuk perangkat (listrik, suhu,
 * hitungan buka pintu, dll. - sesuai statistics/hour/config akun). Satu hari.
 */
export async function riwayatPerangkat(penggunaId: string, rujukan: string, kode: string | null, tanggal: string | null, zona: string): Promise<RiwayatPerangkat> {
  const p = await cariPerangkat(penggunaId, rujukan);
  const hari = tanggal ?? (() => {
    const b = bagianLokal(new Date(), zona);
    return `${b.tahun}-${String(b.bulan).padStart(2, "0")}-${String(b.tanggal).padStart(2, "0")}`;
  })();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) throw new GalatLayanan("masukan", "Tanggal pakai format YYYY-MM-DD.");
  return denganTuya(penggunaId, async (k) => {
    const konfig = (await k.jadwalStatistik()).filter((c) => c.dev_id === p.id);
    if (!konfig.length) throw new GalatLayanan("tidak_didukung", `Tuya tidak mencatat riwayat untuk "${p.nama}". Keadaan sekarang tetap bisa dibaca dengan get_device.`);
    const pilih = (kode ? konfig.find((c) => c.dp_code === kode) : null) ?? konfig[0];
    if (kode && pilih.dp_code !== kode) throw new GalatLayanan("tidak_didukung", `Riwayat "${kode}" tidak dicatat. Tersedia: ${konfig.map((c) => c.dp_code).join(", ")}.`);
    const dasar = hari.replace(/-/g, "");
    const data = await k.statistikPerJam(p.id, pilih.dp_code, pilih.statistic_type || "SUM", `${dasar}00`, `${dasar}23`);
    const perJam = data
      .flatMap((o) => Object.entries(o))
      .map(([jam, nilai]) => ({ jam: `${jam.slice(8, 10)}:00`, nilai: Number(nilai) }))
      .filter((x) => Number.isFinite(x.nilai))
      .sort((a, b) => a.jam.localeCompare(b.jam));
    const jenis = (pilih.statistic_type || "SUM").toUpperCase();
    const total = jenis === "SUM" || jenis === "COUNT" ? Math.round(perJam.reduce((n, x) => n + x.nilai, 0) * 1000) / 1000 : null;
    return { perangkat: p.nama, tanggal: hari, tersedia: konfig.map((c) => ({ kode: c.dp_code, jenis: c.statistic_type })), kode: pilih.dp_code, jenis, total, perJam };
  });
}

export type Cuaca = { rumah: string; suhu: number | null; terasa: number | null; kelembapan: number | null; kondisi: string | null; perJam: Array<{ jamKe: number; suhu: number | null; kondisi: string | null }> };

const KONDISI_ID: Record<string, string> = {
  sunny: "cerah", clear: "cerah", cloudy: "berawan", overcast: "mendung", "partly cloudy": "cerah berawan", rain: "hujan", "light rain": "hujan ringan",
  "moderate rain": "hujan sedang", "heavy rain": "hujan lebat", thunderstorm: "badai petir", "thunder shower": "hujan petir", fog: "berkabut", haze: "berkabut asap", drizzle: "gerimis", "mixed precipitation": "hujan campur",
};

export function kondisiIndonesia(k: unknown): string | null {
  if (typeof k !== "string" || !k) return null;
  return KONDISI_ID[k.toLowerCase()] ?? k;
}

export async function cuacaRumah(penggunaId: string, rumahId?: string | null): Promise<Cuaca> {
  const struktur = await bacaStruktur(penggunaId);
  const rumah = (rumahId ? struktur?.rumah.find((r) => r.id === rumahId) : null) ?? struktur?.rumah.find((r) => r.lat && r.lon);
  if (!rumah?.lat || !rumah.lon) throw new GalatLayanan("tidak_didukung", "Lokasi rumah belum diatur di app Smart Life/Tuya (Pengaturan rumah > Lokasi), jadi cuaca belum bisa dibaca.");
  const d = await denganTuya(penggunaId, (k) => k.cuaca(rumah.lat!, rumah.lon!));
  const angka = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const perJam = Array.from({ length: 6 }, (_, i) => ({ jamKe: i + 1, suhu: angka(d[`w.temp.${i + 1}`]), kondisi: kondisiIndonesia(d[`w.condition.${i + 1}`]) })).filter((x) => x.suhu !== null);
  return { rumah: rumah.nama, suhu: angka(d["w.temp.0"]), terasa: angka(d["w.realFeel.0"]), kelembapan: angka(d["w.humidity.0"]), kondisi: kondisiIndonesia(d["w.condition.0"]), perJam };
}

export type SaluranNotifikasi = "app" | "email" | "sms" | "telepon";
const LABEL_SALURAN: Record<SaluranNotifikasi, string> = { app: "app Smart Life", email: "email akun Smart Life", sms: "SMS ke nomor akun Smart Life", telepon: "telepon suara ke nomor akun Smart Life" };

/** Kirim pesan ke pemilik sendiri lewat Tuya (Tuya hanya mengizinkan ke kontak akun itu sendiri). */
export async function kirimNotifikasi(penggunaId: string, judul: string, isi: string, sumber: Sumber, saluran: SaluranNotifikasi = "app"): Promise<void> {
  const j = judul.trim().slice(0, 50), t = isi.trim().slice(0, 300);
  if (!j || !t) throw new GalatLayanan("masukan", "Judul dan isi notifikasi wajib diisi.");
  await denganTuya(penggunaId, (k) =>
    saluran === "email"
      ? k.emailKeDiriSendiri(j, t)
      : saluran === "sms"
        ? k.smsKeDiriSendiri(`${j}: ${t}`.slice(0, 300))
        : saluran === "telepon"
          ? k.teleponKeDiriSendiri(`${j}. ${t}`.slice(0, 300))
          : k.pushKeDiriSendiri(j, t),
  );
  await catatAktivitas(penggunaId, { sumber, jenis: "lainnya", ringkasan: `Notifikasi ke ${LABEL_SALURAN[saluran]}: ${j}` });
}

export type HasilTangkapan = {
  perangkat: string;
  deviceId: string;
  jenis: "foto" | "video";
  /** Tautan sementara dari awan Tuya (beberapa menit). */
  gambar: string | null;
  video: string | null;
  /** Salinan 7 hari di app ini; null bila tidak bisa disalin (pakai tautan Tuya). */
  tersimpan: FotoTersimpan | null;
};

const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Foto/klip dari kamera Tuya (fitur Cloud Capture). Kamera mengunggah ke awan
 * Tuya lebih dulu, jadi tautan ditunggu sampai ~30 detik, lalu isinya disalin ke
 * penyimpanan 7 hari supaya bisa tampil di chat & notifikasi sesudah tautan Tuya mati.
 */
export async function tangkapKamera(
  penggunaId: string,
  rujukan: string,
  jenis: "foto" | "video",
  detik = 10,
  tunggu = jeda,
  sumber: Sumber = "agen",
  konteks: { otomasiId?: string; catatan?: string } = {},
): Promise<HasilTangkapan> {
  const p = await cariPerangkat(penggunaId, rujukan);
  if (p.jenis !== "kamera") throw new GalatLayanan("tidak_didukung", `"${p.nama}" bukan kamera.`);
  if (!p.online) throw new GalatLayanan("offline", `"${p.nama}" sedang offline.`);
  const tipe = jenis === "video" ? "VIDEO" : "PIC";
  const hasil = await denganTuya(penggunaId, async (k) => {
    const slot = await k.tangkapKamera(p.id, tipe, detik);
    await tunggu(jenis === "video" ? Math.min(detik, 60) * 1000 + 2000 : 2000);
    for (let i = 0; i < 15; i++) {
      const r = await k.ambilTangkapan(p.id, tipe, slot);
      if (r && (jenis === "video" ? r.video : r.gambar)) return r;
      await tunggu(2000);
    }
    return null;
  });
  if (!hasil) throw new GalatLayanan("tuya_gangguan", `"${p.nama}" belum selesai mengunggah. Coba lagi sebentar lagi (kamera butuh layanan penyimpanan awan Tuya aktif).`);
  const dari = jenis === "video" ? hasil.video : hasil.gambar;
  const tersimpan = dari
    ? await simpanTangkapan(penggunaId, { deviceId: p.id, perangkat: p.nama, jenis, dari, sumber, otomasiId: konteks.otomasiId, catatan: konteks.catatan }).catch((e) => {
        log.warn({ err: (e as Error)?.message }, "simpan foto kamera gagal");
        return null;
      })
    : null;
  await catatAktivitas(penggunaId, { sumber, jenis: "lainnya", deviceId: p.id, ringkasan: `${jenis === "video" ? "Klip" : "Foto"} dari ${p.nama}` });
  return { perangkat: p.nama, deviceId: p.id, jenis, ...hasil, tersimpan };
}

/** Foto kamera untuk layar app: tautan salinan 7 hari (jalur sendiri, lolos CSP 'self'). */
export async function fotoKameraUntukLayar(penggunaId: string, deviceId: string): Promise<{ gambar: string; tautan: string; kedaluwarsa: string | null }> {
  const h = await tangkapKamera(penggunaId, deviceId, "foto", 10, jeda, "web");
  if (!h.gambar) throw new GalatLayanan("tuya_gangguan", "Kamera tidak mengirim foto.");
  if (!h.tersimpan) return { gambar: "", tautan: h.gambar, kedaluwarsa: null };
  return { gambar: h.tersimpan.jalur, tautan: h.tersimpan.jalur, kedaluwarsa: h.tersimpan.kedaluwarsa.toISOString() };
}
