//! Mesin alarm PC (docs/09-APLIKASI-PC.md §6): memutuskan kapan berbunyi, berhenti, dan bertanya
//! "Masih bangun?" dari tiga sumber: salinan jadwal, peristiwa server (SSE), dan detik lokal.
//!
//!  - Server berbunyi lebih dulu (peristiwa `berbunyi` atau status `berbunyi` di jadwal) ATAU
//!    pengatur waktu lokal sesudah tenggang 5 detik, mana yang lebih dulu. Tidak dobel karena
//!    setiap dering ditandai `kunci@saat` (kejadian yang ditunda punya saat baru).
//!  - Berhenti HANYA bila server berkata soal terjawab/ditunda/selesai (peristiwa atau jadwal),
//!    atau soal luring terjawab di PC (`luring_lolos`). Tidak ada jalan lain (aturan teknis 2).
//!  - Aplikasi dinyalakan ulang saat alarm berbunyi (penjaga): status `berbunyi` di jadwal
//!    membunyikannya lagi.

use crate::jadwal::{jagaan_berikutnya, tanda, ItemJadwal, BATAS_TERLAMBAT_MS};
use time::OffsetDateTime;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sumber {
    /// Server sudah membunyikan (soal dari server).
    Server,
    /// PC berbunyi sendiri karena server diam (koneksi putus atau server terlambat).
    Lokal,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Dering {
    pub kunci: String,
    pub tanda: String,
    pub kejadian_id: Option<String>,
    pub sumber: Sumber,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlasanHenti {
    /// Soal terjawab di perangkat mana pun, atau alarm berhenti sendiri (batas menit).
    Selesai,
    Ditunda,
    /// Soal terjawab dan "Masih bangun?" menyusul.
    Cek,
    /// Soal luring terjawab di PC ini; jawabannya dikirim begitu daring.
    LuringLolos,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Tindakan {
    Bunyikan(Box<ItemJadwal>, Sumber),
    /// Dering yang berjalan kini punya id kejadian server (soal bisa diambil dari server).
    KenaliKejadian(String),
    Hentikan(AlasanHenti),
    TanyaMasihBangun(Box<ItemJadwal>),
    TutupMasihBangun,
    TarikJadwal,
}

#[derive(Debug, Default)]
pub struct Mesin {
    pub jadwal: Vec<ItemJadwal>,
    pub dering: Option<Dering>,
    /// Kunci kejadian yang sedang ditanya "Masih bangun?".
    pub cek: Option<String>,
    sudah: Vec<String>,
    /// Kunci yang soal luringnya sudah terjawab di PC (jangan dibunyikan lagi walau server belum tahu).
    luring: Vec<String>,
    /// Naik setiap peristiwa server; jadwal yang diminta sebelum peristiwa terakhir sudah basi.
    generasi: u64,
}

fn ms(t: OffsetDateTime) -> i64 {
    (t.unix_timestamp_nanos() / 1_000_000) as i64
}

impl Mesin {
    pub fn baru() -> Self {
        Self::default()
    }

    pub fn berbunyi(&self) -> bool {
        self.dering.is_some()
    }

    fn mulai(&mut self, i: &ItemJadwal, sumber: Sumber) -> Tindakan {
        let t = tanda(i).unwrap_or_else(|| format!("{}@{}", i.kunci, ms(i.jadwal_utc)));
        if !self.sudah.contains(&t) {
            self.sudah.push(t.clone());
        }
        self.cek = None;
        self.dering = Some(Dering { kunci: i.kunci.clone(), tanda: t, kejadian_id: i.kejadian_id.clone(), sumber });
        Tindakan::Bunyikan(Box::new(i.clone()), sumber)
    }

    fn henti(&mut self, alasan: AlasanHenti) -> Tindakan {
        self.dering = None;
        Tindakan::Hentikan(alasan)
    }

    fn cocok(&self, id: &str) -> bool {
        self.dering
            .as_ref()
            .is_some_and(|d| d.kejadian_id.as_deref() == Some(id) || self.jadwal.iter().any(|i| i.kejadian_id.as_deref() == Some(id) && i.kunci == d.kunci))
    }

    /// Catat sebelum meminta jadwal; berikan nilainya ke `jadwal_baru`.
    pub fn generasi(&self) -> u64 {
        self.generasi
    }

    /// Salinan jadwal baru dari server (`GET /api/perangkat/jadwal`). Jawaban yang diminta sebelum
    /// peristiwa terakhir diabaikan (permintaan sesudah peristiwa itu sedang menyusul), supaya
    /// jadwal basi tidak membunyikan lagi alarm yang baru saja berhenti.
    pub fn jadwal_baru(&mut self, kejadian: Vec<ItemJadwal>, sekarang_ms: i64, generasi_minta: u64) -> Vec<Tindakan> {
        if generasi_minta < self.generasi {
            return Vec::new();
        }
        self.jadwal = kejadian;
        // Kunci luring yang sudah tidak aktif di server = jawabannya sudah diterima.
        let aktif: Vec<String> = self.jadwal.iter().filter(|i| i.status != "menunggu").map(|i| i.kunci.clone()).collect();
        self.luring.retain(|k| aktif.contains(k));
        let mut t = Vec::new();
        if let Some(d) = self.dering.clone() {
            match self.jadwal.iter().find(|i| i.kunci == d.kunci).cloned() {
                Some(i) if i.status == "berbunyi" || i.status == "menunggu" => {
                    if d.kejadian_id.is_none() {
                        if let Some(id) = i.kejadian_id.clone() {
                            self.dering.as_mut().unwrap().kejadian_id = Some(id.clone());
                            t.push(Tindakan::KenaliKejadian(id));
                        }
                    }
                }
                // Ditunda dengan saat yang sama = dering lokal untuk tunda yang belum dibunyikan server.
                Some(i) if i.status == "ditunda" && tanda(&i).as_deref() == Some(d.tanda.as_str()) => {}
                Some(i) if i.status == "ditunda" => t.push(self.henti(AlasanHenti::Ditunda)),
                Some(i) if i.status == "cek_bangun" => {
                    t.push(self.henti(AlasanHenti::Cek));
                    self.cek = Some(i.kunci.clone());
                }
                // Tidak aktif lagi di server: soal terjawab di perangkat lain atau berhenti sendiri.
                _ => t.push(self.henti(AlasanHenti::Selesai)),
            }
        }
        // Server berbunyi dan PC belum: bunyikan (termasuk sesudah aplikasi dinyalakan ulang).
        if self.dering.is_none() {
            if let Some(i) = self.jadwal.iter().find(|i| i.status == "berbunyi" && !self.luring.contains(&i.kunci)).cloned() {
                t.push(self.mulai(&i, Sumber::Server));
            }
        }
        if let Some(k) = self.cek.clone() {
            if !self.jadwal.iter().any(|i| i.kunci == k && i.status == "cek_bangun") {
                self.cek = None;
                t.push(Tindakan::TutupMasihBangun);
            }
        } else if self.dering.is_none() {
            if let Some(i) = self.jadwal.iter().find(|i| i.status == "cek_bangun") {
                self.cek = Some(i.kunci.clone());
            }
        }
        t.extend(self.tanya_bila_waktunya(sekarang_ms));
        t
    }

    /// "Masih bangun?" tampil pada `cek_pada` (sebelumnya layar Selamat pagi).
    fn tanya_bila_waktunya(&mut self, sekarang_ms: i64) -> Option<Tindakan> {
        let k = self.cek.clone()?;
        let i = self.jadwal.iter().find(|i| i.kunci == k)?;
        let pada = i.cek_pada.map(ms)?;
        let tanda_cek = format!("{k}@cek{pada}");
        if sekarang_ms >= pada && !self.sudah.contains(&tanda_cek) {
            self.sudah.push(tanda_cek);
            return Some(Tindakan::TanyaMasihBangun(Box::new(i.clone())));
        }
        None
    }

    /// Peristiwa server (SSE): `nama` + id kejadian (`k`).
    pub fn peristiwa(&mut self, nama: &str, k: Option<&str>, sekarang_ms: i64) -> Vec<Tindakan> {
        self.generasi += 1;
        let mut t = Vec::new();
        match (nama, k) {
            ("berbunyi", Some(id)) => {
                if self.dering.is_none() {
                    if let Some(i) = self.jadwal.iter().find(|i| i.kejadian_id.as_deref() == Some(id) && !self.luring.contains(&i.kunci)).cloned() {
                        t.push(self.mulai(&i, Sumber::Server));
                    }
                } else if let Some(d) = self.dering.as_mut() {
                    if d.kejadian_id.is_none() && self.jadwal.iter().any(|i| i.kejadian_id.as_deref() == Some(id) && i.kunci == d.kunci) {
                        d.kejadian_id = Some(id.to_string());
                        d.sumber = Sumber::Server;
                        t.push(Tindakan::KenaliKejadian(id.to_string()));
                    }
                }
            }
            ("berhenti", Some(id)) => {
                if self.cocok(id) {
                    t.push(self.henti(AlasanHenti::Selesai));
                }
                if self.cek.as_ref().is_some_and(|c| self.jadwal.iter().any(|i| i.kejadian_id.as_deref() == Some(id) && &i.kunci == c)) {
                    self.cek = None;
                    t.push(Tindakan::TutupMasihBangun);
                }
            }
            ("tunda", Some(id)) if self.cocok(id) => t.push(self.henti(AlasanHenti::Ditunda)),
            ("cek", Some(id)) if self.cocok(id) => t.push(self.henti(AlasanHenti::Cek)),
            _ => {}
        }
        t.extend(self.tanya_bila_waktunya(sekarang_ms));
        t.push(Tindakan::TarikJadwal);
        t
    }

    /// Tiap detik: pengatur waktu lokal (server diam lebih dari tenggang) dan "Masih bangun?".
    pub fn detik(&mut self, sekarang_ms: i64) -> Vec<Tindakan> {
        // Tanda lama tidak perlu diingat lagi.
        self.sudah.retain(|x| {
            x.rsplit_once('@')
                .and_then(|(_, t)| t.trim_start_matches("cek").parse::<i64>().ok())
                .is_none_or(|t| t > sekarang_ms - 2 * BATAS_TERLAMBAT_MS - 24 * 3_600_000)
        });
        let mut t = Vec::new();
        if self.dering.is_none() {
            // Yang sudah berbunyi di server dibunyikan `jadwal_baru`; yang terjawab luring tidak lagi.
            let mut abaikan = self.sudah.clone();
            abaikan.extend(self.jadwal.iter().filter(|i| i.status == "berbunyi" || self.luring.contains(&i.kunci)).filter_map(tanda));
            if let Some(j) = jagaan_berikutnya(&self.jadwal, sekarang_ms, &abaikan) {
                if j.pada <= sekarang_ms {
                    let i = j.item.clone();
                    t.push(self.mulai(&i, Sumber::Lokal));
                }
            }
        }
        t.extend(self.tanya_bila_waktunya(sekarang_ms));
        t
    }

    /// Soal luring terjawab di PC (PRD D8). Mengembalikan kunci dan id kejadian (bila diketahui)
    /// untuk dikirim ke `/api/perangkat/kejadian/<id>/luring` begitu daring.
    pub fn luring_lolos(&mut self) -> Option<(Dering, Tindakan)> {
        let d = self.dering.clone()?;
        self.luring.push(d.kunci.clone());
        let t = self.henti(AlasanHenti::LuringLolos);
        Some((d, t))
    }

    /// Id kejadian server untuk kunci (dipakai mengirim jawaban luring sesudah daring).
    pub fn id_untuk(&self, kunci: &str) -> Option<String> {
        self.jadwal.iter().find(|i| i.kunci == kunci).and_then(|i| i.kejadian_id.clone())
    }
}
