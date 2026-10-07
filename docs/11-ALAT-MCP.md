# Alat MCP: semua bisa lewat chat

Aturan: **setiap aksi di web punya alat MCP**, kecuali yang tercantum di §3 dengan alasannya.
Pola template: `alat({nama, judul, kelas, merusak?, idempoten?, deskripsi, masukan: z.strictObject, jalankan})`,
nama alat dan isian masukan bahasa Inggris snake_case (`src/lib/mcp/peta.ts` menerjemahkan ke isian
internal), teks jawaban bahasa pengguna (kamus `mcp`), `error_code` terstruktur. Kode: `src/lib/mcp/alat/*`.

- Alat yang merusak (`delete_*`, `remove_*`, `disconnect_home`) wajib `confirm: true`.
- Alat yang membuat sesuatu (`create_alarm`, `duplicate_alarm`, `test_alarm`, `create_template`,
  `save_alarm_as_template`, `create_wake_code`) menerima `client_ref` opsional: panggilan ulang dengan
  rujukan yang sama mengembalikan hasil pertama (`replayed: true`), tidak membuat dobel. Disimpan 30
  hari di `idempotensi_mcp`; panggilan yang gagal melepas rujukannya.

## 1. Penjaga paritas

`src/lib/mcp/paritas.ts` berisi daftar semua aksi web (id aksi → nama alat, atau pengecualian +
alasan). Guard `jaga` gagal bila:

- ada rute `/api/app/*` yang mengubah data tapi tidak terdaftar di daftar paritas;
- ada aksi yang menunjuk alat yang tidak ada;
- ada alat yang namanya atau deskripsinya memuat kemampuan mematikan, menunda, atau menjawab
  alarm berbunyi.

## 2. Daftar alat

| Kelompok | Alat | Catatan |
|---|---|---|
| Ringkasan | `get_setup_status` | Perangkat siaga, izin AgentBuff, kanal, rumah, suara, masalah + tautan perbaikan |
| Alarm | `list_alarms`, `get_alarm`, `get_next_alarm` | |
| | `create_alarm` | Semua isian PRD B2 dalam satu panggilan; isian kosong = bawaan pengguna |
| | `update_alarm` | Sebagian isian; ditolak `commitment_locked` bila melanggar Komitmen |
| | `delete_alarm`, `set_alarm_enabled` | Tunduk pada Komitmen |
| | `skip_next_alarm`, `skip_alarm_date`, `unskip_alarm` | Tunduk pada Komitmen |
| | `duplicate_alarm`, `test_alarm` | Uji = bunyi 1 menit lagi di perangkat siaga |
| | `set_custom_lines` | Kalimat omelan pribadi per alarm (lewat penyaring) |
| Template | `list_templates`, `create_template`, `update_template`, `delete_template`, `save_alarm_as_template` | `create_alarm` menerima `template` |
| Suara | `list_characters` | Termasuk contoh kalimat |
| | `list_voices`, `preview_voice` | Contoh dengar sebagai tautan audio |
| | `get_voice_status`, `regenerate_voice` | |
| Kode QR | `create_wake_code` | Mengembalikan tautan halaman cetak |
| | `list_wake_codes`, `rename_wake_code`, `delete_wake_code` | |
| Kanal | `list_channels`, `test_channel`, `test_notification` | Kanal dari AgentBuff; bawaan lewat `update_preferences` |
| Perangkat siaga | `list_standby_devices`, `get_device_setup_links` | Tautan unduh PC, Jam Meja, sambung |
| | `rename_standby_device`, `remove_standby_device` | |
| Rumah pintar | `get_home_status`, `connect_home`, `disconnect_home` | `connect_home` menerima kunci `sk-` (pola template) |
| | `list_home_devices` (`refresh`), `test_home_device`, `set_home_emergency` | Aturan perangkat diatur lewat `create_alarm`/`update_alarm` |
| Riwayat | `get_history`, `get_wake_stats`, `get_event_detail`, `export_history` | Ekspor = tautan unduh CSV tersegel, berlaku 15 menit (`/unduh/riwayat`) |
| Pengaturan | `get_preferences`, `update_preferences` | Nama panggilan, zona, bahasa, jam tidur, bawaan, pengingat malam |
| Alarm aktif | `get_active_alarm` | **Hanya status** + tautan layar alarm |

## 3. Pengecualian yang disengaja

| Aksi web | Alasan tidak ada alatnya | Jawaban agen |
|---|---|---|
| Jawab soal, matikan alarm berbunyi | Inti anti kesiangan; mencegah mematikan dari kasur lewat chat | Kirim tautan layar alarm |
| Tunda alarm berbunyi | Sama | Kirim tautan layar alarm |
| Konfirmasi "Masih bangun?" | Sama | Kirim tautan |
| Hapus semua data | Tidak bisa dibatalkan; wajib ketik konfirmasi di web | Kirim tautan Pengaturan |
| Buat atau cabut token agen | Keputusan pemilik di halaman Agen | Kirim tautan halaman Agen |
| Keluar | Sesi peramban itu sendiri | Tidak perlu |
| Pasang aplikasi PC, mulai Jam Meja, izinkan notifikasi, pindai QR | Harus dilakukan di perangkat itu | `get_device_setup_links` |
| Beri izin kanal/suara AgentBuff | Layar persetujuan AgentBuff milik pengguna | Kirim tautan "Beri izin" |

## 4. Kode galat

`access_frozen` (hak tidak aktif), `commitment_locked` (dengan jam buka), `validation`,
`not_found`, `rate_limited`, `permission_needed` (izin AgentBuff belum diberi),
`device_required` (aksi harus di perangkat; disertai tautan), `alarm_ringing` (alarm sedang
berbunyi: ubah, hapus, matikan, lewati ditolak; agen mengirim tautan layar alarm, K-37),
`in_progress` (panggilan dengan `client_ref` sama masih berjalan), plus kode rumah pintar
(`not_connected`, `key_problem`, `invalid_key`, `device_offline`, `not_supported`). Tambahan galat
memakai nama Inggris: `locked_until`, `reason` (`delete`, `turn_off`, `skip`, `later_time`,
`commitment_off`, `weaker`, `bedtime`), `retry_after_seconds`.

## 5. `skill/SKILL.md` pendamping (isi wajib, sudah ditulis di P12)

- Kata kunci: bangunin, alarm, bangun, jam weker, pengingat penting, agenda, jam meja, omelin.
- Membuat alarm dari satu kalimat; isian yang tidak disebut pakai bawaan; selalu sebut ulang jam
  + tanggal + zona dalam jawaban.
- Bila pengguna menyebut agenda, isi `agenda_title`/`agenda_detail`.
- Saat diminta "matikan alarm" atau "jawab soalnya": tolak dengan ramah, kirim tautan layar alarm.
- Jelaskan Mode Komitmen bila `commitment_locked`.
- Boleh menulis kalimat omelan pribadi galak sesuai permintaan, dalam batas penyaring.
- Bila `get_setup_status` menunjukkan tidak ada perangkat siaga malam ini, ingatkan pengguna.
- Jangan pernah mengaku alarm sudah dimatikan.
