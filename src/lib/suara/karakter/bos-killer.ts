import type { NaskahKarakter } from "./jenis";

export const bosKiller: NaskahKarakter = {
  id: {
    umum: [
      "{nama}, saya bayar kamu bukan untuk tidur.",
      "Selamat pagi, {nama}. Atau selamat tinggal, terserah kamu.",
      "{nama}, laporanmu belum selesai dan kamu masih tidur?",
      "Kantor tidak menerima alasan ketiduran, {nama}.",
      "{nama}, kursimu itu banyak yang mau, lho.",
      "Saya sudah di kantor, {nama}. Kamu di mana?",
      "Target bulan ini tidak tercapai sambil tidur, {nama}.",
      "{nama}, evaluasi kinerja minggu depan. Ingat itu.",
      "Bangun, {nama}. Rapat tidak bisa ditunda karena kamu.",
      "{nama}, kalau telat lagi, kita bicara di ruangan saya.",
      "Profesional itu bangun tepat waktu, {nama}.",
      "{nama}, email saya dari jam lima belum kamu balas.",
    ],
    waktu: {
      3: "Tiga menit, {nama}. Saya mulai mencatat.",
      5: "Lima menit, {nama}. Ini masuk penilaian.",
      10: "Sepuluh menit, {nama}. Bagian personalia sudah saya kabari.",
      15: "Lima belas menit, {nama}. Surat peringatan sedang diketik.",
      30: "Setengah jam, {nama}. Saya kecewa berat.",
    },
    agenda: [
      "{nama}, {agenda} hari ini. Jangan sampai gagal.",
      "Klien tidak peduli kamu ngantuk, {nama}. Ingat {agenda}!",
      "{nama}, kalau {agenda} berantakan, kamu yang tanggung.",
    ],
    cek: "{nama}, kamu masih bangun? Jangan bikin saya ragu.",
    penutup: "Bagus, {nama}. Sekarang kerja yang benar.",
  },
  en: {
    umum: [
      "{nama}, I don't pay you to sleep.",
      "Good morning, {nama}. Or goodbye, your choice.",
      "{nama}, your report isn't done and you're still asleep?",
      "The office doesn't accept oversleeping as an excuse, {nama}.",
      "{nama}, plenty of people want your desk, you know.",
      "I'm already at the office, {nama}. Where are you?",
      "This month's target won't be hit while sleeping, {nama}.",
      "{nama}, performance review next week. Remember that.",
      "Get up, {nama}. The meeting won't be moved for you.",
      "{nama}, if you're late again, we'll talk in my office.",
      "Professionals wake up on time, {nama}.",
      "{nama}, you still haven't answered my five o'clock email.",
    ],
    waktu: {
      3: "Three minutes, {nama}. I'm taking notes.",
      5: "Five minutes, {nama}. This goes on your review.",
      10: "Ten minutes, {nama}. I've already told HR.",
      15: "Fifteen minutes, {nama}. Your warning letter is being typed.",
      30: "Half an hour, {nama}. I'm deeply disappointed.",
    },
    agenda: [
      "{nama}, {agenda} today. Don't you dare fail.",
      "The client doesn't care that you're sleepy, {nama}. Remember {agenda}!",
      "{nama}, if {agenda} goes wrong, it's on you.",
    ],
    cek: "{nama}, are you still awake? Don't make me doubt you.",
    penutup: "Good, {nama}. Now do your job properly.",
  },
};
