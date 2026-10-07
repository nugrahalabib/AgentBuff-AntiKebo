//! Salinan jadwal 24 jam (`GET /api/perangkat/jadwal`) dan pengatur waktu lokal (docs/09 §5, §6).
//! Sama dengan Jam Meja web (`src/lib/jam-meja/jadwal-lokal.ts`): server diberi tenggang 5 detik;
//! bila kabar `berbunyi` belum datang, PC berbunyi sendiri. Tidak dobel karena memakai `kunci`.

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OmelanJadwal {
    pub jenis: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub menit: Option<u32>,
    pub teks: String,
    /// Hash klip siap unduh (`/api/perangkat/klip/<hash>`), atau None = dibacakan cadangan.
    pub klip: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SoalJadwal {
    pub jenis: String,
    pub tingkat: String,
    pub benar: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TundaJadwal {
    pub jatah: u32,
    pub menit: u32,
    pub terpakai: u32,
}

/// Satu kejadian dalam salinan jadwal (bentuk JSON server, camelCase).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemJadwal {
    pub kunci: String,
    pub kejadian_id: Option<String>,
    pub alarm_id: Option<String>,
    #[serde(with = "time::serde::rfc3339")]
    pub jadwal_utc: OffsetDateTime,
    pub tanggal: String,
    pub jam: String,
    pub status: String,
    pub judul: String,
    pub detail: Option<String>,
    pub bunyi: String,
    pub karakter: String,
    pub suara_id: Option<String>,
    pub soal: SoalJadwal,
    pub tunda: TundaJadwal,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub tunda_sampai: Option<OffsetDateTime>,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub cek_pada: Option<OffsetDateTime>,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub cek_batas: Option<OffsetDateTime>,
    pub uji: bool,
    /// Mode Komitmen: tombol Keluar dikunci mulai `kunci_mulai` (jam tidur) sampai alarm selesai.
    #[serde(default)]
    pub komitmen: bool,
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub kunci_mulai: Option<OffsetDateTime>,
    /// Awal siaga: jam tidur atau 8 jam sebelum alarm, mana yang lebih awal (docs/09 §5).
    #[serde(default, with = "time::serde::rfc3339::option")]
    pub siaga_mulai: Option<OffsetDateTime>,
    pub omelan: Vec<OmelanJadwal>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JawabanJadwal {
    #[serde(with = "time::serde::rfc3339")]
    pub waktu_server: OffsetDateTime,
    /// Nama sapaan pemilik ("Selamat pagi, Nugi!") dan bahasa pilihannya di AntiKebo.
    #[serde(default)]
    pub nama: String,
    #[serde(default = "bahasa_bawaan")]
    pub bahasa: String,
    pub kejadian: Vec<ItemJadwal>,
}

fn bahasa_bawaan() -> String {
    "id".into()
}

/// Server diberi 5 detik untuk mengabarkan `berbunyi` sebelum PC berbunyi sendiri.
pub const TENGGANG_LOKAL_MS: i64 = 5_000;
/// Jadwal yang lebih tua dari ini tidak dibunyikan lagi.
pub const BATAS_TERLAMBAT_MS: i64 = 30 * 60_000;
pub const JENDELA_JAGA_MS: i64 = 24 * 60 * 60_000;
/// Siaga dimulai 8 jam sebelum alarm terdekat (docs/09 §5).
pub const SIAGA_SEBELUM_MS: i64 = 8 * 60 * 60_000;

fn ms(t: OffsetDateTime) -> i64 {
    (t.unix_timestamp_nanos() / 1_000_000) as i64
}

/// Kapan item ini harus berbunyi menurut salinan jadwal (md epoch), atau None.
pub fn saat_bunyi(i: &ItemJadwal) -> Option<i64> {
    match i.status.as_str() {
        "menunggu" | "berbunyi" => Some(ms(i.jadwal_utc)),
        "ditunda" => i.tunda_sampai.map(ms),
        _ => None,
    }
}

/// Tanda satu dering: kunci kejadian + saat berbunyinya. Kejadian yang ditunda punya saat baru,
/// jadi berbunyi lagi; kejadian yang sama tidak pernah dibunyikan dua kali untuk saat yang sama.
pub fn tanda(i: &ItemJadwal) -> Option<String> {
    saat_bunyi(i).map(|t| format!("{}@{t}", i.kunci))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Jagaan<'a> {
    pub item: &'a ItemJadwal,
    /// Saat PC harus turun tangan bila server diam (md epoch).
    pub pada: i64,
}

/// Jagaan berikutnya: item paling dulu yang belum ditangani (`sudah` = tanda).
pub fn jagaan_berikutnya<'a>(jadwal: &'a [ItemJadwal], sekarang_ms: i64, sudah: &[String]) -> Option<Jagaan<'a>> {
    jadwal
        .iter()
        .filter(|i| tanda(i).is_some_and(|t| !sudah.contains(&t)))
        .filter_map(|i| {
            let t = saat_bunyi(i)?;
            if t < sekarang_ms - BATAS_TERLAMBAT_MS || t > sekarang_ms + JENDELA_JAGA_MS {
                return None;
            }
            Some(Jagaan { item: i, pada: (t + TENGGANG_LOKAL_MS).max(sekarang_ms) })
        })
        .min_by_key(|j| j.pada)
}

