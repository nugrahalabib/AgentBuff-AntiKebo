//! Pemutar alarm PC (docs/10-SUARA.md §3, §5; docs/09 §6 butir 4). Dua lapisan dicampur rodio:
//! bunyi alarm berulang tanpa henti + omelan (klip AgentBuff, atau suara bawaan Windows bila
//! klip belum ada), diputar ke SEMUA perangkat keluaran aktif. Urutan omelan dari
//! `antikebo_inti::urutan` (sama dengan web). Bunyi alarm tidak pernah bergantung pada klip:
//! berkas bunyi gagal dibuka = nada bip buatan.

use antikebo_inti::jadwal::penguat_naik;
use antikebo_inti::urutan::{berikutnya, KeadaanUrutan, Waktu, JEDA_MS, REDAM_KE, REDAM_MS};
use rodio::cpal::traits::HostTrait;
use rodio::source::{SineWave, Source};
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct OmelanPutar {
    pub jenis: String,
    pub menit: Option<u32>,
    pub teks: String,
    pub klip: Option<PathBuf>,
}

#[derive(Debug, Clone)]
pub struct Rencana {
    pub bunyi: PathBuf,
    pub naik_dtk: Option<u32>,
    pub omelan: Vec<OmelanPutar>,
    pub benih: u32,
    /// Berapa lama alarm sudah berbunyi saat mulai diputar (kalimat waktu, naik perlahan).
    pub sudah_ms: u64,
    pub bahasa: String,
}

enum Perintah {
    Mulai(Rencana),
    Henti,
    Tes(PathBuf, Duration),
}

/// Kabar ke tampilan: teks omelan yang sedang diucapkan (None = jeda).
pub type SaatOmelan = Box<dyn Fn(Option<String>) + Send>;

#[derive(Clone)]
pub struct Pemutar {
    kirim: Sender<Perintah>,
}

impl Pemutar {
    pub fn nyalakan(saat_omelan: SaatOmelan) -> Self {
        let (kirim, terima) = channel::<Perintah>();
        std::thread::Builder::new()
            .name("antikebo-suara".into())
            .spawn(move || {
                crate::sistem::siapkan_com();
                let mut sesi: Option<Sesi> = None;
                loop {
                    match terima.recv_timeout(Duration::from_millis(50)) {
                        Ok(Perintah::Mulai(r)) => sesi = Some(Sesi::mulai(r)),
                        Ok(Perintah::Henti) => {
                            sesi = None;
                            saat_omelan(None);
                        }
                        Ok(Perintah::Tes(bunyi, lama)) => sesi = Some(Sesi::tes(bunyi, lama)),
                        Err(RecvTimeoutError::Timeout) => {}
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                    if let Some(s) = sesi.as_mut() {
                        if !s.langkah(&saat_omelan) {
                            sesi = None;
                        }
                    }
                }
            })
            .expect("utas suara");
        Self { kirim }
    }

    pub fn mulai(&self, r: Rencana) {
        let _ = self.kirim.send(Perintah::Mulai(r));
    }

    pub fn henti(&self) {
        let _ = self.kirim.send(Perintah::Henti);
    }

    pub fn tes(&self, bunyi: PathBuf, lama: Duration) {
        let _ = self.kirim.send(Perintah::Tes(bunyi, lama));
    }
}

/// Ada perangkat keluaran suara (daftar periksa).
pub fn ada_keluaran() -> bool {
    rodio::cpal::default_host().output_devices().map(|mut d| d.next().is_some()).unwrap_or(false)
}

struct Keluaran {
    _aliran: OutputStream,
    handle: OutputStreamHandle,
}

/// Semua perangkat keluaran aktif (speaker laptop tetap bunyi walau headset tersambung).
fn buka_semua() -> Vec<Keluaran> {
    let mut v = Vec::new();
    if let Ok(daftar) = rodio::cpal::default_host().output_devices() {
        for d in daftar {
            if let Ok((a, h)) = OutputStream::try_from_device(&d) {
                v.push(Keluaran { _aliran: a, handle: h });
            }
        }
    }
    if v.is_empty() {
        if let Ok((a, h)) = OutputStream::try_default() {
            v.push(Keluaran { _aliran: a, handle: h });
        }
    }
    v
}

enum Fase {
    /// 3 detik pertama: bunyi alarm saja (K-58).
    Awal(Instant),
    Bicara {
        sampai: Option<Instant>,
    },
    Jeda(Instant),
}

struct Sesi {
    _keluaran: Vec<Keluaran>,
    bunyi: Vec<Sink>,
    omelan: Vec<Sink>,
    rencana: Option<Rencana>,
    urutan: KeadaanUrutan,
    bahan: Vec<String>,
    waktu: Vec<Waktu>,
    fase: Fase,
    mulai: Instant,
    redam: f32,
    selesai: Option<Instant>,
}

fn sumber_bunyi(berkas: &PathBuf) -> Box<dyn Source<Item = f32> + Send> {
    match std::fs::read(berkas).ok().and_then(|b| Decoder::new(Cursor::new(b)).ok()) {
        Some(d) => Box::new(d.convert_samples::<f32>().repeat_infinite()),
        // Cadangan: bip 880 Hz putus-putus, alarm tidak pernah diam.
        None => Box::new(
            SineWave::new(880.0)
                .take_duration(Duration::from_millis(400))
                .amplify(0.5)
                .mix(rodio::source::Zero::<f32>::new(1, 44_100).take_duration(Duration::from_millis(600)))
                .repeat_infinite(),
        ),
    }
}

impl Sesi {
    fn kosong(r: Option<Rencana>, bunyi: &PathBuf) -> Self {
        let keluaran = buka_semua();
        let mut sb = Vec::new();
        let mut so = Vec::new();
        for k in &keluaran {
            if let (Ok(b), Ok(o)) = (Sink::try_new(&k.handle), Sink::try_new(&k.handle)) {
                b.append(sumber_bunyi(bunyi));
                sb.push(b);
                so.push(o);
            }
        }
        let (bahan, waktu) = r.as_ref().map(bahan_urutan).unwrap_or_default();
        Self {
            _keluaran: keluaran,
            bunyi: sb,
            omelan: so,
            rencana: r,
            urutan: KeadaanUrutan::default(),
            bahan,
            waktu,
            fase: Fase::Awal(Instant::now() + Duration::from_millis(JEDA_MS)),
            mulai: Instant::now(),
            redam: 1.0,
            selesai: None,
        }
    }

