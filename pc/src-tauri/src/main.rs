// AntiKebo untuk PC (docs/09-APLIKASI-PC.md). Tanpa jendela konsol di build rilis.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aplikasi;
mod catat;
mod jendela;
mod penjaga;
mod simpan;
mod sistem;
mod suara;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Some(i) = args.iter().position(|a| a == "--penjaga") {
        if let (Some(pid), Some(folder)) = (args.get(i + 1).and_then(|s| s.parse().ok()), args.get(i + 2)) {
            penjaga::jalankan(pid, folder.into());
        }
        return;
    }
    // Dinyalakan Windows saat masuk (autostart) atau oleh penjaga: langsung ke baki tanpa jendela.
    let diam = args.iter().any(|a| a == "--diam" || a == "--dari-penjaga");
    aplikasi::jalankan(diam);
}
