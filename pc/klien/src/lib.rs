//! Klien HTTP ke server AntiKebo (docs/09 §4): kode sambung, jadwal, detak, klip, soal, SSE.
//! Token perangkat dikirim sebagai `Authorization: Bearer` dan tidak pernah dicatat. Crate
//! terpisah tanpa Tauri supaya bisa dites ujung ke ujung di Linux (`src/bin/uji-pc.rs`).

use antikebo_inti::api::{AmbilKode, Detak, GalatApi, HasilAmbil, JawabKode, MintaKode};
use antikebo_inti::jadwal::JawabanJadwal;
use antikebo_inti::sse::{Pengurai, Peristiwa};
use bytes::Bytes;
use futures_util::stream::BoxStream;
use futures_util::StreamExt;
use reqwest::{Client, Method, StatusCode};
use serde_json::Value;
use std::collections::VecDeque;
use std::time::Duration;

/// Server AntiKebo. Build uji boleh mengarah ke server lain lewat `ANTIKEBO_ASAL` saat kompilasi;
/// build debug juga lewat variabel lingkungan saat jalan (mis. `http://localhost:3100`).
pub fn asal() -> String {
    if cfg!(debug_assertions) {
        if let Ok(a) = std::env::var("ANTIKEBO_ASAL") {
            return a.trim_end_matches('/').to_string();
        }
    }
    option_env!("ANTIKEBO_ASAL").unwrap_or("https://antikebo.agentbuff.id").trim_end_matches('/').to_string()
}

#[derive(Debug)]
pub enum Galat {
    /// Tidak bisa menghubungi server (internet putus, server mati, waktu habis).
    Jaringan,
    /// Token dicabut dari web (Putuskan) atau tidak sah: kembali ke layar Sambungkan.
    TokenTidakBerlaku,
    /// Server menjawab galat dengan pesan ramah.
    Server { pesan: String },
}

impl Galat {
    pub fn pesan(&self) -> Option<&str> {
        match self {
            Galat::Server { pesan, .. } if !pesan.is_empty() => Some(pesan),
            _ => None,
        }
    }
}

#[derive(Clone)]
pub struct Klien {
    asal: String,
    http: Client,
    /// Tanpa batas waktu baca: aliran SSE tetap terbuka.
    aliran: Client,
}

const AGEN: &str = concat!("AntiKebo-PC/", env!("CARGO_PKG_VERSION"));

impl Klien {
    pub fn baru() -> Self {
        Self::ke(asal())
    }

