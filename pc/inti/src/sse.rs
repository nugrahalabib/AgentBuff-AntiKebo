//! Pengurai aliran `text/event-stream` (`GET /api/peristiwa`) yang menerima potongan sembarang
//! dari jaringan. Mengikuti aturan HTML Living Standard: baris `event:`, `data:` (boleh berulang,
//! digabung dengan baris baru), komentar `:` diabaikan, peristiwa dikirim pada baris kosong.

use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Peristiwa {
    pub nama: String,
    pub data: String,
}

#[derive(Debug, Default)]
pub struct Pengurai {
    sisa: String,
    nama: String,
    data: Vec<String>,
    /// `retry:` terakhir dari server (md), dipakai sebagai jeda sambung ulang.
    pub jeda_ulang_ms: Option<u64>,
}

impl Pengurai {
    pub fn baru() -> Self {
        Self::default()
    }

    /// Masukkan potongan teks; kembalikan peristiwa yang sudah lengkap.
    pub fn masukkan(&mut self, potongan: &str) -> Vec<Peristiwa> {
        self.sisa.push_str(potongan);
        let mut hasil = Vec::new();
        while let Some(pos) = self.sisa.find(['\n', '\r']) {
            // "\r\n" dihitung satu akhir baris; "\r" di ujung potongan ditunggu dulu.
            let lebar = if self.sisa[pos..].starts_with("\r\n") {
                2
            } else if self.sisa[pos..].starts_with('\r') && pos + 1 == self.sisa.len() {
                break;
            } else {
                1
            };
            let baris: String = self.sisa[..pos].to_string();
            self.sisa.drain(..pos + lebar);
            self.baris(&baris, &mut hasil);
        }
        hasil
    }

    fn baris(&mut self, baris: &str, hasil: &mut Vec<Peristiwa>) {
        if baris.is_empty() {
            if !self.data.is_empty() {
                let nama = if self.nama.is_empty() { "message".to_string() } else { std::mem::take(&mut self.nama) };
                hasil.push(Peristiwa { nama, data: self.data.join("\n") });
            }
            self.nama.clear();
            self.data.clear();
            return;
        }
        if baris.starts_with(':') {
            return;
        }
        let (kolom, nilai) = match baris.split_once(':') {
            Some((k, v)) => (k, v.strip_prefix(' ').unwrap_or(v)),
            None => (baris, ""),
        };
        match kolom {
            "event" => self.nama = nilai.to_string(),
            "data" => self.data.push(nilai.to_string()),
            "retry" => {
                if let Ok(n) = nilai.parse() {
                    self.jeda_ulang_ms = Some(n);
                }
            }
            _ => {}
        }
    }
}

/// Isi data peristiwa server: `k` = id kejadian, `d` = id lain (mis. perangkat yang dicabut).
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataPeristiwa {
    #[serde(default)]
    pub k: Option<String>,
    #[serde(default)]
    pub d: Option<String>,
    #[serde(default)]
    pub waktu_server: Option<String>,
}

pub fn data_peristiwa(p: &Peristiwa) -> DataPeristiwa {
    serde_json::from_str(&p.data).unwrap_or_default()
}

#[cfg(test)]
mod tes {
    use super::*;

    #[test]
    fn potongan_sembarang_dan_crlf() {
        let aliran = "retry: 3000\nevent: halo\ndata: {\"waktuServer\":\"2026-10-07T21:00:00.000Z\"}\n\n: detak\n\nevent: berbunyi\r\ndata: {\"k\":\"abc\",\"d\":null}\r\n\r\nevent: berhenti\rdata: {\"k\":\"abc\"}\r\n\n";
        // Potong di setiap posisi mungkin: hasil harus sama.
        for ukuran in 1..aliran.len() {
            let mut p = Pengurai::baru();
            let mut semua = Vec::new();
            let bait: Vec<char> = aliran.chars().collect();
            for c in bait.chunks(ukuran) {
                semua.extend(p.masukkan(&c.iter().collect::<String>()));
            }
            let nama: Vec<_> = semua.iter().map(|e| e.nama.as_str()).collect();
            assert_eq!(nama, ["halo", "berbunyi", "berhenti"], "ukuran {ukuran}");
            assert_eq!(p.jeda_ulang_ms, Some(3000));
            assert_eq!(data_peristiwa(&semua[1]).k.as_deref(), Some("abc"));
        }
    }

    #[test]
    fn data_berbaris_banyak_dan_tanpa_nama() {
        let mut p = Pengurai::baru();
        let e = p.masukkan("data: a\ndata: b\nid: 7\n\ndata\n\n");
        assert_eq!(e, vec![Peristiwa { nama: "message".into(), data: "a\nb".into() }, Peristiwa { nama: "message".into(), data: "".into() }]);
        assert_eq!(data_peristiwa(&e[0]), DataPeristiwa::default());
    }
}
