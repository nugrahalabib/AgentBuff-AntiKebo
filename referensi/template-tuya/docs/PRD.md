# Tuya MCP - Smart Home Connector

Produk Marketplace AgentBuff. Rp29.000 sekali bayar. Alamat: https://tuya.agentbuff.id

Dokumen ini adalah rancangan produk + keputusan teknis. Ditulis 3 Oktober 2026
setelah riset (lihat bagian "Riset" di bawah).

---

## 1. Janji ke pengguna

> "Lampu, AC, colokan pintar, dan perangkat Smart Life/Tuya di rumahmu bisa kamu
> suruh lewat chat ke agen AgentBuff. Sambungkannya 3 menit, tanpa akun developer."

Contoh yang harus jalan sejak hari pertama:

- "Matikan semua lampu kamar"
- "Nyalakan AC studio 24 derajat mode dingin"
- "Lampu meja warna biru, terang 80%"
- "Simpan kondisi sekarang sebagai suasana Kerja" lalu besok "aktifkan suasana Kerja"
- "Matikan AC jam 11 malam tiap hari" / "matikan lampu teras 30 menit lagi"
- "Berapa listrik colokan dispenser hari ini?"
- "Perangkat apa saja yang masih nyala?"

Pengguna sasaran: orang awam, bukan developer. Punya HP dengan app **Smart Life**
atau **Tuya Smart** dan sudah memasang perangkatnya di sana.

---

## 2. Riset: kenapa jalur ini

### 2.1 Yang sudah ada di GitHub

| Proyek | Cara masuk ke Tuya | Kenapa tidak dipakai apa adanya |
|---|---|---|
| `juanmartinsantos/mcp-server-tuya` | Access ID/Secret IoT Core (akun developer) | Pengguna wajib bikin proyek cloud developer, perpanjang uji coba tiap 6 bulan |
| `ethanj2k/tuya-local-mcp` | Local key (tinytuya, jaringan rumah) | Harus jalan di jaringan rumah pengguna, tidak bisa dari server kita |
| `cabra-lat` Tuya Smart Home | tinytuya | sama |
| Skill lama Chief `smarthome-tuya` | Access ID/Secret IoT Core + tinytuya | sama dengan baris pertama |
| **`tuya/tuya-openclaw-skills` (RESMI, 2026)** | **Satu API Key end-user `sk-...` dari tuya.ai** | **Dipakai sebagai dasar** |

Semua MCP komunitas memakai server lokal per orang (stdio). Tidak ada satu pun
yang berupa layanan web multi-pengguna dengan login, apalagi login AgentBuff.
Jadi kita bangun sendiri, berdiri di atas API resmi end-user Tuya.

### 2.2 API end-user resmi Tuya (dasar produk)

- Pengguna buka https://tuya.ai/developer, tekan **Get API Key**, masuk dengan
  memindai QR memakai app **SmartLife** atau **Tuya**, lalu menyalin kunci `sk-...`.
  Tidak ada akun developer, tidak ada proyek cloud, tidak ada perpanjangan uji coba.
- Satu kunci = semua rumah, ruangan, dan perangkat milik akun app itu.
- Dua huruf sesudah `sk-` menentukan pusat data (AY Tiongkok, AZ AS Barat,
  EU, IN, UE, WE, SG Singapura). Kita pilih alamat otomatis, pengguna tidak
  pernah memilih wilayah.
- Kemampuan: rumah & ruangan, daftar & status perangkat, model perangkat
  (properti, tipe, rentang), kirim perintah properti, ganti nama, cuaca,
  notifikasi ke diri sendiri (push/SMS/telepon/email), statistik per jam
  (listrik), tangkapan kamera, aliran peristiwa WebSocket (perubahan status,
  online/offline).
- Tidak didukung oleh Tuya (dan memang tidak kita janjikan): kunci pintu,
  video langsung, pairing perangkat baru, OTA, tipe raw/bitmap/struct/array.
