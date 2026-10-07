//! Aksi saat laptop ditutup (docs/09 §7): dibaca dari keluaran `powercfg /q SCHEME_CURRENT
//! SUB_BUTTONS LIDACTION`. Label keluaran mengikuti bahasa Windows, jadi yang dibaca hanya dua
//! nilai hex terakhir (selalu urutan AC lalu DC).

/// Nilai aksi tutup laptop: 0 = tidak melakukan apa-apa, 1 = tidur, 2 = hibernasi, 3 = matikan.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AksiTutup {
    pub dicas: u32,
    pub baterai: u32,
}

impl AksiTutup {
    /// Laptop ditutup sambil dicas membuat PC tidur/mati = alarm PC tidak bisa berbunyi.
    pub fn perlu_diperbaiki(&self) -> bool {
        self.dicas != 0
    }
}

pub fn baca_aksi_tutup(keluaran: &str) -> Option<AksiTutup> {
    let nilai: Vec<u32> = keluaran
        .lines()
        .filter_map(|b| {
            let (_, kanan) = b.rsplit_once(':')?;
            let h = kanan.trim().strip_prefix("0x")?;
            u32::from_str_radix(h, 16).ok()
        })
        .collect();
    match nilai.as_slice() {
        [.., ac, dc] if nilai.len() >= 2 && *ac <= 4 && *dc <= 4 => Some(AksiTutup { dicas: *ac, baterai: *dc }),
        _ => None,
    }
}

/// Perintah perbaikan satu klik: hanya nilai saat dicas yang diubah ke "tidak melakukan apa-apa".
pub const PERBAIKI_TUTUP: [&[&str]; 2] = [&["/setacvalueindex", "SCHEME_CURRENT", "SUB_BUTTONS", "LIDACTION", "0"], &["/setactive", "SCHEME_CURRENT"]];

#[cfg(test)]
mod tes {
    use super::*;

    const INGGRIS: &str = "Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)\r\n  Subgroup GUID: 4f971e89-eebd-4455-a8de-9e59040e7347  (Power buttons and lid)\r\n    GUID Alias: SUB_BUTTONS\r\n    Power Setting GUID: 5ca83367-6e45-459f-a27b-476b1d01c936  (Lid close action)\r\n      GUID Alias: LIDACTION\r\n      Possible Setting Index: 000\r\n      Possible Setting Friendly Name: Do nothing\r\n      Possible Setting Index: 001\r\n      Possible Setting Friendly Name: Sleep\r\n    Current AC Power Setting Index: 0x00000001\r\n    Current DC Power Setting Index: 0x00000001\r\n";
    const INDONESIA: &str = "    Indeks Pengaturan Daya AC Saat Ini: 0x00000000\n    Indeks Pengaturan Daya DC Saat Ini: 0x00000001\n";

    #[test]
    fn baca_bahasa_apa_pun() {
        assert_eq!(baca_aksi_tutup(INGGRIS), Some(AksiTutup { dicas: 1, baterai: 1 }));
        assert!(baca_aksi_tutup(INGGRIS).unwrap().perlu_diperbaiki());
        assert_eq!(baca_aksi_tutup(INDONESIA), Some(AksiTutup { dicas: 0, baterai: 1 }));
        assert!(!baca_aksi_tutup(INDONESIA).unwrap().perlu_diperbaiki());
        // PC meja tanpa tutup: powercfg galat, tidak ada nilai.
        assert_eq!(baca_aksi_tutup("The power scheme, subgroup or setting specified does not exist."), None);
    }
}