    fn mulai(r: Rencana) -> Self {
        let b = r.bunyi.clone();
        let mut s = Self::kosong(Some(r), &b);
        crate::catat::catat(&format!("suara mulai keluaran={} bahan={} waktu={}", s.bunyi.len(), s.bahan.len(), s.waktu.len()));
        s.mulai = Instant::now() - Duration::from_millis(s.rencana.as_ref().map(|r| r.sudah_ms).unwrap_or(0));
        s
    }

    fn tes(bunyi: PathBuf, lama: Duration) -> Self {
        let mut s = Self::kosong(None, &bunyi);
        s.selesai = Some(Instant::now() + lama);
        s
    }

    /// Satu langkah 50 md. false = sesi selesai (hanya tes bunyi).
    fn langkah(&mut self, saat: &SaatOmelan) -> bool {
        let now = Instant::now();
        if self.selesai.is_some_and(|t| now >= t) {
            return false;
        }
        let berlalu = now.duration_since(self.mulai);
        if let Some(r) = self.rencana.clone() {
            match self.fase {
                Fase::Awal(t) | Fase::Jeda(t) if now >= t => self.bicara(&r, berlalu.as_millis() as u64, saat),
                Fase::Bicara { sampai } => {
                    let habis = match sampai {
                        Some(t) => now >= t,
                        None => self.omelan.iter().all(Sink::empty),
                    };
                    if habis {
                        saat(None);
                        self.fase = Fase::Jeda(now + Duration::from_millis(JEDA_MS));
                    }
                }
                _ => {}
            }
        }
        // Redam bunyi selama omelan (turun/naik dalam 150 md), naik perlahan untuk bunyi "naik".
        let sasaran = if matches!(self.fase, Fase::Bicara { .. }) { REDAM_KE } else { 1.0 };
        let langkah = (1.0 - REDAM_KE) * 50.0 / REDAM_MS as f32;
        self.redam = if self.redam < sasaran { (self.redam + langkah).min(sasaran) } else { (self.redam - langkah).max(sasaran) };
        let naik = self.rencana.as_ref().and_then(|r| r.naik_dtk);
        let v = penguat_naik(berlalu.as_millis() as i64, naik) * self.redam;
        for b in &self.bunyi {
            b.set_volume(v);
        }
        true
    }

    fn bicara(&mut self, r: &Rencana, berlalu_ms: u64, saat: &SaatOmelan) {
        let (id, k) = berikutnya(&self.bahan, &self.waktu, r.benih, &self.urutan, berlalu_ms);
        self.urutan = k;
        let Some(o) = id.and_then(|i| i.parse::<usize>().ok()).and_then(|i| r.omelan.get(i)) else {
            // Tidak ada kalimat sama sekali: bunyi alarm saja.
            self.fase = Fase::Jeda(Instant::now() + Duration::from_secs(60));
            return;
        };
        saat(Some(o.teks.clone()));
        crate::catat::catat(&format!("omelan {} klip={}", o.jenis, o.klip.is_some()));
        let audio = o.klip.as_ref().and_then(|p| std::fs::read(p).ok()).filter(|b| Decoder::new(Cursor::new(b.clone())).is_ok());
        let audio = audio.or_else(|| crate::sistem::ucapkan(&o.teks, &r.bahasa));
        match audio {
            // Tanpa perangkat keluaran sama sekali: tetap tampilkan teksnya selama waktu baca.
            Some(b) if !self.omelan.is_empty() => {
                for s in &self.omelan {
                    if let Ok(d) = Decoder::new(Cursor::new(b.clone())) {
                        s.append(d);
                    }
                }
                self.fase = Fase::Bicara { sampai: None };
            }
            // Tidak ada klip dan tidak ada suara bawaan bahasa ini: teks tampil besar, bunyi saja.
            _ => {
                let lama = (o.teks.chars().count() as u64 * 70).clamp(2_500, 6_000);
                self.fase = Fase::Bicara { sampai: Some(Instant::now() + Duration::from_millis(lama)) };
            }
        }
    }
}

/// Bahan urutan (umum, agenda, pribadi) dan kalimat waktu; id = indeks omelan (sama dengan web).
fn bahan_urutan(r: &Rencana) -> (Vec<String>, Vec<Waktu>) {
    let mut bahan = Vec::new();
    let mut waktu = Vec::new();
    for (i, o) in r.omelan.iter().enumerate() {
        match (o.jenis.as_str(), o.menit) {
            ("waktu", Some(m)) => waktu.push(Waktu { id: i.to_string(), menit: m }),
            ("umum" | "agenda" | "pribadi", _) => bahan.push(i.to_string()),
            _ => {}
        }
    }
    (bahan, waktu)
}