- Catatan Tuya: semua endpoint masih fase uji coba dengan batas laju; kunci bisa
  kedaluwarsa (kode 1010). Produk wajib menangani dua hal ini dengan jujur.
- Aturan Tuya: WebSocket hanya boleh dari server (kunci tidak boleh sampai
  peramban). Kunci kita simpan terenkripsi di server, tidak pernah dikirim balik.

### 2.3 Jalur yang ditolak

- **QR login ala Home Assistant** (`tuya-device-sharing-sdk`): UX bagus, tetapi
  memakai client ID milik Home Assistant (`HA_3y9q4ak7g4ephrvke`) dan endpoint
  `/m/life/ha/...`. Menjual produk berbayar di atas registrasi aplikasi orang lain
  = risiko diblokir Tuya + menyamar. Ditolak.
- **Device Data Sharing (OAuth resmi)**: hanya untuk perusahaan & pengguna di
  pusat data Eropa (aturan EU Data Act). Pasar kita Indonesia. Ditolak.
- **Tempel kunci lewat chat ke agen**: kunci jadi tersimpan di transkrip dan log
  penyedia model. Kunci ini bisa menyalakan pemanas di rumah orang. Ditolak;
  agen selalu mengarahkan ke halaman Sambungkan.

---

## 3. Alur pengguna

### 3.1 Beli
Marketplace AgentBuff → "Tuya MCP - Smart Home Connector" → Rp29.000 sekali bayar.
Sesudah lunas: konektor MCP + SKILL.md pendamping terpasang di agen. Agen sudah tahu
kemampuannya, tetapi belum bisa mengendalikan apa pun sampai rumah disambungkan.

### 3.2 Sambungkan (layar terpenting)
`tuya.agentbuff.id` → **Masuk dengan AgentBuff** → wizard 3 langkah, kaca bening:

1. **Siapkan HP** - pastikan perangkat sudah muncul di app Smart Life/Tuya.
   Tombol "Sudah" (tanpa isian).
2. **Ambil kunci rumahmu** - tombol besar "Buka tuya.ai" (tab baru) + 4 gambar
   langkah: Get API Key → pilih SmartLife APP → pindai QR dengan app (ikon pindai
   di pojok kanan atas tab Saya) → salin kunci `sk-...`.
   - Di HP: QR tidak bisa dipindai dari layar HP yang sama. Wizard mendeteksi
     layar kecil dan menyarankan membuka langkah ini di laptop, dengan tautan
     yang bisa disalin. Pengguna tetap boleh lanjut di HP kalau akun app-nya
     tersambung Google (tuya.ai punya masuk dengan Google).
3. **Tempel kunci** - kolom + tombol "Tempel". Validasi langsung:
   - bentuk `sk-XX...` → lencana wilayah ("Server Singapura")
   - panggilan uji ke Tuya → animasi penemuan: "2 rumah, 5 ruangan, 9 perangkat"
   - galat dijelaskan manusiawi (kunci salah, kedaluwarsa, wilayah tidak cocok,
     belum ada perangkat).
   - Selesai → Rumah, dan AgentBuff diminta menyambung MCP otomatis.

### 3.3 Pakai
- **Lewat chat** (utama): agen memanggil tool MCP.
- **Lewat web** (cadangan + kendali visual): dasbor Rumah ala Apple Home.

### 3.4 Kunci kedaluwarsa
Kode 1010 dari Tuya → status rumah `kunci_kedaluwarsa`. Spanduk di web "Perbarui
kunci (1 menit)" ke langkah 2-3 wizard. Tool MCP menjawab galat terstruktur
`home_key_expired` + tautan, sehingga agen memberi tahu dengan kalimat jelas.

### 3.5 Langganan AgentBuff berakhir
Hak dicek lewat `/masuk/status` (cache 10 menit, toleransi 1 jam). Tidak berhak →
akun dibekukan: web hanya membaca, MCP menolak `access_frozen`. Data (suasana,
jadwal, catatan) tidak pernah dihapus karena status.

---

## 4. Fitur

