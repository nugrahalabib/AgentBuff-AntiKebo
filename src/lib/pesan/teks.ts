/**
 * Kumpulan teks pesan kanal (PRD G3, G4, G7; arsitektur §7). Ditulis tangan, TANPA AI. Tiap pesan
 * spam = pembuka (bervariasi) + satu kalimat omelan karakter (sudah berisi nama) + baris agenda +
 * baris menit berlalu + tautan ke layar alarm. Placeholder: {nama}, {ke}, {jam}, {menit},
 * {agenda}, {tautan}, {perangkat}, {jamBangun}, {tunda}.
 */

export type TeksPesan = {
  /** Baris pertama pesan spam; {ke} = nomor pesan ke kanal ini. */
  pembuka: string[];
  agenda: string;
  menitBerlalu: string;
  baruBerbunyi: string;
  tautanMatikan: string;
  /** Penutup sesudah bangun: {jamBangun}, {menit}, {tunda}. */
  penutupRingkas: string;
  penutupTanpaTunda: string;
  /** "Masih bangun?" tampil. */
  cekAjak: string;
  /** Kejadian terlewat karena server sempat mati (PRD C6). */
  terlewat: string;
  terlewatAgenda: string;
  /** Pengingat malam (PRD G4). */
  pengingatJudul: string;
  pengingatAlarm: string;
  pengingatAlarmAgenda: string;
  pengingatSiap: string;
  pengingatTanpaSiaga: string;
  pengingatTautan: string;
  /** Pesan uji kanal (PRD G7). */
  uji: string;
  /** Notifikasi web. */
  notifJudulBunyi: string;
  notifJudulCek: string;
  notifCekIsi: string;
  notifJudulSelesai: string;
  notifIsiSelesai: string;
  notifJudulTerlewat: string;
  notifJudulPengingat: string;
  notifJudulUji: string;
  notifIsiUji: string;
  /** Penutup cadangan untuk karakter Kustom (tidak punya kalimat penutup). */
  penutupUmum: string;
  cekUmum: string;
  /** Akses AgentBuff berakhir (K-07): {sampai} = saat alarm berhenti dibunyikan, {tautan} = perpanjang. */
  bekuKabar: string;
  bekuDitahan: string;
  bekuTenggang: string;
  notifJudulBeku: string;
};

