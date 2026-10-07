# Listing Marketplace AntiKebo (bahan siap pakai)

Bahan untuk skrip siapkan produk di repo AgentBuff (sesi laptop, L2/L3). Semua kalimat di sini
hanya menjanjikan yang sudah terbukti di cloud; butir yang masih "wajib diuji" di HP atau PC asli
ditandai dan **jangan dipakai di listing sebelum L2 lulus** (`docs/GERBANG-RILIS.md` butir 3 dan 4).

## Isian katalog

| Isian | Nilai |
|---|---|
| Kunci produk | `antikebo` |
| Judul | AntiKebo |
| Harga | Rp29.000, sekali bayar (`one_time`) |
| Status awal | `coming_soon` (terbitkan sesudah `GERBANG-RILIS.md` hijau) |
| Sumber | aplikasi web + MCP (sambung otomatis) |
| Alamat aplikasi | `https://antikebo.agentbuff.id` |
| Konektor MCP | `https://antikebo.agentbuff.id/mcp` |
| Skill pendamping | `skill/SKILL.md` di repo ini (unggah apa adanya) |
| Ikon | `AlarmClock`, emoji sampul ⏰ |
| Privasi / Ketentuan | `https://antikebo.agentbuff.id/privasi`, `https://antikebo.agentbuff.id/ketentuan` |

## Bahasa Indonesia

**Tagline:** Alarm yang tidak berhenti sampai kamu menjawab soal. Agenmu ikut membangunkan lewat chat.

**Deskripsi:**
AntiKebo, anti tidur kayak kebo. Alarm berbunyi keras di PC, HP, atau tablet yang siaga, suara
omelan galak diputar di sela bunyi, dan agen AgentBuff-mu mengirim pesan bertubi-tubi ke kanal
chatmu. Semuanya baru diam setelah kamu menjawab soal di layar: hitungan, ingat angka, ketik
kalimat, atau pindai kode QR yang kamu tempel jauh dari kasur. Tunda pun harus menjawab soal.
Atur semuanya cukup lewat chat ke agenmu, atau lewat aplikasi web. Mode Komitmen mengunci alarm
supaya tidak bisa kamu matikan malam sebelumnya. Lampu dan AC Tuya bisa ikut membangunkan. Tanpa
AI di dalam aplikasi, tanpa iklan. Sekali bayar.

**Kemampuan (maks 160 karakter):**
1. Alarm baru diam setelah soal terjawab: hitungan, ingat angka, ketik kalimat, atau pindai kode QR di kamar mandi.
2. Atur lewat chat: "bangunin aku jam 5 besok, ada presentasi" dan alarm langsung terpasang.
3. Agenmu mengirim pesan bertubi-tubi ke Telegram atau WhatsApp-mu sampai kamu bangun.
4. Suara omelan galak dari 5 karakter atau kalimatmu sendiri, dibuat AgentBuff milikmu; bunyi alarm tetap jalan walau suara gagal.
5. Tunda juga harus menjawab soal, dengan jatah yang kamu tentukan.
6. "Masih bangun?" mengecek beberapa menit kemudian; tidak dijawab, alarm berbunyi lagi.
7. Mode Komitmen: malam sebelumnya alarm tidak bisa dimatikan, dilewati, atau diperlemah, juga lewat agen.
8. Aplikasi PC Windows yang tidak bisa ditutup saat berbunyi, dan Mode Jam Meja untuk HP atau tablet.
9. Lampu dan AC Tuya ikut membangunkan: nyala bertahap sebelum alarm, berkedip saat berbunyi.
10. Riwayat dan skor bangun, hari beruntun, ekspor CSV. Pengingat malam berisi alarm besok.

**Tutorial:**
```
## Syarat
- Akun AgentBuff yang aktif.
- Tidak perlu kunci atau token apa pun: AntiKebo tersambung otomatis ke agenmu.

## Cara mulai
- Buka https://antikebo.agentbuff.id lalu pilih Masuk dengan AgentBuff (akun yang sama).
- Izinkan dua hal saat diminta: kirim pesan lewat agenmu dan buat suara memakai pengaturan suaramu.
- Ikuti perkenalan singkat: nama panggilan, karakter, perangkat siaga, kanal, lalu alarm uji 1 menit.
- Biarkan satu perangkat siaga malam hari: aplikasi PC (Windows) atau Mode Jam Meja di HP/tablet yang dicas.

## Contoh perintah
- "Bangunin aku jam 5 besok, ada presentasi klien"
- "Alarm kuliah jam 6 tiap hari kerja, soal hitungan sedang 3 kali benar"
- "Kunci alarm besok pakai Mode Komitmen"
- "Lewati alarm besok, aku libur"
- "Gimana skor bangunku minggu ini?"

## Catatan penting
- Alarm berbunyi hanya di perangkat yang siaga. Cek tab Siaga: harus Siap malam ini.
- Agen tidak bisa mematikan atau menunda alarm yang sedang berbunyi. Hanya soal di layar.
- AntiKebo membantu bangun, bukan jaminan. Untuk hal sangat penting, pasang juga alarm cadangan.
```

