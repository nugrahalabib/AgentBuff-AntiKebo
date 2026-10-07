//! Penjaga (docs/09 §3 butir 3): `AntiKebo.exe --penjaga <pid> <folder>` adalah proses kecil
//! terpisah tanpa jendela. Selama siaga, penjaga dan proses utama saling mengawasi; bila salah
//! satu mati, yang lain menyalakannya lagi dalam ±1 detik. Keluar sah (di luar siaga) menulis
//! berkas `keluar-sah`, permintaan berhenti dari proses utama menulis `penjaga-henti`.

use antikebo_inti::penjaga::{Keputusan, Penjaga, BERKAS_KELUAR};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const BERKAS_HENTI: &str = "penjaga-henti";

fn sekarang_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

#[cfg(windows)]
pub fn hidup(pid: u32) -> bool {
    use windows::Win32::Foundation::{CloseHandle, STILL_ACTIVE};
    use windows::Win32::System::Threading::{GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    unsafe {
        let Ok(h) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else { return false };
        let mut kode = 0u32;
        let ok = GetExitCodeProcess(h, &mut kode).is_ok() && kode == STILL_ACTIVE.0 as u32;
        let _ = CloseHandle(h);
        ok
    }
}

#[cfg(not(windows))]
pub fn hidup(pid: u32) -> bool {
    // Proses zombi (sudah keluar, belum ditunggu) dianggap mati.
    std::fs::read_to_string(format!("/proc/{pid}/stat")).is_ok_and(|s| s.rsplit_once(')').is_some_and(|(_, sisa)| !sisa.trim_start().starts_with('Z')))
}

fn nyalakan(args: &[String]) -> Option<u32> {
    let exe = std::env::current_exe().ok()?;
    let mut c = Command::new(exe);
    c.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0000_0008); // DETACHED_PROCESS
    }
    c.spawn().ok().map(|a| a.id())
}

/// Proses utama: nyalakan penjaga yang mengawasi proses ini.
pub fn nyalakan_penjaga(folder: &Path) -> Option<u32> {
    let _ = std::fs::remove_file(folder.join(BERKAS_HENTI));
    nyalakan(&["--penjaga".into(), std::process::id().to_string(), folder.display().to_string()])
}

/// Proses utama: minta penjaga berhenti (siaga selesai).
pub fn hentikan_penjaga(folder: &Path) {
    let _ = std::fs::write(folder.join(BERKAS_HENTI), b"1");
}

/// Proses utama keluar dengan sah: penjaga ikut berhenti, tidak menyalakan ulang.
pub fn tandai_keluar_sah(folder: &Path) {
    let _ = std::fs::write(folder.join(BERKAS_KELUAR), b"1");
}

pub fn hapus_tanda_keluar(folder: &Path) {
    let _ = std::fs::remove_file(folder.join(BERKAS_KELUAR));
}

/// Badan proses penjaga.
pub fn jalankan(pid: u32, folder: PathBuf) {
    let dijaga = pid;
    let mut p = Penjaga::baru();
    loop {
        std::thread::sleep(Duration::from_secs(1));
        if folder.join(BERKAS_HENTI).exists() {
            let _ = std::fs::remove_file(folder.join(BERKAS_HENTI));
            return;
        }
        match p.periksa(hidup(dijaga), folder.join(BERKAS_KELUAR).exists(), sekarang_ms()) {
            Keputusan::Tunggu => {}
            Keputusan::Selesai => return,
            Keputusan::NyalakanUlang => {
                // Proses utama baru menyalakan penjaganya sendiri; penjaga ini selesai.
                if nyalakan(&["--dari-penjaga".into()]).is_some() {
                    return;
                }
            }
        }
    }
}
