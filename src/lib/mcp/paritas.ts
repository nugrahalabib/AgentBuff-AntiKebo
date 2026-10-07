/**
 * Paritas web dan MCP (docs/11-ALAT-MCP.md §1, CLAUDE.md §5.10): SETIAP aksi web yang mengubah
 * data (`POST`/`PATCH`/`PUT`/`DELETE` di `/api/app/*`, `/api/kejadian/*`, `/api/keluar`) tercatat
 * di sini dengan alat MCP-nya, atau sebagai pengecualian beserta alasannya. Penjaga `paritas` di
 * `scripts/jaga.mjs` membaca berkas ini sebagai TEKS: tulis tiap entri satu baris dengan bentuk
 * yang sama. Penjaga gagal bila ada rute tanpa entri, entri tanpa rute, alat yang tidak ada, atau
 * alat yang mengaku bisa mematikan, menunda, atau menjawab alarm berbunyi.
 *
 * Rute protokol perangkat (`/api/perangkat/*`, token PC/Jam Meja) dan server AgentBuff
 * (`/api/agentbuff/*`) bukan aksi pengguna di web, jadi di luar daftar ini.
 */

export type AksiWeb = { rute: string; metode: "POST" | "PATCH" | "PUT" | "DELETE" } & ({ alat: readonly string[] } | { pengecualian: string });

// prettier-ignore
export const PARITAS: readonly AksiWeb[] = [
  { rute: "/api/app/alarm", metode: "POST", alat: ["create_alarm"] },
  { rute: "/api/app/alarm/[id]", metode: "PATCH", alat: ["update_alarm", "set_custom_lines"] },
  { rute: "/api/app/alarm/[id]", metode: "DELETE", alat: ["delete_alarm"] },
  { rute: "/api/app/alarm/[id]/aktif", metode: "POST", alat: ["set_alarm_enabled"] },
  { rute: "/api/app/alarm/[id]/gandakan", metode: "POST", alat: ["duplicate_alarm"] },
  { rute: "/api/app/alarm/[id]/lewati", metode: "POST", alat: ["skip_next_alarm", "skip_alarm_date"] },
  { rute: "/api/app/alarm/[id]/lewati", metode: "DELETE", alat: ["unskip_alarm"] },
  { rute: "/api/app/alarm/[id]/template", metode: "POST", alat: ["save_alarm_as_template"] },
  { rute: "/api/app/template", metode: "POST", alat: ["create_template"] },
  { rute: "/api/app/template/[id]", metode: "PATCH", alat: ["update_template"] },
  { rute: "/api/app/template/[id]", metode: "DELETE", alat: ["delete_template"] },
  { rute: "/api/app/uji", metode: "POST", alat: ["test_alarm"] },
  { rute: "/api/app/kode-qr", metode: "POST", alat: ["create_wake_code"] },
  { rute: "/api/app/kode-qr/[id]", metode: "PATCH", alat: ["rename_wake_code"] },
  { rute: "/api/app/kode-qr/[id]", metode: "DELETE", alat: ["delete_wake_code"] },
  { rute: "/api/app/suara/contoh", metode: "POST", alat: ["preview_voice"] },
  { rute: "/api/app/kanal/uji", metode: "POST", alat: ["test_channel"] },
  { rute: "/api/app/push/uji", metode: "POST", alat: ["test_notification"] },
  { rute: "/api/app/preferensi", metode: "PATCH", alat: ["update_preferences"] },
  { rute: "/api/app/perangkat/[id]", metode: "PATCH", alat: ["rename_standby_device"] },
  { rute: "/api/app/perangkat/[id]", metode: "DELETE", alat: ["remove_standby_device"] },
  { rute: "/api/app/rumah/kunci", metode: "POST", alat: ["connect_home"] },
  { rute: "/api/app/rumah/kunci", metode: "DELETE", alat: ["disconnect_home"] },
  { rute: "/api/app/rumah/perangkat", metode: "POST", alat: ["list_home_devices"] },
  { rute: "/api/app/rumah/perangkat/[id]/uji", metode: "POST", alat: ["test_home_device"] },
  { rute: "/api/app/rumah/darurat", metode: "PATCH", alat: ["set_home_emergency"] },
  { rute: "/api/app/hapus-data", metode: "POST", pengecualian: "Tidak bisa dibatalkan; wajib ketik konfirmasi di web. Agen mengirim tautan Pengaturan." },
  { rute: "/api/app/perangkat", metode: "POST", pengecualian: "Mulai Jam Meja harus di perangkat itu sendiri. Agen memakai get_device_setup_links." },
  { rute: "/api/app/perangkat/sambung", metode: "POST", pengecualian: "Menyetujui kode sambung PC dilakukan di peramban yang dibuka aplikasi PC. Agen memakai get_device_setup_links." },
  { rute: "/api/app/push", metode: "POST", pengecualian: "Izin dan langganan notifikasi milik peramban itu sendiri. Agen memakai get_device_setup_links." },
  { rute: "/api/app/push", metode: "DELETE", pengecualian: "Langganan notifikasi milik peramban itu sendiri (dilepas di peramban itu)." },
  { rute: "/api/kejadian/[id]/jawab", metode: "POST", pengecualian: "Inti anti kesiangan: soal hanya dijawab di layar alarm. Agen memakai get_active_alarm untuk tautannya." },
  { rute: "/api/kejadian/[id]/ganti-soal", metode: "POST", pengecualian: "Bagian dari menjawab soal di layar alarm. Agen memakai get_active_alarm untuk tautannya." },
  { rute: "/api/kejadian/[id]/masih-bangun", metode: "POST", pengecualian: "Konfirmasi \"Masih bangun?\" hanya di layar alarm. Agen memakai get_active_alarm untuk tautannya." },
  { rute: "/api/app/token", metode: "POST", pengecualian: "Token manual untuk klien MCP lain dibuat pemilik di halaman Agen; agen yang sudah tersambung tidak menerbitkan token." },
  { rute: "/api/app/token/[id]", metode: "DELETE", pengecualian: "Mencabut akses agen adalah keputusan pemilik di halaman Agen; agen tidak mencabut token." },
  { rute: "/api/keluar", metode: "POST", pengecualian: "Keluar dari sesi peramban itu sendiri; token agen dicabut di halaman Agen." },
];
