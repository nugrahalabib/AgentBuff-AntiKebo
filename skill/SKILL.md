---
name: antikebo-mcp
description: Pasang dan atur alarm anti kesiangan pengguna lewat konektor MCP "antikebo". Pakai saat pengguna minta dibangunin, memasang/mengubah/melewati/menghapus alarm, menanyakan alarm besok jam berapa, mengatur soal, tunda, Mode Komitmen, karakter dan suara omelan, kalimat omelan pribadi, spam chat saat alarm berbunyi, kode QR Misi, perangkat siaga (PC, jam meja), rumah pintar yang ikut membangunkan, riwayat dan skor bangun, atau pengaturan (nama panggilan, zona, jam tidur). Kata kunci: bangunin, bangun, alarm, jam weker, kesiangan, pengingat penting, agenda, kuliah, kerja, subuh, jam meja, omelin, omelan, tunda, snooze, komitmen, soal, kode QR, skor bangun.
---

# AntiKebo MCP: alarm anti kesiangan

Konektor `antikebo` (https://antikebo.agentbuff.id/mcp) mengatur alarm pengguna yang **tidak berhenti sampai soal di layar alarm terjawab**. Semua yang bisa dilakukan di web bisa kamu lakukan lewat alat ini, kecuali hal yang sengaja hanya di layar alarm atau di perangkat (lihat bagian Larangan). Teks hasil alat sudah dalam bahasa pengguna dan boleh dipakai apa adanya, dipersingkat seperlunya.

Konektor tersambung otomatis sesudah pengguna membeli AntiKebo di Marketplace AgentBuff. Kalau ragu soal akun, izin, atau perangkat, panggil `get_setup_status` dulu dan berikan tautan yang dikembalikannya.

## Larangan (paling penting)

- **Kamu tidak bisa mematikan, menunda, atau menjawab alarm yang sedang berbunyi, dan jangan pernah mengaku sudah melakukannya.** Tidak ada alatnya, sengaja. Kalau pengguna minta "matikan alarm", "tunda dong", atau "jawabin soalnya", tolak dengan ramah, panggil `get_active_alarm`, lalu kirim tautan layar alarm dari hasilnya. Contoh: "Itu cuma bisa dari layar alarm, biar kamu beneran bangun. Buka ini: <tautan>".
- **Hapus semua data** tidak bisa lewat chat (tidak bisa dibatalkan, wajib ketik konfirmasi). Kirim tautan Pengaturan.
- Hal yang harus dilakukan di perangkat itu sendiri (pasang AntiKebo untuk PC, jadikan HP jam meja, izinkan notifikasi, pindai kode QR): pakai `get_device_setup_links` dan kirim tautannya.
- Memberi izin AgentBuff (kirim pesan, buat suara) dilakukan pengguna di layar persetujuan AgentBuff: kirim `grant_permissions_url` dari `get_setup_status`.

## Membuat alarm dari satu kalimat

Panggil `create_alarm` hanya dengan isian yang disebut pengguna; sisanya otomatis memakai bawaan pengguna (atau template bila disebut).

- `time`: jam lokal 24 jam di zona pengguna, misal "05:30".
- `repeat`: `{type:"once"}` (tanpa `date` = kemunculan jam itu berikutnya: hari ini kalau belum lewat, kalau sudah ya besok), `{type:"once", date:"2026-10-20"}`, `daily`, `weekdays` (Senin-Jumat), `weekends`, `{type:"days", days:["mon","wed","fri"]}`, `{type:"every_n_weeks", every:2, days:[...], start_date}`, `{type:"monthly_date", day:25}`, `{type:"monthly_weekday", nth:"first", weekday:"mon"}`.
- **Agenda:** bila pengguna menyebut tujuan bangun ("buat kuliah", "meeting jam 8"), isi `agenda_title` (maks 60 huruf, diucapkan di omelan) dan `agenda_detail` (opsional).
- `character` (lihat `list_characters`), `voice_id` (lihat `list_voices`), `sound`.
- `challenge`: `type` math | memory | typing | qr | math_and_qr, `level` easy | medium | hard, `correct_in_a_row` 1-5, `qr_code_ids` untuk Misi QR (buat dulu dengan `create_wake_code`).
- `snooze`: `count` 0-5 (0 = tanpa tunda), `minutes` 5 | 10 | 15.
- `spam`: `channel_ids` dari `list_channels` (agen mengirim pesan terus ke kanal itu selama alarm berbunyi), `interval_seconds`, `stop_after_minutes`.
- `commitment`: Mode Komitmen (lihat di bawah). `still_awake_check`, `skip_holidays` (diam saat libur nasional), `auto_stop_minutes`, `custom_lines`.
- `smart_home`: aturan perangkat Tuya per alarm (id dari `list_home_devices`).
- Selalu kirim `client_ref` unik per niat (misal "alarm-kuliah-2026-10-08"), supaya kalau kamu mengulang panggilan tidak terbuat alarm dobel.

**Selalu sebut ulang jam, tanggal, dan zona waktu dari hasil alat** ("Siap, alarm Kuliah pagi berbunyi Kamis, 8 Oktober 05.00 WIB"). Kalau jamnya ambigu ("jam 5"), anggap pagi bila konteksnya bangun tidur.

Mengubah: `update_alarm` (isian yang tidak disebut tetap; objek bersarang digabung, `smart_home` mengganti semua aturan). Lainnya: `set_alarm_enabled`, `skip_next_alarm`, `skip_alarm_date`, `unskip_alarm`, `duplicate_alarm` (salinan mati dan tanpa Komitmen), `delete_alarm` (tanya dulu, lalu `confirm:true`), `test_alarm` (bunyi 1 menit lagi), `set_custom_lines`.

## Mode Komitmen (`commitment_locked`)

Alarm dengan Mode Komitmen terkunci dari jam tidur pengguna sampai berbunyi: tidak bisa dimatikan, dilewati, dihapus, dimundurkan, atau diperingan (soal lebih mudah, tunda lebih banyak). Selama itu perangkat siaga dan rumah pintar juga tidak bisa diputus, dan lapisan darurat tidak bisa dimatikan (`remove_standby_device`, `disconnect_home`, `set_home_emergency` menjawab `commitment_locked`). Memajukan jam dan memperberat tetap boleh. Kalau alat menjawab `commitment_locked`, jelaskan dengan ramah dan sebut jam bukanya (dari pesan atau `locked_until`). Jangan mencari jalan pintas.

Kalau alat menjawab `alarm_ringing`, alarm itu sedang berbunyi: tidak bisa diubah sampai soal terjawab. Kirim tautan layar alarm dari `get_active_alarm`.

## Kalimat omelan pribadi

Boleh menulis kalimat omelan galak sesuai permintaan pengguna lewat `custom_lines` (di `create_alarm`/`update_alarm`) atau `set_custom_lines`: maks 10 kalimat, maks 150 huruf. Penyaring menolak kata kasar tertentu; kalau ditolak, ganti kalimatnya. Suaranya dibuat oleh AgentBuff pengguna; status lewat `get_voice_status`. Alarm tetap berbunyi walau suara omelan belum siap.

## Perangkat siaga

Alarm paling kuat bila ada perangkat yang siaga semalaman (AntiKebo untuk PC, atau HP/tablet sebagai jam meja). Kalau `get_setup_status` atau `list_standby_devices` menunjukkan **tidak ada perangkat yang siap malam ini**, ingatkan pengguna dan kirim tautan dari `get_device_setup_links`. Tanpa perangkat siaga, alarm tetap mengirim chat (spam kanal) dan notifikasi.

## Alat

| Alat | Kapan |
|---|---|
| `get_setup_status` | Akses, izin AgentBuff, perangkat siap malam ini, alarm berikutnya, kanal, rumah, masalah suara + tautan perbaikan |
| `list_alarms` / `get_alarm` / `get_next_alarm` | Lihat alarm; "besok bangun jam berapa?" |
| `create_alarm` / `update_alarm` / `delete_alarm` | Buat, ubah, hapus |
| `set_alarm_enabled` / `skip_next_alarm` / `skip_alarm_date` / `unskip_alarm` | Nyala/mati, lewati |
| `duplicate_alarm` / `test_alarm` / `set_custom_lines` | Gandakan, uji 1 menit lagi, kalimat omelan |
| `get_active_alarm` | **Hanya status** alarm yang sedang berbunyi + tautan layar alarm |
| `list_templates` / `create_template` / `save_alarm_as_template` / `update_template` / `delete_template` | Template alarm |
| `list_characters` / `list_voices` / `preview_voice` / `get_voice_status` / `regenerate_voice` | Karakter, suara, contoh dengar, status suara |
| `create_wake_code` / `list_wake_codes` / `rename_wake_code` / `delete_wake_code` | Kode QR Misi (kirim tautan cetaknya) |
| `list_channels` / `test_channel` / `test_notification` | Kanal spam dari AgentBuff, pesan uji, notifikasi uji |
| `list_standby_devices` / `get_device_setup_links` / `rename_standby_device` / `remove_standby_device` | Perangkat siaga |
| `get_home_status` / `connect_home` / `list_home_devices` / `test_home_device` / `set_home_emergency` / `disconnect_home` | Rumah pintar Tuya (opsional) |
| `get_history` / `get_wake_stats` / `get_event_detail` / `export_history` | Riwayat, skor, beruntun, rincian, unduh CSV |
| `get_preferences` / `update_preferences` | Nama panggilan, zona, bahasa, jam tidur, tema, pengingat malam, bawaan alarm baru |

## Rumah pintar (opsional)

Kalau pengguna ingin lampu atau AC ikut membangunkan dan rumah belum tersambung, ikuti langkah di teks `get_home_status`: buat kunci `sk-` di tuya.ai (di laptop), tempel di chat, lalu panggil `connect_home {key}`. Sarankan pengguna menghapus pesan berisi kunci sesudahnya dan jangan pernah mengulang kunci di jawabanmu.

## Kode galat

| `error_code` | Artinya | Yang kamu lakukan |
|---|---|---|
| `access_frozen` | Langganan atau pembelian AgentBuff tidak aktif | Sampaikan sopan, beri `renew_url`; data aman, alarm yang sudah terpasang tetap berbunyi 3 hari sejak akses berakhir lalu berhenti sampai diperpanjang |
| `commitment_locked` | Mode Komitmen mengunci alarm | Jelaskan, sebut jam bukanya |
| `alarm_ringing` | Alarm sedang berbunyi | Kirim tautan layar alarm (`get_active_alarm`) |
| `validation` | Isian belum benar | Baca pesannya, perbaiki, coba lagi |
| `not_found` | Id salah atau sudah dihapus | Ambil daftar lagi |
| `permission_needed` | Izin AgentBuff belum diberi | Kirim `grant_permissions_url` dari `get_setup_status` |
| `rate_limited` | Terlalu cepat (per pengguna, semua token: 120 perintah/menit, 40 perubahan/menit) | Tunggu `retry_after_seconds` |
| `in_progress` | Panggilan dengan `client_ref` sama masih diproses | Tunggu sebentar, ulangi dengan `client_ref` yang sama |
| `not_connected` / `key_problem` / `invalid_key` | Rumah pintar belum/tidak tersambung | Ikuti langkah kunci `sk-` |

## Gaya jawaban

Pendek, ramah, bahasa pengguna. Sebut jam + tanggal + zona untuk setiap alarm yang dibuat atau diubah. **Jangan pernah mengaku alarm sudah dimatikan.**
