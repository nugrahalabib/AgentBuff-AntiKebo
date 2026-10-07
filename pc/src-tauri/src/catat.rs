//! Catatan kecil untuk menelusuri masalah di PC pengguna (uji manual L2): `antikebo.log` di folder
//! data aplikasi, paling besar 1 MB (lalu diputar ke `antikebo.log.1`). Tidak pernah berisi token,
//! rahasia, atau isi soal.

use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

static BERKAS: OnceLock<PathBuf> = OnceLock::new();

pub fn pasang(folder: &std::path::Path) {
    let _ = BERKAS.set(folder.join("antikebo.log"));
}

pub fn catat(pesan: &str) {
    let waktu = time::OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).unwrap_or_default();
    if cfg!(debug_assertions) {
        eprintln!("[antikebo] {waktu} {pesan}");
    }
    let Some(b) = BERKAS.get() else { return };
    if std::fs::metadata(b).map(|m| m.len() > 1_000_000).unwrap_or(false) {
        let _ = std::fs::rename(b, b.with_extension("log.1"));
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(b) {
        let _ = writeln!(f, "{waktu} {pesan}");
    }
}
