//! Bentuk JSON API perangkat (docs/09-APLIKASI-PC.md §4, `src/app/api/perangkat/*`). Dipakai proses
//! utama; jendela alarm hanya boleh memanggil jalur soal kejadian lewat proses utama
//! (`jalur_jendela_sah`), token tidak pernah sampai ke WebView.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct MintaKode<'a> {
    pub nama: &'a str,
    pub versi: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct JawabKode {
    pub kode: String,
    pub rahasia: String,
    pub kedaluwarsa: String,
    pub tautan: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AmbilKode<'a> {
    pub kode: &'a str,
    pub rahasia: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct PerangkatTersambung {
    pub id: String,
    pub nama: String,
}

/// Jawaban `POST /api/perangkat/kode/ambil`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum HasilAmbil {
    Menunggu,
    Tersambung { token: String, perangkat: PerangkatTersambung },
    Kedaluwarsa,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Kemampuan {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dicas: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub baterai: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suara: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layar_menyala: Option<bool>,
}

/// Isi `POST /api/perangkat/detak` (tiap 30 detik).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Detak {
    pub versi: String,
    pub kemampuan: Kemampuan,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub siap_sampai: Option<String>,
}

/// Galat API (`{ galat, pesan }`). `pesan` sudah ramah untuk pengguna.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct GalatApi {
    pub galat: String,
    #[serde(default)]
    pub pesan: String,
}

/// Token perangkat sah (`antikebo_pc_` + 43 karakter base64url), sama dengan `POLA_TOKEN_PERANGKAT`.
pub fn token_sah(t: &str) -> bool {
    t.strip_prefix("antikebo_pc_").is_some_and(|s| s.len() == 43 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'))
}

fn uuid_sah(s: &str) -> bool {
    s.len() == 36
        && s.bytes().enumerate().all(|(i, b)| match i {
            8 | 13 | 18 | 23 => b == b'-',
            _ => b.is_ascii_hexdigit(),
        })
}

/// Jalur API yang boleh dipanggil jendela alarm lewat proses utama (dengan token perangkat):
/// HANYA soal kejadian (lihat, jawab, tunda, ganti soal, Masih bangun). Tidak ada jalur lain,
/// jadi isi WebView tidak bisa memakai token untuk hal lain. Jawaban luring dikirim proses utama.
pub fn jalur_jendela_sah(metode: &str, jalur: &str) -> bool {
    let Some((id, aksi)) = jalur.strip_prefix("/api/kejadian/").and_then(|s| s.split_once('/')) else {
        return false;
    };
    uuid_sah(id) && matches!((metode, aksi), ("GET", "soal" | "soal?tujuan=tunda") | ("POST", "jawab" | "ganti-soal" | "masih-bangun"))
}

#[cfg(test)]
mod tes {
    use super::*;

    #[test]
    fn hasil_ambil_tiga_bentuk() {
        let m: HasilAmbil = serde_json::from_str(r#"{"status":"menunggu"}"#).unwrap();
        assert_eq!(m, HasilAmbil::Menunggu);
        let t: HasilAmbil = serde_json::from_str(r#"{"status":"tersambung","token":"antikebo_pc_x","perangkat":{"id":"a","nama":"PC Nugi"}}"#).unwrap();
        assert!(matches!(t, HasilAmbil::Tersambung { ref token, .. } if token == "antikebo_pc_x"));
        let k: HasilAmbil = serde_json::from_str(r#"{"status":"kedaluwarsa"}"#).unwrap();
        assert_eq!(k, HasilAmbil::Kedaluwarsa);
    }

    #[test]
    fn detak_camel_case_tanpa_nilai_kosong() {
        let d = Detak {
            versi: "0.1.0".into(),
            kemampuan: Kemampuan { dicas: Some(true), baterai: Some(80.0), suara: Some(true), layar_menyala: None },
            siap_sampai: None,
        };
        assert_eq!(serde_json::to_string(&d).unwrap(), r#"{"versi":"0.1.0","kemampuan":{"dicas":true,"baterai":80.0,"suara":true}}"#);
    }

    #[test]
    fn token_dan_jalur() {
        assert!(token_sah(&format!("antikebo_pc_{}", "A".repeat(43))));
        assert!(!token_sah(&format!("antikebo_pc_{}", "A".repeat(42))));
        assert!(!token_sah(&format!("antikebo_pc_{}!", "A".repeat(42))));
        let id = "0b5a6e1e-6f39-4b5c-9a33-1c2d3e4f5a6b";
        assert!(jalur_jendela_sah("GET", &format!("/api/kejadian/{id}/soal")));
        assert!(jalur_jendela_sah("GET", &format!("/api/kejadian/{id}/soal?tujuan=tunda")));
        assert!(jalur_jendela_sah("POST", &format!("/api/kejadian/{id}/jawab")));
        assert!(jalur_jendela_sah("POST", &format!("/api/kejadian/{id}/masih-bangun")));
        assert!(!jalur_jendela_sah("POST", &format!("/api/perangkat/kejadian/{id}/luring")));
        // Bukan soal: ditolak (WebView tidak bisa memakai token untuk mengubah alarm atau mencabut).
        assert!(!jalur_jendela_sah("GET", &format!("/api/kejadian/{id}/jawab")));
        assert!(!jalur_jendela_sah("POST", "/api/app/alarm"));
        assert!(!jalur_jendela_sah("POST", &format!("/api/kejadian/{id}/../../app/alarm")));
        assert!(!jalur_jendela_sah("POST", "/api/kejadian/bukan-uuid/jawab"));
        assert!(!jalur_jendela_sah("POST", &format!("/api/perangkat/kejadian/{id}/jawab")));
        assert!(!jalur_jendela_sah("DELETE", &format!("/api/kejadian/{id}/soal")));
    }
}