export const TEKS_PESAN: Record<"id" | "en", TeksPesan> = {
  id: {
    pembuka: [
      "⏰ BANGUN, {nama}! (#{ke})",
      "⏰ Alarm masih bunyi, {nama}! (#{ke})",
      "⏰ Woy {nama}, bangun! (#{ke})",
      "⏰ Masih molor, {nama}? (#{ke})",
      "⏰ {nama}! Buka matamu sekarang! (#{ke})",
      "⏰ Pesan ke-{ke}, {nama}. Bangun!",
      "⏰ {nama}, kasur bukan tempat kerja! (#{ke})",
      "⏰ Jangan pura-pura nggak lihat, {nama}! (#{ke})",
      "⏰ Ini belum selesai, {nama}! (#{ke})",
      "⏰ Ayo {nama}, berdiri! (#{ke})",
      "⏰ {nama}, HP-mu bakal bunyi terus! (#{ke})",
      "⏰ Bangun sekarang atau pesan ini nggak berhenti, {nama}! (#{ke})",
    ],
    agenda: "📌 {agenda}",
    menitBerlalu: "Sudah {menit} menit sejak alarm {jam} berbunyi.",
    baruBerbunyi: "Alarm {jam} sedang berbunyi.",
    tautanMatikan: "Jawab soalnya untuk mematikan: {tautan}",
    penutupRingkas: "Kamu bangun {jamBangun} ({menit} menit, tunda {tunda} kali). Selamat pagi!",
    penutupTanpaTunda: "Kamu bangun {jamBangun} ({menit} menit, tanpa tunda). Selamat pagi!",
    cekAjak: "Buka AntiKebo dan ketuk Masih! sekarang: {tautan}",
    terlewat: "Alarm {jam} terlewat karena AntiKebo sempat terganggu. Maaf, {nama}! Cek alarmmu: {tautan}",
    terlewatAgenda: "Alarm {jam} ({agenda}) terlewat karena AntiKebo sempat terganggu. Maaf, {nama}! Cek alarmmu: {tautan}",
    pengingatJudul: "🌙 Selamat malam, {nama}!",
    pengingatAlarm: "Alarm berikutnya: {jam}.",
    pengingatAlarmAgenda: "Alarm berikutnya: {jam}, {agenda}.",
    pengingatSiap: "Perangkat siaga: {perangkat}. Aman, tidur sana!",
    pengingatTanpaSiaga: "Belum ada perangkat siaga! Nyalakan PC atau buka Mode Jam Meja di HP sebelum tidur.",
    pengingatTautan: "Atur alarm: {tautan}",
    uji: "✅ Tes dari AntiKebo, {nama}. Kanal ini siap membangunkanmu!",
    notifJudulBunyi: "⏰ {judul}",
    notifJudulCek: "Masih bangun, {nama}?",
    notifCekIsi: "Ketuk Masih! sekarang, kalau tidak alarm berbunyi lagi.",
    notifJudulSelesai: "Alarm sudah mati",
    notifIsiSelesai: "Selamat pagi, {nama}!",
    notifJudulTerlewat: "Alarm {jam} terlewat",
    notifJudulPengingat: "Alarm berikutnya {jam}",
    notifJudulUji: "Notifikasi AntiKebo menyala",
    notifIsiUji: "Saat alarm berbunyi, notifikasi seperti ini muncul terus sampai kamu bangun.",
    penutupUmum: "Mantap, {nama}! Kamu berhasil bangun.",
    cekUmum: "{nama}, masih bangun kan? Jangan tidur lagi!",
    bekuKabar:
      "⚠️ {nama}, akses AntiKebo-mu berakhir. Alarm yang sudah terpasang masih berbunyi sampai {sampai}, sesudah itu berhenti sampai aksesmu aktif lagi. Perpanjang: {tautan}",
    bekuDitahan: "⚠️ Alarm {jam} TIDAK akan berbunyi karena akses AntiKebo-mu berakhir. Perpanjang supaya alarm berbunyi lagi: {tautan}",
    bekuTenggang: "⚠️ Akses AntiKebo-mu berakhir: alarm berhenti berbunyi mulai {sampai}. Perpanjang: {tautan}",
    notifJudulBeku: "Akses AntiKebo berakhir",
  },
  en: {
    pembuka: [
      "⏰ WAKE UP, {nama}! (#{ke})",
      "⏰ Your alarm is still ringing, {nama}! (#{ke})",
      "⏰ Hey {nama}, get up! (#{ke})",
      "⏰ Still sleeping, {nama}? (#{ke})",
      "⏰ {nama}! Open your eyes now! (#{ke})",
      "⏰ Message number {ke}, {nama}. Get up!",
      "⏰ {nama}, your bed is not your office! (#{ke})",
      "⏰ Don't pretend you didn't see this, {nama}! (#{ke})",
      "⏰ This is not over, {nama}! (#{ke})",
      "⏰ Come on {nama}, stand up! (#{ke})",
      "⏰ {nama}, your phone will keep buzzing! (#{ke})",
      "⏰ Get up now or these messages never stop, {nama}! (#{ke})",
    ],
    agenda: "📌 {agenda}",
    menitBerlalu: "{menit} minutes since your {jam} alarm went off.",
    baruBerbunyi: "Your {jam} alarm is ringing.",
    tautanMatikan: "Solve the challenge to turn it off: {tautan}",
    penutupRingkas: "You woke up at {jamBangun} ({menit} minutes, snoozed {tunda} times). Good morning!",
    penutupTanpaTunda: "You woke up at {jamBangun} ({menit} minutes, no snooze). Good morning!",
    cekAjak: "Open AntiKebo and tap Still up! now: {tautan}",
    terlewat: "Your {jam} alarm was missed because AntiKebo had a problem. Sorry, {nama}! Check your alarms: {tautan}",
    terlewatAgenda: "Your {jam} alarm ({agenda}) was missed because AntiKebo had a problem. Sorry, {nama}! Check your alarms: {tautan}",
    pengingatJudul: "🌙 Good night, {nama}!",
    pengingatAlarm: "Next alarm: {jam}.",
    pengingatAlarmAgenda: "Next alarm: {jam}, {agenda}.",
    pengingatSiap: "Standby device: {perangkat}. All set, go to sleep!",
    pengingatTanpaSiaga: "No standby device yet! Turn on your PC or open Desk Clock mode on your phone before bed.",
    pengingatTautan: "Manage alarms: {tautan}",
    uji: "✅ Test from AntiKebo, {nama}. This channel is ready to wake you up!",
    notifJudulBunyi: "⏰ {judul}",
    notifJudulCek: "Still up, {nama}?",
    notifCekIsi: "Tap Still up! now, or the alarm rings again.",
    notifJudulSelesai: "Alarm turned off",
    notifIsiSelesai: "Good morning, {nama}!",
    notifJudulTerlewat: "{jam} alarm missed",
    notifJudulPengingat: "Next alarm {jam}",
    notifJudulUji: "AntiKebo notifications are on",
    notifIsiUji: "When your alarm rings, a notification like this keeps coming until you're up.",
    penutupUmum: "Nice one, {nama}! You made it out of bed.",
    cekUmum: "{nama}, you're still up, right? Don't go back to sleep!",
    bekuKabar: "⚠️ {nama}, your AntiKebo access has ended. Alarms you already set still ring until {sampai}, then they stop until your access is active again. Renew: {tautan}",
    bekuDitahan: "⚠️ Your {jam} alarm will NOT ring because your AntiKebo access has ended. Renew so alarms ring again: {tautan}",
    bekuTenggang: "⚠️ Your AntiKebo access has ended: alarms stop ringing from {sampai}. Renew: {tautan}",
    notifJudulBeku: "AntiKebo access ended",
  },
};
