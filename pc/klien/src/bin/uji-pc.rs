//! Penguji ujung ke ujung aplikasi PC tanpa jendela (dipakai `tests/e2e/pc.spec.ts`): kode yang
//! SAMA dengan aplikasi Windows (klien, pengurai SSE, mesin alarm, soal luring) melawan server
//! dan worker sungguhan. Menulis baris status ke stdout:
//!
//!   KODE <kode>          minta disetujui di browser
//!   TERSAMBUNG           token perangkat diterima (disimpan di berkas UJI_TOKEN)
//!   SIAP                 jadwal + detak + SSE tersambung
//!   BERBUNYI <sumber>    mesin membunyikan alarm (server/lokal)
//!   JAWAB <hasil>        jawaban soal server
//!   LURING <lolos>       jawaban soal luring dikirim
//!   BERHENTI <alasan>    mesin menghentikan bunyi
//!   SELESAI              alarm tidak aktif lagi di server
//!
//! Pemakaian: `uji-pc <server|luring>` dengan ANTIKEBO_ASAL dan UJI_TOKEN.

use antikebo_inti::alarm::{AlasanHenti, Mesin, Sumber, Tindakan};
use antikebo_inti::api::{Detak, HasilAmbil, Kemampuan};
use antikebo_inti::jadwal::ItemJadwal;
use antikebo_inti::soal::{sesudah_jawab, soal_luring, KeadaanUrutan, Tingkat};
use antikebo_inti::sse::data_peristiwa;
use antikebo_klien::{asal, Klien};
use serde_json::json;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64
}

fn gagal(pesan: &str) -> ! {
    eprintln!("GAGAL {pesan}");
    std::process::exit(1)
}

/// Hitung soal hitungan dari teksnya (+, −, ×, ², kurung).
fn hitung(teks: &str) -> i64 {
    let t: Vec<char> = teks.chars().filter(|c| !c.is_whitespace()).collect();
    fn ekspresi(t: &[char], i: &mut usize) -> i64 {
        let mut v = suku(t, i);
        while *i < t.len() && (t[*i] == '+' || t[*i] == '\u{2212}') {
            let op = t[*i];
            *i += 1;
            let w = suku(t, i);
            v = if op == '+' { v + w } else { v - w };
        }
        v
    }
    fn suku(t: &[char], i: &mut usize) -> i64 {
        let mut v = faktor(t, i);
        while *i < t.len() && t[*i] == '\u{00d7}' {
            *i += 1;
            v *= faktor(t, i);
        }
        v
    }
    fn faktor(t: &[char], i: &mut usize) -> i64 {
        let v = if t[*i] == '(' {
            *i += 1;
            let v = ekspresi(t, i);
            *i += 1;
            v
        } else {
            let mulai = *i;
            while *i < t.len() && t[*i].is_ascii_digit() {
                *i += 1;
            }
            t[mulai..*i].iter().collect::<String>().parse().unwrap()
        };
        if *i < t.len() && t[*i] == '\u{00b2}' {
            *i += 1;
            return v * v;
        }
        v
    }
    let mut i = 0;
    ekspresi(&t, &mut i)
}

async fn sambung(k: &Klien, berkas: &str) -> String {
    if let Ok(t) = std::fs::read_to_string(berkas) {
        if k.jadwal(t.trim()).await.is_ok() {
            return t.trim().to_string();
        }
    }
    let j = k.minta_kode("PC Uji").await.unwrap_or_else(|_| gagal("minta kode"));
    println!("KODE {}", j.kode);
    let batas = Instant::now() + Duration::from_secs(60);
    while Instant::now() < batas {
        tokio::time::sleep(Duration::from_secs(1)).await;
        if let Ok(HasilAmbil::Tersambung { token, .. }) = k.ambil_kode(&j.kode, &j.rahasia).await {
            std::fs::write(berkas, &token).unwrap();
            println!("TERSAMBUNG");
            return token;
        }
    }
    gagal("tidak disetujui")
}

async fn jawab_server(k: &Klien, token: &str, id: &str) {
    for _ in 0..12 {
        let (s, v) = k.api(token, "GET", &format!("/api/kejadian/{id}/soal"), None).await.unwrap_or_else(|_| gagal("ambil soal"));
        if s != 200 {
            // Server belum membunyikan (PC lebih dulu): tunggu sebentar.
            tokio::time::sleep(Duration::from_millis(500)).await;
            continue;
        }
        let soal = &v["soal"];
        let jawaban = hitung(soal["tampil"]["teks"].as_str().unwrap_or_default()).to_string();
        let (s, h) = k
            .api(token, "POST", &format!("/api/kejadian/{id}/jawab"), Some(json!({ "soalId": soal["id"], "jawaban": jawaban })))
            .await
            .unwrap_or_else(|_| gagal("jawab"));
        let hasil = h["hasil"].as_str().unwrap_or("galat");
        println!("JAWAB {hasil}");
        if s == 200 && hasil == "selesai" {
            return;
        }
    }
    gagal("soal server tidak terjawab")
}