    pub fn ke(asal: String) -> Self {
        let http = Client::builder().user_agent(AGEN).connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(30)).build().expect("klien http");
        let aliran = Client::builder().user_agent(AGEN).connect_timeout(Duration::from_secs(10)).build().expect("klien aliran");
        Self { asal, http, aliran }
    }

    fn url(&self, jalur: &str) -> String {
        format!("{}{jalur}", self.asal)
    }

    async fn periksa(r: reqwest::Response) -> Result<reqwest::Response, Galat> {
        let status = r.status();
        if status.is_success() {
            return Ok(r);
        }
        if status == StatusCode::UNAUTHORIZED {
            return Err(Galat::TokenTidakBerlaku);
        }
        let g: Option<GalatApi> = r.json().await.ok();
        Err(Galat::Server { pesan: g.map(|g| g.pesan).unwrap_or_default() })
    }

    pub async fn minta_kode(&self, nama: &str) -> Result<JawabKode, Galat> {
        let r = self
            .http
            .post(self.url("/api/perangkat/kode"))
            .json(&MintaKode { nama, versi: env!("CARGO_PKG_VERSION") })
            .send()
            .await
            .map_err(|_| Galat::Jaringan)?;
        Self::periksa(r).await?.json().await.map_err(|_| Galat::Jaringan)
    }

    pub async fn ambil_kode(&self, kode: &str, rahasia: &str) -> Result<HasilAmbil, Galat> {
        let r = self.http.post(self.url("/api/perangkat/kode/ambil")).json(&AmbilKode { kode, rahasia }).send().await.map_err(|_| Galat::Jaringan)?;
        if r.status() == StatusCode::GONE {
            return Ok(HasilAmbil::Kedaluwarsa);
        }
        Self::periksa(r).await?.json().await.map_err(|_| Galat::Jaringan)
    }

    pub async fn jadwal(&self, token: &str) -> Result<JawabanJadwal, Galat> {
        let r = self.http.get(self.url("/api/perangkat/jadwal")).bearer_auth(token).send().await.map_err(|_| Galat::Jaringan)?;
        Self::periksa(r).await?.json().await.map_err(|_| Galat::Jaringan)
    }

    pub async fn detak(&self, token: &str, d: &Detak) -> Result<(), Galat> {
        let r = self.http.post(self.url("/api/perangkat/detak")).bearer_auth(token).json(d).send().await.map_err(|_| Galat::Jaringan)?;
        Self::periksa(r).await.map(|_| ())
    }

    pub async fn klip(&self, token: &str, hash: &str) -> Result<Vec<u8>, Galat> {
        let r = self.http.get(self.url(&format!("/api/perangkat/klip/{hash}"))).bearer_auth(token).send().await.map_err(|_| Galat::Jaringan)?;
        Ok(Self::periksa(r).await?.bytes().await.map_err(|_| Galat::Jaringan)?.to_vec())
    }

    /// Panggilan soal dari jendela alarm (jalurnya sudah diperiksa `jalur_jendela_sah`).
    pub async fn api(&self, token: &str, metode: &str, jalur: &str, isi: Option<Value>) -> Result<(u16, Value), Galat> {
        let m = Method::from_bytes(metode.as_bytes()).map_err(|_| Galat::Jaringan)?;
        let mut q = self.http.request(m, self.url(jalur)).bearer_auth(token);
        if let Some(v) = isi {
            q = q.json(&v);
        }
        let r = q.send().await.map_err(|_| Galat::Jaringan)?;
        let status = r.status();
        if status == StatusCode::UNAUTHORIZED {
            return Err(Galat::TokenTidakBerlaku);
        }
        let v: Value = r.json().await.unwrap_or(Value::Null);
        Ok((status.as_u16(), v))
    }

    pub async fn luring(&self, token: &str, kejadian_id: &str, jawaban: &[String]) -> Result<bool, Galat> {
        let r = self
            .http
            .post(self.url(&format!("/api/perangkat/kejadian/{kejadian_id}/luring")))
            .bearer_auth(token)
            .json(&serde_json::json!({ "jawaban": jawaban }))
            .send()
            .await
            .map_err(|_| Galat::Jaringan)?;
        let v: Value = Self::periksa(r).await?.json().await.map_err(|_| Galat::Jaringan)?;
        Ok(v.get("lolos").and_then(Value::as_bool).unwrap_or(false))
    }

    /// Buka aliran peristiwa (`GET /api/peristiwa`).
    pub async fn peristiwa(&self, token: &str) -> Result<Aliran, Galat> {
        let r =
            self.aliran.get(self.url("/api/peristiwa")).bearer_auth(token).header("Accept", "text/event-stream").send().await.map_err(|_| Galat::Jaringan)?;
        let r = Self::periksa(r).await?;
        Ok(Aliran { isi: r.bytes_stream().boxed(), pengurai: Pengurai::baru(), bait: Vec::new(), antre: VecDeque::new() })
    }
}

/// Aliran SSE yang sudah diurai. Server mengirim detak tiap 20 detik; 60 detik sunyi = putus.
pub struct Aliran {
    isi: BoxStream<'static, reqwest::Result<Bytes>>,
    pengurai: Pengurai,
    bait: Vec<u8>,
    antre: VecDeque<Peristiwa>,
}

impl Aliran {
    /// Peristiwa berikutnya, atau None bila sambungan putus.
    pub async fn berikut(&mut self) -> Option<Peristiwa> {
        loop {
            if let Some(e) = self.antre.pop_front() {
                return Some(e);
            }
            let b = tokio::time::timeout(Duration::from_secs(60), self.isi.next()).await.ok()??.ok()?;
            self.bait.extend_from_slice(&b);
            // Potongan jaringan bisa memotong huruf UTF-8 di tengah: sisanya ditunggu.
            let sah = match std::str::from_utf8(&self.bait) {
                Ok(s) => s.len(),
                Err(e) => e.valid_up_to(),
            };
            let teks = String::from_utf8_lossy(&self.bait[..sah]).into_owned();
            self.bait.drain(..sah);
            self.antre.extend(self.pengurai.masukkan(&teks));
        }
    }

    /// Jeda sambung ulang dari server (`retry:`).
    pub fn jeda_ulang_ms(&self) -> Option<u64> {
        self.pengurai.jeda_ulang_ms
    }
}
