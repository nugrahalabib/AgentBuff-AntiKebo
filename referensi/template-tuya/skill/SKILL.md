---
name: tuya-mcp
description: Kendalikan rumah pintar pengguna (perangkat Smart Life / Tuya) lewat konektor MCP "tuya". Pakai saat pengguna minta menyalakan/mematikan lampu, AC, colokan, saklar, kipas, tirai, pemanas; mengatur kecerahan, warna lampu, suhu & mode AC, kecepatan kipas; menanyakan perangkat apa yang menyala/offline; menyimpan atau mengaktifkan suasana (scene); membuat jadwal/timer; membuat otomasi "kalau pintu terbuka/ada gerakan/suhu naik maka ..."; minta foto dari kamera; cek pemakaian listrik; cuaca di rumah; mengirim notifikasi/email/SMS ke dirinya; atau menyambungkan rumah dengan kunci sk- dari tuya.ai. Kata kunci: lampu, AC, nyalakan, matikan, terang, redup, warna, suhu, dingin, mode, kipas, tirai, colokan, sensor, pintu, gerakan, kamera, CCTV, smart home, rumah pintar, Smart Life, Tuya, suasana, scene, jadwal, timer, otomasi, listrik, watt.
---

# Tuya MCP - Smart Home Connector

Konektor `tuya` (https://tuya.agentbuff.id/mcp) memberi kamu kendali penuh atas rumah Smart Life / Tuya milik pengguna. Semua perintah langsung dijalankan ke perangkat sungguhan. Sampaikan hasilnya dengan kalimat pendek dalam bahasa pengguna (teks hasil alat sudah berbahasa Indonesia, boleh dipakai apa adanya).

**Pengguna tidak perlu membuka website untuk apa pun.** Menyambungkan rumah, mengendalikan, suasana, jadwal, otomasi, kamera, semuanya bisa lewat chat ini. Website https://tuya.agentbuff.id hanya pilihan bagi yang suka layar.

## Menyambungkan rumah (sekali saja)

Konektor tersambung otomatis setelah pengguna membeli produk ini di Marketplace AgentBuff. Yang tersisa: kunci rumah dari Tuya. Kalau alat menjawab `not_connected` atau ragu, panggil `get_setup_status`, lalu pandu dengan kalimat sederhana:

1. Buka https://auth.tuya.ai/login?loginSource=web_hey_tuya **di laptop/komputer** (QR tidak bisa dipindai dari layar HP yang sama). Ini halaman masuk resmi Tuya, sama dengan tombol **Get API Key** di tuya.ai/developer.
2. Pilih **SmartLife APP** atau **Tuya APP** (sesuai app di HP). Pindai QR dari app: tab **Saya/Me**, ikon pindai di pojok kanan atas, lalu **Konfirmasi** di HP. Kalau akun app-nya dibuat dengan Google, boleh "masuk dengan Google" tanpa QR (akun yang SAMA, kalau beda rumahnya kosong).
3. Sesudah masuk, halaman **Hey Tuya** terbuka. Di menu kiri ketuk **Toolbox** lalu **API Key** (menu bisa perlu digulir; di jendela sempit ketuk ikon menu).
4. Buat kunci baru (tombol **Create** / **+**), nama bebas, misalnya AgentBuff.
5. Salin kunci yang diawali `sk-` (tombol salin) lalu **tempel di chat ini**.

Kalau pengguna tersesat sesudah memindai QR: suruh cari tulisan **Toolbox** di menu kiri Hey Tuya; kalau halaman lain yang terbuka, buka lagi tautan di langkah 1 (karena sudah masuk, langsung dibawa ke Hey Tuya). Halaman https://tuya.agentbuff.id/app/sambungkan juga berisi panduan bergambar.

Begitu pengguna menempelkan kunci `sk-...`, langsung panggil `connect_home {key}`. Server memeriksa kunci ke Tuya dulu, menyimpannya terenkripsi, lalu memuat semua perangkat. Sesudah berhasil, sarankan pengguna menghapus pesan berisi kunci dari chat (kunci itu bisa mengendalikan rumahnya). Jangan pernah mengulang kunci di jawabanmu.

### Kunci salah (`invalid_key`)

Tuya menolak kunci yang ditempel (salah salin, terpotong, atau bukan kunci dari tuya.ai). Minta pengguna menyalin ulang utuh dari tuya.ai (tombol salin), lalu `connect_home` lagi.

### Kunci bermasalah (`key_problem`)

Kunci dari tuya.ai bisa kedaluwarsa atau dihapus. Minta kunci baru (langkah yang sama: masuk, Toolbox > API Key, buat kunci baru), lalu `connect_home` lagi. Suasana, jadwal, dan otomasi tetap ada.

### Akses dibekukan (`access_frozen`)

Langganan/trial AgentBuff berakhir atau produk belum dimiliki. Sampaikan dengan sopan dan beri `renew_url` dari hasil alat. Data pengguna tetap aman.

## Alat

| Alat | Kapan dipakai |
|---|---|
| `get_setup_status` | Cek rumah sudah tersambung + langkah menyambungkan |
| `connect_home` | Pengguna menempel kunci `sk-...` di chat |
| `get_home_overview` | "Apa saja yang masih nyala?", ringkasan rumah, perangkat offline |
| `list_devices` | Daftar perangkat, saring per `room`, `type`, `query`, `online_only` |
| `get_device` | Detail satu perangkat: keadaan, `controls` (pilihan mode, kipas, rentang suhu, mode lampu, timer) dan `settings` (pengaturan lain beserta pilihannya). `refresh: true` untuk keadaan langsung |
| `control_device` | Kendali SATU perangkat (bidang di bawah) |
| `control_devices` | Satu aksi ke banyak perangkat: per `room`, `type`, `device_ids`, atau `all: true` |
| `list_scenes` / `run_scene` | Daftar & aktifkan suasana |
| `save_scene` | Buat/ubah suasana: dari KONDISI SEKARANG, atau dari `actions` yang kamu susun dari kalimat pengguna (perangkat tidak digerakkan) |
| `delete_scene` | Hapus suasana (tanya dulu) |
| `create_schedule` | Timer (`in_minutes`), sekali (`at` ISO + zona), atau berulang (`time` "HH:MM" + `days` 0=Minggu..6=Sabtu) |
| `list_schedules` / `set_schedule_active` / `cancel_schedule` | Lihat, jeda/lanjutkan, hapus jadwal |
| `create_automation` | Otomasi "kalau ... maka ...", jalan sendiri saat perangkat/sensor berubah |
| `list_automations` / `set_automation_active` / `delete_automation` | Lihat, jeda/lanjutkan, hapus otomasi |
| `capture_camera` | Foto (atau klip 1-60 detik) dari kamera Tuya, disimpan 7 hari, plus baris markdown siap tampil |
| `list_camera_photos` | Foto/klip terbaru (7 hari): yang diminta lewat agen, diambil di app, atau diambil otomasi |
| `get_energy_usage` | Pemakaian listrik colokan/meteran per hari |
| `get_device_history` | Riwayat per jam yang dicatat Tuya untuk satu perangkat (listrik, suhu, dll.) pada satu tanggal |
| `get_weather` | Cuaca di lokasi rumah |
| `pair_ir_ac` | Pasangkan kode remote AC yang dikendalikan lewat pemancar IR (merek -> tes -> simpan) |
| `rename_device` | Ganti nama (ikut berubah di app Smart Life) |
| `set_device_preferences` | Selalu/tidak pernah minta konfirmasi sebelum menyala; sembunyikan perangkat |
| `notify_me` | Pesan ke pengguna sendiri: `channel` app (bawaan), email, sms, atau voice (telepon otomatis, maks 15/hari, hanya untuk hal darurat) |
| `get_activity` | Riwayat tindakan (pengguna, agen, jadwal, suasana, otomasi) |
| `refresh_devices` | Muat ulang dari Tuya setelah pengguna menambah/memindah perangkat di app |
| `disconnect_home` | Putuskan rumah & hapus kunci (hanya bila diminta jelas, `confirm: true`) |

### Bidang aksi (`control_device`, `control_devices`, `create_schedule`, aksi `save_scene` & `create_automation`)

- `power`: true nyala / false mati
- `channel`: saklar/stop kontak multi-lubang (1-8); kosong = semua saluran
- `brightness`: 1-100 (%). 0 = mematikan lampu
- `color`: nama warna Indonesia/Inggris ("merah", "biru", "ungu", "pink", "hijau", "kuning", "oranye", "tosca"), "putih", "hangat", "sejuk", atau hex "#ff8800"
- `white_temperature`: 0 paling hangat .. 100 paling sejuk
- `temperature`: suhu derajat (AC/pemanas). Server menolak di luar rentang perangkat
- `mode`: "dingin"/"cool", "panas"/"heat", "auto", "kipas"/"fan", "kering"/"dry"
- `fan_speed`: "auto", "pelan", "sedang", "kencang", atau angka
- `curtain`: "open" / "close" / "stop"; `position`: 0-100
- `light_mode`: mode lampu "putih"/"white", "warna"/"colour", "adegan"/"scene", "musik"/"music" (yang tercantum di `get_device.controls.light_mode`)
- `timer_minutes`: timer BAWAAN perangkat; perangkat berganti nyala/mati sendiri setelah N menit (0 = batalkan). Untuk jam tertentu atau berulang pakai `create_schedule`
- `properties`: pengaturan lain, `{kode: nilai}` persis seperti di `get_device.settings` (mis. `{swing:true}` untuk ayunan AC, `{relay_status:"memory"}` agar colokan kembali seperti sebelumnya saat listrik kembali, `{do_not_disturb:true}`). Nilai `value` dikirim MENTAH (lihat `raw_scale`)

**Semua yang bisa diatur perangkat bisa diatur dari sini.** Kalau pengguna minta sesuatu yang tidak ada di bidang di atas, panggil `get_device` dan cari di `settings`.

## Jujur soal hasil (WAJIB)

Hasil `control_device` selalu menyebut statusnya. Sampaikan apa adanya:
- `Berhasil, perangkat sudah melaporkan ...` = boleh bilang sudah.
- `BELUM TERKONFIRMASI` = server Tuya menerima perintah, tapi perangkat TIDAK melaporkan perubahan. **Jangan bilang sudah berhasil.** Katakan perintahnya belum sampai/ belum dijalankan perangkat, sarankan cek perangkat (listrik, Wi-Fi), lalu boleh coba sekali lagi atau cek dengan `get_device {refresh:true}`.
- `Sinyal remote IR sudah dipancarkan` = untuk AC lewat remote: katakan "perintah sudah dikirim ke AC", bukan "AC sudah 24 derajat". Kalau pengguna bilang AC tidak bereaksi, kodenya mungkin salah: tawarkan pasangkan ulang (`pair_ir_ac`).
- `control_devices` memisahkan yang berhasil dan yang TIDAK; sebutkan yang tidak.

### AC lewat remote inframerah (IR)

Banyak AC dikendalikan lewat pemancar remote IR (alat bertuliskan "Remote"). Di daftar, AC itu tampil sebagai `AC (lewat remote IR)`.
- **Tuya tidak memancarkan sinyal untuk aplikasi luar**, jadi kami yang memancarkannya dari pustaka kode remote. Karena itu AC remote harus **dipasangkan kodenya sekali** dulu. `get_device` menunjukkan `ir_code: null` bila belum; `control_device` lalu menjawab `ir_code_not_paired`.
- Memasangkan (`pair_ir_ac`), urutan yang paling mudah untuk pengguna:
  1. **Rekam dari remote** (`action:'learn'`): minta pengguna menyiapkan remote AC-nya dan mengarahkannya ke pemancar (5-15 cm). Katakan "saya mulai merekam, tekan tombol POWER di remote sekarang", lalu panggil. Merek dikenali dari sinyal remote-nya sendiri dan langsung tersimpan (saat ini Panasonic dikenali otomatis). Lalu `action:'test'` `test:'full'` dan tanya apakah layar AC menunjukkan 27, kipas kencang, DAN bilahnya bergerak.
  2. Bila tidak dikenali / tidak tertangkap: tanya merek -> `action:'codes'`. Untuk Panasonic, kode `pana:*` dibangun dari protokol (semua suhu, kipas, ayunan pasti ada): tes berurutan. Untuk tiap kode: `test:'on'` (AC dalam keadaan mati) -> tanya bereaksi? -> bila ya `test:'full'` -> tanya apakah SEMUA (suhu, kipas, ayunan) berubah -> hanya bila ya `action:'save'`. Bila sebagian saja, kode berikutnya.
  Jangan pernah menebak reaksi AC; pengguna harus berada dekat AC.
- Sesudah dipasangkan, atur seperti AC biasa (`power`, `temperature`, `mode`, `fan_speed`, `properties {swing}`). Suhu di luar batas remote disesuaikan ke yang terdekat (disebut di hasil).
- Keadaan asli AC tidak bisa dibaca balik: yang tampil adalah perintah terakhir.
- Kalau AC tidak bereaksi padahal sudah dipasangkan: pemancar harus menghadap AC tanpa terhalang; kalau tetap tidak, kodenya kurang cocok, pasangkan ulang.
- Perangkat "Remote" itu sendiri (pemancarnya) tidak dikendalikan. Remote baru ditambahkan lewat app Smart Life, lalu `refresh_devices`.

Gabungkan dalam SATU panggilan: "AC 24 derajat mode dingin" = `control_device {device:"AC", power:true, temperature:24, mode:"dingin"}`.

### Otomasi (`create_automation`)

`when.event`: `turned_on`, `turned_off`, `went_offline`, `came_online`, `door_opened`, `door_closed`, `motion_detected`, `smoke_detected`, `water_leak`, `gas_detected`, `temperature_above`/`temperature_below`, `humidity_above`/`humidity_below`, `power_above`, `battery_below` (enam terakhir butuh `when.value`), `property_equals` (butuh `when.property` + `when.equals`), `value_above` / `value_below` untuk bacaan angka APA PUN (butuh `when.property` dari `get_device.readings`/`settings` + `when.value` dalam satuan yang tampil, mis. CO2 ppm, PM2.5, tinggi air, cahaya).

`then`: 1-10 aksi, masing-masing TEPAT SATU dari: `device` + bidang aksi, `scene`, `notify_title` + `notify_message` (push ke app Smart Life pengguna), atau `camera_photo` (nama kamera: ambil foto saat kejadian, simpan 7 hari, kirim tautannya lewat `send_photo_to`: `app` bawaan, `email`, `sms`, atau `none` = hanya disimpan).

Opsional: `only_between {from:"18:00", to:"06:00"}` (jam lokal, boleh lewat tengah malam), `cooldown_minutes` (bawaan 5; 10 bila ada notifikasi).

Contoh:
- "Kalau pintu depan terbuka malam hari, nyalakan lampu teras dan kabari aku" = `{when:{device:"pintu depan", event:"door_opened"}, then:[{device:"lampu teras", power:true}, {notify_title:"Pintu depan", notify_message:"Pintu depan terbuka"}], only_between:{from:"18:00", to:"06:00"}}`
- "Kalau kamar di atas 29 derajat, nyalakan AC 25" = `{when:{device:"sensor kamar", event:"temperature_above", value:29}, then:[{device:"AC kamar", power:true, temperature:25, mode:"dingin"}]}`
- "Kalau pintu depan terbuka malam hari, foto CCTV teras dan kirim ke aku" = `{when:{device:"pintu depan", event:"door_opened"}, then:[{camera_photo:"CCTV teras"}], only_between:{from:"18:00", to:"06:00"}}`. Fotonya juga bisa kamu tunjukkan nanti lewat `list_camera_photos` (`from_automations_only: true`).
- "Kabari kalau CO2 kamar lewat 1000" = `{when:{device:"sensor CO2", event:"value_above", property:"co2_value", value:1000}, then:[{notify_title:"Udara", notify_message:"CO2 kamar di atas 1000 ppm, buka jendela"}]}`
- "Kabari kalau dispenser mati listrik" = `{when:{device:"dispenser", event:"went_offline"}, then:[{notify_title:"Dispenser", notify_message:"Dispenser offline"}]}`

Otomasi berjalan di server kami, tetap jalan walau HP/laptop pengguna mati. Ditembak sekali setiap kali kondisinya BERUBAH menjadi benar, lalu menunggu jeda.

## Aturan

1. **Nama perangkat apa adanya.** Kirim nama seperti diucapkan pengguna ("lampu meja", "AC kamar"). Server mencocokkan sendiri. Tidak perlu `list_devices` dulu untuk perintah biasa.
2. **`ambiguous`** = beberapa perangkat cocok. Tanyakan yang mana (sebutkan kandidat + ruangannya), jangan menebak.
3. **`needs_confirmation`** = perangkat yang berbahaya bila menyala tanpa diawasi (pemanas, kompor, ketel, pintu garasi, katup air, atau yang ditandai pengguna). Tanyakan dengan jelas, lalu ulangi dengan `confirm: true` HANYA setelah pengguna setuju. Berlaku juga untuk otomasi/jadwal yang menyalakannya. Mematikan selalu boleh.
4. **`device_offline`**: jangan diulang-ulang. Sarankan cek listrik & Wi-Fi perangkat.
5. **"Semua"**: "matikan semua lampu" = `control_devices {type:"light", power:false}`; "matikan semua di kamar" = `{room:"kamar", power:false}`; seluruh rumah = `{all:true, ...}` hanya bila pengguna jelas berkata semua.
6. **Jadwal**: pakai zona waktu pengguna (WIB bawaan). "Tiap hari kerja jam 6" = `time:"06:00", days:[1,2,3,4,5]`. Sebutkan kembali kapan jadwal berjalan dari teks hasil.
7. **Kamera**: `capture_camera` saat pengguna minta melihat/mengecek kameranya. Hasilnya disimpan 7 hari dan datang dengan baris markdown `![Foto ...](https://tuya.agentbuff.id/api/foto/....jpg)`: **salin baris itu PERSIS ke balasanmu** supaya fotonya tampil sebagai gambar di chat AgentBuff dan terkirim sebagai foto di Telegram (klip `.mp4` diputar di chat AgentBuff; di WhatsApp/Telegram cukup kirim tautannya). Untuk "ada orang tidak?", nilai fotonya dengan alat analisis gambar milikmu pada url itu. Foto lama (termasuk dari otomasi) ada di `list_camera_photos`. Kalau hasil berkata "tidak bisa disimpan", kirim tautan Tuya apa adanya dan bilang berlaku beberapa menit. Video langsung (live) tidak tersedia. Pengaturan kamera ada di `get_device.settings` dan diatur lewat `properties`: mode privasi `basic_private`, deteksi gerakan `motion_switch` + `motion_sensitivity`, penglihatan malam `basic_nightvision` ("0" otomatis, "1" mati, "2" nyala), rekam `record_switch`. Kamera yang bisa berputar punya `ptz_control`: "0" atas, "2" kanan, "4" bawah, "6" kiri (sudut "1","3","5","7"); kirim lalu `ptz_stop:true` untuk berhenti.
8. **Notifikasi**: `notify_me` hanya ke pengguna sendiri dan dibatasi Tuya per hari. Jangan dipakai berulang.
9. Jangan mengarang keadaan perangkat. Kalau ditanya, baca dengan `get_home_overview` / `get_device`.
10. **Jangan pernah bilang berhasil kalau hasil alat tidak berkata berhasil.** Lihat bagian "Jujur soal hasil".
11. **Perangkat jenis apa pun** (robot vakum, kunci, pakan hewan, pemurni udara, alarm, stasiun cuaca, dll.): `get_device` menampilkan SEMUA yang bisa dibaca (`readings`, sudah bersatuan dan bernama ramah) dan diatur (`settings` beserta `choices`). Atur lewat `properties` dengan kode & nilai PERSIS dari situ. Contoh robot vakum: mulai `{power_go:true}`, mode `{mode:"smart"}`, daya hisap `{suction:"strong"}`, pulang ke dok `{mode:"chargego"}`. Jangan mengarang kode yang tidak ada di `settings`.

## Yang memang tidak bisa lewat API Tuya

Arahkan ke app Smart Life untuk: **menambah/pairing perangkat baru** (sesudahnya panggil `refresh_devices`, perangkat langsung muncul), membuka **kunci pintu**, **video CCTV langsung**, update firmware, dan menambah/mengubah rumah atau ruangan. Selain itu, semua bisa dari chat.

## Alur siap pakai

- **Mau tidur**: `control_devices {all:true, power:false}` kecuali yang pengguna minta tetap nyala; atau `run_scene {scene:"Tidur"}` bila ada.
- **Buat suasana dari kalimat**: "suasana Nonton: lampu ruang tamu 20% hangat, AC 25" = `save_scene {name:"Nonton", actions:[{device:"lampu ruang tamu", power:true, brightness:20, color:"hangat"}, {device:"AC", power:true, temperature:25}]}`.
- **Timer**: "matikan kipas 30 menit lagi" = `create_schedule {in_minutes:30, device:"kipas", power:false}`.
- **Keamanan rumah**: tawarkan otomasi pintu/gerakan + notifikasi saat pengguna bepergian; `capture_camera` untuk cek teras.
- **Hemat listrik**: `get_home_overview` untuk melihat yang menyala, tawarkan mematikan yang tidak dipakai; `get_energy_usage` untuk colokan; otomasi `power_above` untuk peringatan.

## Rutinitas yang bisa ditawarkan

Pengguna bisa meminta rutinitas AgentBuff memanggil alat ini, misalnya setiap malam jam 22.00 "cek perangkat yang masih nyala dan kabari aku" (`get_home_overview` + pesan ke pengguna).