/// Alarm berikutnya (menunggu atau ditunda) untuk baki dan jendela pengaturan.
pub fn alarm_berikutnya(jadwal: &[ItemJadwal], sekarang_ms: i64) -> Option<&ItemJadwal> {
    jadwal
        .iter()
        .filter(|i| i.status == "menunggu" || i.status == "ditunda")
        .filter_map(|i| saat_bunyi(i).map(|t| (i, t)))
        .filter(|(_, t)| *t >= sekarang_ms - 60_000)
        .min_by_key(|(_, t)| *t)
        .map(|(i, _)| i)
}

fn hidup(i: &ItemJadwal) -> bool {
    matches!(i.status.as_str(), "berbunyi" | "ditunda" | "cek_bangun")
}

/// Masa siaga (docs/09 §5): ada alarm hidup (berbunyi, ditunda, cek), atau sudah lewat awal siaga
/// alarm yang menunggu (jam tidur atau 8 jam sebelumnya). Selama siaga PC dicegah tidur, detak
/// tiap 30 detik, dan penjaga menyala.
pub fn sedang_siaga(jadwal: &[ItemJadwal], sekarang_ms: i64) -> bool {
    jadwal.iter().any(|i| {
        hidup(i)
            || (i.status == "menunggu" && {
                let t = ms(i.jadwal_utc);
                let mulai = i.siaga_mulai.map(ms).unwrap_or(t - SIAGA_SEBELUM_MS);
                t >= sekarang_ms - BATAS_TERLAMBAT_MS && sekarang_ms >= mulai.min(t - SIAGA_SEBELUM_MS)
            })
    })
}

/// Tombol Keluar di baki dikunci (aturan teknis 2): selama ada alarm hidup (keluar = membungkam
/// alarm), dan selama jendela Mode Komitmen (jam tidur sampai jam alarm).
pub fn keluar_terkunci(jadwal: &[ItemJadwal], sekarang_ms: i64) -> bool {
    jadwal.iter().any(|i| {
        hidup(i)
            || (i.status == "menunggu"
                && i.komitmen
                && i.kunci_mulai.is_some_and(|m| ms(m) <= sekarang_ms)
                && sekarang_ms < ms(i.jadwal_utc) + BATAS_TERLAMBAT_MS)
    })
}

/// Pembaruan otomatis tidak pernah dipasang saat alarm hidup atau kurang dari 1 jam sebelum
/// alarm (docs/09 §8).
pub fn boleh_perbarui(jadwal: &[ItemJadwal], sekarang_ms: i64, sedang_berbunyi: bool) -> bool {
    !sedang_berbunyi && !jadwal.iter().any(|i| hidup(i) || saat_bunyi(i).is_some_and(|t| t >= sekarang_ms - BATAS_TERLAMBAT_MS && t - sekarang_ms < 3_600_000))
}

/// Benih urutan omelan dari id kejadian (FNV-1a 32 bit atas unit UTF-16 pertama tiap karakter),
/// sama dengan `benihDari` di server, supaya PC dan web memutar urutan yang sama.
pub fn benih_kejadian(id: &str) -> u32 {
    let mut h: u32 = 2_166_136_261;
    let mut buf = [0u16; 2];
    for c in id.chars() {
        let unit = c.encode_utf16(&mut buf)[0] as u32;
        h = (h ^ unit).wrapping_mul(16_777_619);
    }
    h
}

/// Bunyi "Naik perlahan": 10% ke 100% selama `naik_dtk` (sama dengan pemutar web).
pub fn penguat_naik(berlalu_ms: i64, naik_dtk: Option<u32>) -> f32 {
    match naik_dtk {
        Some(n) if n > 0 => (0.1 + 0.9 * (berlalu_ms.max(0) as f32 / (n as f32 * 1000.0))).min(1.0),
        _ => 1.0,
    }
}

/// Lama naik bunyi bawaan (`NAIK_DTK` di `src/lib/bunyi/berkas.ts`).
pub fn naik_dtk(bunyi: &str) -> Option<u32> {
    (bunyi == "naik").then_some(60)
}

/// Klip yang harus ada di PC untuk jadwal ini (hash, tanpa ganda, urut) + bunyi alarm yang dipakai.
pub fn kebutuhan_berkas(jadwal: &[ItemJadwal]) -> (Vec<String>, Vec<String>) {
    let mut klip: Vec<String> = jadwal.iter().flat_map(|i| i.omelan.iter().filter_map(|o| o.klip.clone())).collect();
    klip.sort();
    klip.dedup();
    let mut bunyi: Vec<String> = jadwal.iter().map(|i| i.bunyi.clone()).collect();
    bunyi.sort();
    bunyi.dedup();
    (klip, bunyi)
}