| Fitur | Web | MCP | Catatan |
|---|---|---|---|
| Ringkasan rumah | Beranda | `get_home_overview` | yang menyala, offline, cuaca |
| Daftar perangkat | per ruangan | `list_devices` | filter rumah/ruang/jenis/kata |
| Status perangkat | lembar detail | `get_device` | kemampuan dalam bahasa manusia |
| Kendali satu perangkat | ketuk ubin + lembar | `control_device` | nyala/mati, terang 0-100, warna, suhu putih, suhu AC, mode, kipas, properti mentah |
| Kendali massal | aksi ruangan | `control_devices` | "matikan semua lampu", per ruang/jenis |
| Suasana (scene) | Suasana | `list_scenes` `run_scene` `save_scene` `delete_scene` | disimpan di kita (Tuya end-user API tidak punya scene) |
| Jadwal & timer | Jadwal | `create_schedule` `list_schedules` `cancel_schedule` | dijalankan worker kita |
| Pemakaian listrik | lembar colokan | `get_energy_usage` | statistik per jam Tuya |
| Cuaca | chip beranda | `get_weather` | koordinat rumah |
| Ganti nama | lembar detail | `rename_device` | |
| Notifikasi ke diri sendiri | - | `notify_me` | push app Smart Life (SMS/telepon dibatasi Tuya) |
| Riwayat tindakan | Aktivitas | `get_activity` | siapa: kamu (web) / agen / jadwal / suasana |
| Status sambungan agen | Agen | - | token MCP, terakhir dipakai, contoh perintah |
| Perangkat sensitif | Pengaturan | konfirmasi | pemanas, kompor, pompa, pintu garasi: agen wajib `confirm: true` |

Kategori sensitif bawaan (kode kategori Tuya): `qn` pemanas, `bh` ketel, `kfj`
mesin kopi, `ckmkzq` pintu garasi, `sfkzq` katup air, `jsq` pelembap, plus
perangkat apa pun yang ditandai pengguna.

---

## 5. Desain (DESAIN.md untuk rinciannya)

Arah: **Apple Home x visionOS**. Latar ambient yang berubah menurut waktu
(pagi hangat, siang terang, malam nila), ubin perangkat kaca bening
(blur + saturasi + garis cahaya 1 px). Ubin yang **menyala** jadi kaca terang
pekat dengan ikon berwarna (lampu berwarna memancarkan warna lampunya sendiri);
ubin **mati** tembus pandang; **offline** redup dengan label. Gerak: pegas
pendek (ketuk = skala 0.97), tidak ada animasi yang berjalan sendiri tanpa sebab.

Tema terang + gelap sama-sama dirancang. Bahasa Indonesia + Inggris.

---

## 6. Teknis (ringkas)

- Repo sendiri `AgentBuff-Tuya` (pola BYM): Next 16, React 19, Tailwind v4,
  Drizzle + Postgres 16 (kontainer sendiri), worker Node untuk jadwal + WebSocket
  Tuya, SSE ke peramban.
- Login: OIDC "Masuk dengan AgentBuff" (client `tuya`), hak via `/masuk/status`.
- MCP: `/mcp` (SDK `@modelcontextprotocol/server` 2.0.0, stateless), token
  bearer per pemilik (hash sha256), `/api/agentbuff/mcp-token` untuk sambung
  otomatis dari AgentBuff.
- Kunci Tuya: AES-256-GCM dengan kunci utama dari env, tidak pernah keluar server,
  tidak pernah tercatat di log.
- Batas laju ke Tuya: antrean per pengguna + mundur eksponensial pada 429.
- Singgahan: daftar perangkat 30 dtk, model perangkat 24 jam, status diperbarui
  dari WebSocket.

## 7. Gerbang rilis
- Kunci Tuya asli Chief: daftar perangkat, nyala/mati lampu, AC, suasana, jadwal.
- Agen Chief: 5 contoh perintah di §1 berhasil lewat chat.
- Bukti peramban desktop + HP 390 px, kontras AA dua tema.
- Galat: kunci salah, kunci kedaluwarsa, langganan berakhir, perangkat offline.
