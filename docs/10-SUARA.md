# Suara dan bunyi

Dua lapisan yang diputar **bersamaan** saat berbunyi: **bunyi alarm** (berulang terus) dan **suara
omelan** (kalimat galak). Bunyi alarm tidak pernah bergantung pada suara omelan.

## 1. Bunyi alarm

- **Dibuat sendiri** dengan skrip di repo (`scripts/bangun-bunyi.ts`), disintesis dari gelombang
  dasar (sinus, kotak, sapuan sirene, lonceng aditif), jadi bebas lisensi. MP3 aplikasi lama tidak
  dipakai (K-08).
- Minimal 8 bunyi: Klasik, Digital, Sirene, Lonceng Sekolah, Alarm Kebakaran, Ayam (dibuat dari
  sintesis, bukan rekaman), Nuklir, Naik Perlahan.
- Panjang tiap putaran 2 sampai 6 detik, bisa diulang tanpa celah (titik potong di nol).
- Kekerasan dinormalkan (target sekitar −14 LUFS, puncak ≤ −1 dBTP) supaya semua bunyi sama keras.
- Format: OGG Opus + cadangan MP3 untuk peramban lama. Disimpan di `public/bunyi/`.
- Pratinjau 5 detik di Ubah alarm.

## 2. Karakter omelan

Naskah ada di repo sebagai data (`src/lib/suara/karakter/<id>.ts`, id dan en):

| Karakter | Rasa |
|---|---|
| Ibu Galak | Omelan emak-emak, panggil nama lengkap |
| Pelatih Tentara | Perintah keras, hitung mundur |
| Bos Killer | Ancaman soal kerjaan dan agenda |
| Teman Nyolot | Ejekan santai khas tongkrongan |
| Pacar Bawel | Kesal tapi perhatian |
| Kustom | Hanya kalimat buatan pengguna/agen |

Tiap karakter:

- **≥ 12 kalimat umum**, semuanya galak sejak awal, memakai `{nama}`. Contoh Pelatih Tentara:
  "BANGUN, {nama}! Ini bukan hari libur!", "Kasur bukan medan perang, {nama}! Berdiri!".
- **5 kalimat waktu:** menit 3, 5, 10, 15, 30 ("{nama}! Sudah lima menit kamu masih molor!").
- **3 kalimat agenda** memakai `{agenda}` dan `{jam_agenda}` bila ada ("Ingat {agenda}! Mau
  gagal lagi?!").
- **1 kalimat Masih bangun** dan **1 kalimat penutup** (dipakai juga untuk pesan kanal).
- Maks 150 huruf per kalimat (target 3 sampai 6 detik diucapkan).
- Kata kasar ringan boleh (khas tongkrongan), tanpa SARA, seksual, atau ancaman kekerasan nyata.
  Daftar larangan di `src/lib/suara/saring.ts`, juga dipakai untuk kalimat buatan pengguna/agen.

Kalimat pribadi: maks 10 per alarm, maks 150 huruf, lewat penyaring yang sama.

## 3. Pola putar

```
[bunyi alarm berulang ─────────────────────────────────────────────────►]
[omelan 1]──3 dtk──[omelan 2]──3 dtk──[omelan 3]──3 dtk── ...
```

- Bunyi alarm berjalan terus. Selama omelan diputar, bunyi alarm dikecilkan ke ±30% (turun 150 md),
  lalu naik lagi ke 100% saat jeda.
- Jeda antar omelan **3 detik**.
- Urutan: acak dari kalimat umum + agenda + pribadi, tanpa kalimat yang sama dua kali berturut-
  turut, semua terpakai sebelum ada yang diulang.
- Kalimat waktu disisipkan tepat sesudah menit 3, 5, 10, 15, 30 berlalu.
- Volume utama selalu maksimal yang diizinkan perangkat (PC: dipaksa, lihat `09-APLIKASI-PC.md`).

Implementasi:

- **Web:** Web Audio API (`AudioContext`, satu `GainNode` untuk bunyi, satu untuk omelan). iPhone:
  `navigator.audioSession.type = "playback"` sebelum `AudioContext` dibuat dan di setiap ketukan
  (supaya tetap bunyi walau saklar senyap; **wajib diuji di iPhone asli**). Konteks audio dibuka
  oleh ketukan "Mulai siaga" atau ketukan pertama di layar berbunyi.
- **PC:** `rodio` dengan dua sumber yang dicampur, ke semua perangkat keluaran aktif.

## 4. Pembuatan suara (lewat AgentBuff pengguna)

```
Alarm disimpan ──► AntiKebo menghitung naskah yang dibutuhkan
                   (karakter × nama panggilan, + agenda, + kalimat pribadi)
              ──► naskah tanpa klip masuk antrean `naskah_suara`
worker suara  ──► POST /masuk/suara (sub pengguna, teks, gaya "galak", suara pilihan)
              ──► AgentBuff milik pengguna membuat audio dengan pengaturan suaranya
              ──► klip disimpan `klip_suara`, peristiwa `klip_siap`
perangkat     ──► mengunduh klip sebelum malam, menyimpannya lokal
```

- **Kunci klip:** hash dari (teks yang sudah diisi nama/agenda, id suara, gaya, penyedia). Klip
  dipakai ulang lintas alarm; hanya dibuat ulang bila salah satunya berubah.
- **Kalimat umum dibuat sekali per pengguna per karakter per suara**; kalimat agenda per alarm.
- Antrean: paralel 1 per pengguna, 4 total; galat sementara (`agen_tidak_aktif`, `penyedia_gagal`,
  `kuota`) diulang dengan jeda bertambah sampai 6 jam; galat tetap (`belum_diizinkan`,
  `teks_tidak_sah`) dihentikan dan ditampilkan.
- **Status di kartu alarm:** "Suara siap" (semua klip ada), "Sedang dibuat (7 dari 12)", "Belum
  bisa dibuat" + alasan ramah + tombol penyelesai (mis. "Beri izin suara di AgentBuff").
- **Pilihan suara:** `POST /masuk/suara/daftar`; contoh dengar dibuat dari satu kalimat pendek
  dan disimpan sebagai klip biasa.
- **Biaya:** nol untuk AntiKebo. Bila pengguna memakai suara gratis AgentBuff, nol juga untuk
  pengguna. Bila pengguna memakai penyedia berbayar di AgentBuff, biayanya di kunci pengguna;
  karena klip dibuat sekali, pemakaiannya kecil.

## 5. Cadangan bila klip belum ada

1. Perangkat membacakan naskah yang sama dengan suara bawaan perangkat (web: `speechSynthesis`
   dengan suara `id-ID` bila ada; PC: suara bawaan Windows) dengan kecepatan sedikit lebih cepat.
2. Bila tidak ada suara bawaan berbahasa Indonesia: bunyi alarm saja + teks omelan tampil besar.

Bunyi alarm selalu ada di perangkat (dibundel/di-cache), jadi alarm tidak pernah diam.

## 6. Penyimpanan di perangkat

- **Web (Jam Meja):** Service Worker menyimpan bunyi + klip alarm 24 jam ke depan di Cache Storage.
  Sebelum siaga dianggap "siap", semua klip yang diperlukan harus sudah tersimpan.
- **PC:** folder data aplikasi, klip dibersihkan bila tidak dipakai 7 hari.
