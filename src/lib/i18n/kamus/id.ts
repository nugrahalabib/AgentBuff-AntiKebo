// Kamus Bahasa Indonesia = sumber bentuk. Semua teks layar lewat sini (dijaga scripts/jaga.mjs).
// Gaya (docs/04-DESAIN.md §5): santai, hangat, sedikit jenaka khas "kebo", kalimat pendek,
// tanpa istilah teknis, tanpa tanda pisah panjang.

type Bentuk<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends readonly string[] ? readonly string[] : Bentuk<T[K]> };

export const id = {
  merek: {
    nama: "AntiKebo",
    namaPanjang: "AntiKebo: alarm anti kesiangan",
    oleh: "oleh AgentBuff",
    janji: "Alarm yang tidak berhenti sampai kamu benar-benar bangun.",
  },
  umum: {
    lanjut: "Lanjut",
    kembali: "Kembali",
    batal: "Batal",
    simpan: "Simpan",
    tutup: "Tutup",
    selesai: "Selesai",
    cobaLagi: "Coba lagi",
    memuat: "Memuat...",
    menyimpan: "Menyimpan...",
    galatUmum: "Ada yang tidak beres. Coba lagi sebentar.",
    terputus: "Koneksi terputus. Menyambung ulang...",
  },
  waktu: {
    pagi: "Selamat pagi",
    siang: "Selamat siang",
    sore: "Selamat sore",
    malam: "Selamat malam",
  },
  landing: {
    lencana: "Untuk pengguna AgentBuff",
    judul1: "Bangun beneran,",
    judul2: "bukan tidur lagi.",
    sub: "Alarm keras, suara omelan galak, dan chat dari agenmu datang bareng. Semuanya baru diam setelah kamu menjawab soal di layar.",
    ctaMasuk: "Masuk dengan AgentBuff",
    ctaBeli: "Dapatkan di Marketplace",
    harga: "Rp29.000",
    hargaKet: "sekali bayar",
    poin: [
      { judul: "Diam setelah soal terjawab", isi: "Hitungan, ingat angka, atau pindai kode QR di kamar mandi." },
      { judul: "Diomeli sampai melek", isi: "Suara omelan galak diputar di sela bunyi alarm." },
      { judul: "Atur lewat chat", isi: "Bilang ke agen AgentBuff-mu, alarm langsung terpasang." },
    ],
    bukanJaminan: "AntiKebo membantu kamu bangun, bukan jaminan. Untuk hal sangat penting, pasang juga alarm cadangan.",
  },
  masuk: {
    judul: "Masuk",
    sub: "Pakai akun AgentBuff yang sama dengan agenmu.",
    tombol: "Masuk dengan AgentBuff",
    catatan: "Belum punya AntiKebo? Beli dulu di Marketplace AgentBuff, lalu kembali ke sini.",
    alasan: {
      belum_beli: "Akunmu belum memiliki AntiKebo. Dapatkan dulu di Marketplace AgentBuff.",
      akses_berakhir: "Langganan atau masa coba AgentBuff-mu sudah berakhir. Perpanjang dulu untuk melanjutkan.",
      belum_aktif: "Akun AgentBuff-mu belum aktif. Mulai masa coba atau berlangganan dulu.",
      diblokir: "Akun AgentBuff ini sedang diblokir. Hubungi bantuan AgentBuff.",
      dicabut: "Kamu sempat memutus AntiKebo dari AgentBuff. Masuk lagi untuk menyambungkan.",
      dibatalkan: "Masuk dibatalkan.",
      tidak_dikenal: "Akun ini belum dikenal AgentBuff. Coba masuk lagi.",
      tidak_terjangkau: "AgentBuff sedang tidak bisa dihubungi. Coba lagi sebentar.",
      tidak_diketahui: "AgentBuff menolak masuk. Coba lagi.",
    },
    galat: {
      agentbuff_tak_terjangkau: "AgentBuff sedang tidak bisa dihubungi. Coba lagi sebentar.",
      sesi_masuk_kedaluwarsa: "Waktu masuk habis. Ulangi sekali lagi.",
      umum: "Masuk gagal. Coba lagi.",
    },
    perbaiki: "Perbaiki di AgentBuff",
  },
  shell: {
    tab: { alarm: "Alarm", pengaturan: "Pengaturan" },
    navigasi: "Navigasi utama",
  },
  beku: {
    judul: "Akses dibekukan sementara",
    isi: "Alarm dan pengaturanmu tetap tersimpan. Aktifkan lagi aksesnya untuk melanjutkan.",
    tombol: "Aktifkan lagi",
    periksa: "Periksa ulang",
  },
  beranda: {
    kosongJudul: "Belum ada alarm",
    kosongIsi: "Pasang satu biar besok nggak kebo.",
    segera: "Pembuat alarm sedang disiapkan.",
  },
  izin: {
    judul: "Izin AgentBuff belum lengkap",
    isi: "Tanpa izin ini, spam chat dan suara omelan tidak bisa dipakai.",
    tombol: "Beri izin",
  },
  pengaturan: {
    judul: "Pengaturan",
    akun: "Akun",
    masukSebagai: "Masuk sebagai {email}",
    izinJudul: "Izin AgentBuff",
    izinKabar: "Kirim pesan lewat agenmu",
    izinSuara: "Buat suara omelan",
    diberi: "Diberi",
    belum: "Belum diberi",
    beriIzin: "Beri izin",
    izinKet: "Diatur lewat layar persetujuan AgentBuff.",
    keluar: "Keluar",
    keluarGagal: "Belum bisa keluar. Coba lagi.",
  },
} as const;

export type Kamus = Bentuk<typeof id>;
