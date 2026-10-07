//! Penyimpanan lokal: token perangkat di Windows Credential Manager (docs/09 §2), antrean jawaban
//! luring, dan folder data aplikasi. Di luar Windows (pengembangan/tes) token disimpan di berkas
//! dengan izin pemilik saja.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const NAMA_KREDENSIAL: &str = "AntiKebo/perangkat";

#[cfg(windows)]
mod kredensial {
    use super::NAMA_KREDENSIAL;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    fn nama() -> Vec<u16> {
        NAMA_KREDENSIAL.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn simpan(token: &str) -> bool {
        let mut n = nama();
        let mut isi = token.as_bytes().to_vec();
        let c = CREDENTIALW {
            Flags: CRED_FLAGS(0),
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(n.as_mut_ptr()),
            CredentialBlobSize: isi.len() as u32,
            CredentialBlob: isi.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            ..Default::default()
        };
        unsafe { CredWriteW(&c, 0).is_ok() }
    }

    pub fn baca() -> Option<String> {
        let n = nama();
        let mut p: *mut CREDENTIALW = std::ptr::null_mut();
        unsafe {
            CredReadW(PCWSTR(n.as_ptr()), CRED_TYPE_GENERIC, None, &mut p).ok()?;
            let c = &*p;
            let isi = std::slice::from_raw_parts(c.CredentialBlob, c.CredentialBlobSize as usize).to_vec();
            CredFree(p as *const _);
            String::from_utf8(isi).ok()
        }
    }

    pub fn hapus() {
        let n = nama();
        unsafe {
            let _ = CredDeleteW(PCWSTR(n.as_ptr()), CRED_TYPE_GENERIC, None);
        }
    }
}

#[cfg(not(windows))]
mod kredensial {
    use super::NAMA_KREDENSIAL;
    use std::path::PathBuf;

    fn berkas() -> Option<PathBuf> {
        let d = std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
        Some(d.join("antikebo-pc").join(NAMA_KREDENSIAL.replace('/', "-")))
    }

    pub fn simpan(token: &str) -> bool {
        let Some(b) = berkas() else { return false };
        if let Some(d) = b.parent() {
            let _ = std::fs::create_dir_all(d);
        }
        if std::fs::write(&b, token).is_err() {
            return false;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&b, std::fs::Permissions::from_mode(0o600));
        }
        true
    }

    pub fn baca() -> Option<String> {
        std::fs::read_to_string(berkas()?).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
    }

    pub fn hapus() {
        if let Some(b) = berkas() {
            let _ = std::fs::remove_file(b);
        }
    }
}

pub fn simpan_token(token: &str) -> bool {
    kredensial::simpan(token)
}

pub fn baca_token() -> Option<String> {
    kredensial::baca().filter(|t| antikebo_inti::api::token_sah(t))
}

pub fn hapus_token() {
    kredensial::hapus()
}

/// Jawaban soal luring yang menunggu dikirim (PRD D8). Disimpan di berkas supaya tidak hilang
/// bila aplikasi dinyalakan ulang sebelum internet kembali.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KirimLuring {
    pub kunci: String,
    pub kejadian_id: Option<String>,
    pub jawaban: Vec<String>,
}

pub fn baca_antrean(folder: &Path) -> Vec<KirimLuring> {
    std::fs::read(folder.join("luring.json")).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

pub fn simpan_antrean(folder: &Path, a: &[KirimLuring]) {
    let _ = std::fs::create_dir_all(folder);
    let _ = std::fs::write(folder.join("luring.json"), serde_json::to_vec(a).unwrap_or_default());
}

pub fn folder_klip(folder: &Path) -> PathBuf {
    folder.join("klip")
}

/// Nama PC untuk layar persetujuan di web ("Sambungkan PC ini?"), paling panjang 40 huruf.
pub fn nama_pc() -> String {
    let n = std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_default();
    let n = n.trim();
    let nama = if n.is_empty() { "PC".to_string() } else { format!("PC {n}") };
    nama.chars().take(40).collect()
}
