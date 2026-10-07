import type { KanalTampil, KejadianRiwayat, RingkasAlarm, RingkasPerangkat } from "@/lib/tampilan/jenis";

// Data contoh untuk galeri /prototipe (P1). Isi buatan pengguna (judul agenda, nama perangkat)
// sengaja berbahasa Indonesia seperti yang akan diketik pengguna; teks UI tetap lewat kamus.

export const NAMA = "Nugi";

export const ALARM_BERIKUTNYA: RingkasAlarm = {
  id: "a1",
  jam: "05.00",
  judul: "Presentasi klien",
  detail: "Jam 9 di kantor klien, bawa laptop dan charger.",
  uraianUlang: "Sekali, besok",
  aktif: true,
  karakter: "pelatih_tentara",
  jumlahKanal: 2,
  tuya: true,
  terkunciSampai: "05.00",
  suara: { status: "siap" },
};

export const ALARM_LAIN: RingkasAlarm[] = [
  {
    id: "a2",
    jam: "06.30",
    judul: "Kuliah pagi",
    uraianUlang: "Sen-Jum",
    aktif: true,
    karakter: "ibu_galak",
    jumlahKanal: 1,
    tuya: false,
    suara: { status: "dibuat", n: 7, total: 12 },
  },
  { id: "a3", jam: "13.00", judul: "Ingat ada kelas", uraianUlang: "Rabu", aktif: true, karakter: "teman_nyolot", jumlahKanal: 0, tuya: false, suara: { status: "belum" } },
  { id: "a4", jam: "04.15", judul: "Sholat Subuh", uraianUlang: "Setiap hari", aktif: false, karakter: "pacar_bawel", jumlahKanal: 1, tuya: true, suara: { status: "siap" } },
];

export const SISA_KE_BERIKUTNYA = { jam: 6, menit: 12 };

export const PERANGKAT: RingkasPerangkat[] = [
  { id: "p1", jenis: "pc", nama: "PC Kamar", siapMalamIni: true, terakhirTerlihat: "baru saja", dicas: true },
  { id: "p2", jenis: "web", nama: "iPhone Nugi", siapMalamIni: false, terakhirTerlihat: "3 jam lalu" },
];

export const KANAL: KanalTampil[] = [
  { id: "k1", platform: "telegram", label: "Telegram · bot Buff", siap: true, dipilih: true },
  { id: "k2", platform: "whatsapp", label: "WhatsApp · Rani", siap: false, alasan: "Belum pernah ada chat masuk dari kamu", dipilih: false },
  { id: "k3", platform: "discord", label: "Discord · Buff", siap: true, dipilih: true },
];

export const SOAL_CONTOH = { teks: "7 × 8 + 13", jawaban: "69" };

export const OMELAN_CONTOH = "BANGUN, Nugi! Ini bukan hari libur! Presentasi jam sembilan, kasurnya nggak ke mana-mana!";

export const TEMPAT_QR = "di kamar mandi";

export const PAGI = { jamBangun: "05.07", skor: 86, tunda: 1, menit: 7, cekMenit: 5 };

/** Skor 30 hari terakhir (lama ke baru); null = tidak ada alarm hari itu. */
export const SKOR_30: Array<number | null> = [72, 80, null, 64, 90, 100, 88, 76, null, 92, 85, 70, 95, 100, 60, 82, null, 91, 87, 78, 100, 94, 66, 89, 93, null, 84, 97, 100, 86];

export const RIWAYAT: KejadianRiwayat[] = [
  { id: "e1", tanggal: "Hari ini", jam: "05.00", judul: "Presentasi klien", status: "bangun", skor: 86, tunda: 1, menitSampaiBangun: 7, pesanKanal: 9 },
  { id: "e2", tanggal: "Kemarin", jam: "06.30", judul: "Kuliah pagi", status: "bangun", skor: 100, tunda: 0, menitSampaiBangun: 1, pesanKanal: 2 },
  { id: "e3", tanggal: "Senin", jam: "06.30", judul: "Kuliah pagi", status: "tidak_bangun", skor: 0, tunda: 2, menitSampaiBangun: 60, pesanKanal: 48 },
  { id: "e4", tanggal: "Minggu", jam: "04.15", judul: "Sholat Subuh", status: "terlewat", skor: null, tunda: 0, menitSampaiBangun: 0, pesanKanal: 0 },
];

export const PC = { versi: "1.0.0", ukuranMb: 9, sha256: "3f8c6c1e0b5a9d2e7f4a1c8b6d0e9f2a5c7b3e1d4f6a8c0e2b4d6f8a0c2e4f61" };
