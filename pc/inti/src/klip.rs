//! Simpanan klip omelan di PC (docs/10-SUARA.md §6): `%LOCALAPPDATA%\AntiKebo\klip\<hash>.klip`.
//! Kunci klip = hash isinya (SHA-256 hex), jadi berkas tidak pernah basi; yang tidak dipakai jadwal
//! selama 7 hari dibuang. Bunyi alarm dibundel di aplikasi, tidak pernah diunduh.

pub const SIMPAN_HARI: u64 = 7;
pub const AKHIRAN: &str = ".klip";

/// Hash klip sah: 64 huruf hex kecil (SHA-256). Mencegah jalur berkas aneh dari server.
pub fn hash_sah(h: &str) -> bool {
    h.len() == 64 && h.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn nama_berkas(hash: &str) -> Option<String> {
    hash_sah(hash).then(|| format!("{hash}{AKHIRAN}"))
}

/// Berkas di folder klip: nama + berapa detik sejak terakhir dipakai (waktu ubah berkas).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BerkasKlip {
    pub nama: String,
    pub umur_detik: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Rencana {
    /// Hash yang harus diunduh (belum ada).
    pub unduh: Vec<String>,
    /// Berkas yang masih dipakai: waktu ubahnya diperbarui supaya tidak ikut dibuang.
    pub sentuh: Vec<String>,
    /// Berkas yang dibuang (tidak dipakai jadwal dan lebih tua dari 7 hari, atau bukan klip).
    pub buang: Vec<String>,
}

/// Rencanakan unduh, sentuh, dan buang dari isi folder dan kebutuhan jadwal 24 jam.
pub fn rencanakan(ada: &[BerkasKlip], perlu: &[String]) -> Rencana {
    let mut r = Rencana::default();
    for h in perlu.iter().filter(|h| hash_sah(h)) {
        let nama = format!("{h}{AKHIRAN}");
        if ada.iter().any(|b| b.nama == nama) {
            r.sentuh.push(nama);
        } else if !r.unduh.contains(h) {
            r.unduh.push(h.clone());
        }
    }
    for b in ada {
        let dipakai = r.sentuh.contains(&b.nama);
        let klip = b.nama.strip_suffix(AKHIRAN).is_some_and(hash_sah);
        // Sisa unduhan terputus (`.sementara`) dan berkas asing juga dibuang bila sudah basi.
        if !dipakai && (!klip || b.umur_detik > SIMPAN_HARI * 24 * 3600) && (klip || b.umur_detik > 3600) {
            r.buang.push(b.nama.clone());
        }
    }
    r
}

#[cfg(test)]
mod tes {
    use super::*;

    fn h(c: char) -> String {
        c.to_string().repeat(64)
    }

    #[test]
    fn hash_dan_nama() {
        assert!(hash_sah(&h('a')));
        assert!(!hash_sah(&h('A')));
        assert!(!hash_sah("../../etc/passwd"));
        assert_eq!(nama_berkas(&h('0')).unwrap(), format!("{}.klip", h('0')));
        assert_eq!(nama_berkas("x"), None);
    }

    #[test]
    fn unduh_sentuh_buang() {
        let hari = 24 * 3600;
        let ada = vec![
            BerkasKlip { nama: format!("{}.klip", h('a')), umur_detik: 30 * hari },
            BerkasKlip { nama: format!("{}.klip", h('b')), umur_detik: 8 * hari },
            BerkasKlip { nama: format!("{}.klip", h('c')), umur_detik: 2 * hari },
            BerkasKlip { nama: "sisa.sementara".into(), umur_detik: 7200 },
            BerkasKlip { nama: "baru.sementara".into(), umur_detik: 60 },
        ];
        let r = rencanakan(&ada, &[h('a'), h('d'), h('d'), "jahat/../x".into()]);
        assert_eq!(r.unduh, vec![h('d')]);
        assert_eq!(r.sentuh, vec![format!("{}.klip", h('a'))]);
        // b: tidak dipakai dan > 7 hari; c: belum 7 hari; sementara > 1 jam dibuang.
        assert_eq!(r.buang, vec![format!("{}.klip", h('b')), "sisa.sementara".to_string()]);
    }
}