async fn jawab_luring(k: &Klien, token: &str, m: &mut Mesin, item: &ItemJadwal) {
    // Soal luring dibuat dari kunci kejadian; PC menjawab semuanya benar.
    let tingkat = Tingkat::dari_teks(&item.soal.tingkat).unwrap_or(Tingkat::Sedang);
    let mut kd = KeadaanUrutan { tingkat, benar_beruntun: 0, salah_beruntun: 0 };
    let mut jawaban = Vec::new();
    while kd.benar_beruntun < item.soal.benar.max(1) {
        let s = soal_luring(&item.kunci, jawaban.len() as u32, kd.tingkat);
        jawaban.push(s.jawaban.clone());
        kd = sesudah_jawab(kd, true);
    }
    let (d, t) = m.luring_lolos().unwrap_or_else(|| gagal("tidak berbunyi"));
    assert_eq!(t, Tindakan::Hentikan(AlasanHenti::LuringLolos));
    println!("BERHENTI luring");
    let id = d.kejadian_id.or_else(|| m.id_untuk(&d.kunci)).unwrap_or_else(|| gagal("id kejadian"));
    let lolos = k.luring(token, &id, &jawaban).await.unwrap_or_else(|_| gagal("kirim luring"));
    println!("LURING {lolos}");
}

#[tokio::main]
async fn main() {
    let mode = std::env::args().nth(1).unwrap_or_else(|| "server".into());
    let berkas = std::env::var("UJI_TOKEN").unwrap_or_else(|_| gagal("UJI_TOKEN"));
    let k = Klien::ke(std::env::var("ANTIKEBO_ASAL").unwrap_or_else(|_| asal()));
    let token = sambung(&k, &berkas).await;
    let mut m = Mesin::baru();
    let g = m.generasi();
    let j = k.jadwal(&token).await.unwrap_or_else(|_| gagal("jadwal"));
    m.jadwal_baru(j.kejadian, ms(), g);
    k.detak(
        &token,
        &Detak {
            versi: "uji".into(),
            kemampuan: Kemampuan { dicas: Some(true), baterai: Some(90.0), suara: Some(true), layar_menyala: None },
            siap_sampai: None,
        },
    )
    .await
    .unwrap_or_else(|_| gagal("detak"));
    let mut aliran = k.peristiwa(&token).await.unwrap_or_else(|_| gagal("sse"));
    let halo = aliran.berikut().await.unwrap_or_else(|| gagal("halo"));
    assert_eq!(halo.nama, "halo");
    println!("SIAP");

    let batas = Instant::now() + Duration::from_secs(150);
    let mut sudah_jawab: Option<String> = None;
    let mut detik = tokio::time::interval(Duration::from_secs(1));
    while Instant::now() < batas {
        let tindakan = tokio::select! {
            e = aliran.berikut() => {
                let e = e.unwrap_or_else(|| gagal("sse putus"));
                let d = data_peristiwa(&e);
                m.peristiwa(&e.nama, d.k.as_deref(), ms())
            }
            _ = detik.tick() => m.detik(ms()),
        };
        for t in tindakan {
            match t {
                Tindakan::TarikJadwal => {
                    let g = m.generasi();
                    let j = k.jadwal(&token).await.unwrap_or_else(|_| gagal("jadwal"));
                    let lagi = m.jadwal_baru(j.kejadian, ms(), g);
                    for x in lagi {
                        if let Tindakan::Hentikan(a) = x {
                            println!("BERHENTI {a:?}");
                        } else if let Tindakan::Bunyikan(_, s) = x {
                            println!("BERBUNYI {}", if s == Sumber::Server { "server" } else { "lokal" });
                        }
                    }
                    if let Some(kunci) = &sudah_jawab {
                        if !m.jadwal.iter().any(|i| &i.kunci == kunci && i.status != "menunggu") {
                            println!("SELESAI");
                            return;
                        }
                    }
                }
                Tindakan::Bunyikan(item, s) => {
                    println!("BERBUNYI {}", if s == Sumber::Server { "server" } else { "lokal" });
                    if mode == "luring" {
                        jawab_luring(&k, &token, &mut m, &item).await;
                    } else {
                        let id = item.kejadian_id.clone().or_else(|| m.id_untuk(&item.kunci)).unwrap_or_else(|| gagal("id kejadian"));
                        jawab_server(&k, &token, &id).await;
                    }
                    sudah_jawab = Some(item.kunci.clone());
                }
                Tindakan::Hentikan(a) => println!("BERHENTI {a:?}"),
                _ => {}
            }
        }
    }
    gagal("waktu habis")
}

#[cfg(test)]
mod tes {
    #[test]
    fn hitung_semua_bentuk() {
        assert_eq!(super::hitung("12 + 30"), 42);
        assert_eq!(super::hitung("50 \u{2212} 8"), 42);
        assert_eq!(super::hitung("6 \u{00d7} 7 + 3"), 45);
        assert_eq!(super::hitung("(2 + 3) \u{00d7} 4 \u{2212} 5"), 15);
        assert_eq!(super::hitung("7\u{00b2} + 5"), 54);
    }
}