**Tutorial manual (cadangan bila sambung otomatis belum jalan):**
```
1. Buka https://antikebo.agentbuff.id, pilih Masuk dengan AgentBuff.
2. Pengaturan > Agen > Lanjutan > Buat token.
3. Salin token, tempel di sini, klik Sambungkan.
```

## English

**Tagline:** An alarm that won't stop until you solve a challenge. Your agent helps wake you up by chat.

**Description:**
AntiKebo rings loudly on your standby PC, phone, or tablet, plays a scolding voice between the
alarm sounds, and your AgentBuff agent keeps messaging your chat channels. It all stops only when
you solve the challenge on screen: math, memorize digits, type a sentence, or scan a QR code you
stuck far from your bed. Snoozing needs a challenge too. Set everything up just by chatting with
your agent, or in the web app. Commitment mode locks an alarm so you can't turn it off the night
before. Tuya lights and AC can help wake you. No AI inside the app, no ads. One-time payment.

**Capabilities (max 160 characters):**
1. The alarm goes quiet only after you solve a challenge: math, memorize digits, type a sentence, or scan a QR code in the bathroom.
2. Set it by chat: "wake me at 5 tomorrow, I have a presentation" and the alarm is set.
3. Your agent keeps messaging your Telegram or WhatsApp until you wake up.
4. Scolding voices from 5 characters or your own lines, made by your own AgentBuff; the alarm still rings if a voice fails.
5. Snoozing needs a challenge too, with the number of snoozes you choose.
6. "Still awake?" checks a few minutes later; no answer and the alarm rings again.
7. Commitment mode: the night before, an alarm can't be turned off, skipped, or weakened, not even by your agent.
8. A Windows PC app that can't be closed while ringing, and Desk Clock mode for phones and tablets.
9. Tuya lights and AC help wake you: they turn on before the alarm and flash while it rings.
10. History and wake score, streaks, CSV export. A night reminder with tomorrow's alarm.

**Tutorial:**
```
## Requirements
- An active AgentBuff account.
- No key or token needed: AntiKebo connects to your agent automatically.

## Getting started
- Open https://antikebo.agentbuff.id and choose Sign in with AgentBuff (the same account).
- Allow two things when asked: sending messages through your agent and making voices with your voice settings.
- Follow the short welcome: nickname, character, standby devices, channels, then a 1-minute test alarm.
- Keep one device on standby at night: the PC app (Windows) or Desk Clock mode on a charging phone or tablet.

## Example prompts
- "Wake me at 5 tomorrow, I have a client presentation"
- "Class alarm at 6 every weekday, medium math, 3 right answers"
- "Lock tomorrow's alarm with Commitment mode"
- "Skip tomorrow's alarm, I'm off"
- "How was my wake score this week?"

## Important
- Alarms ring only on devices on standby. Check the Standby tab: it must say Ready tonight.
- Your agent can't stop or snooze a ringing alarm. Only the challenge on screen can.
- AntiKebo helps you wake up, but it is not a guarantee. For very important things, set a backup alarm too.
```

**Manual tutorial (fallback if auto-connect hasn't run):**
```
1. Open https://antikebo.agentbuff.id and choose Sign in with AgentBuff.
2. Settings > Agent > Advanced > Create token.
3. Copy the token, paste it here, and click Connect.
```

## Wajib diuji sebelum dipakai di listing

- Kalimat soal HP: Mode Jam Meja di iPhone (saklar senyap, layar redup) dan Android (tab di latar,
  baterai) belum diuji di perangkat asli (L2). Sampai lulus, listing hanya menyebut "HP atau tablet
  yang dicas dan layarnya menyala" tanpa menjanjikan bunyi saat layar terkunci.
- Pesan ke Telegram dan WhatsApp asli lewat pintu kanal AgentBuff (L1, `GERBANG-RILIS.md` butir 6).
- Suara omelan lewat pintu suara AgentBuff asli (L1, butir 5).
- Gambar listing: 3 gambar 1600 x 900 dari tangkapan layar asli (L3).
