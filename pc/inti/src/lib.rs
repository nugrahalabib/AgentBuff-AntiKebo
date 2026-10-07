//! Logika murni AntiKebo untuk PC (docs/09-APLIKASI-PC.md §9): tanpa Tauri, tanpa jaringan, tanpa
//! suara, supaya bisa dites di Linux. Aturan soal dan urutan suara SAMA dengan TypeScript dan
//! dibuktikan dengan berkas contoh emas yang sama (`tests/emas/*.json`, aturan teknis 9).

pub mod acak;
pub mod alarm;
pub mod api;
pub mod daya;
pub mod jadwal;
pub mod klip;
pub mod penjaga;
pub mod soal;
pub mod sse;
pub mod urutan;
