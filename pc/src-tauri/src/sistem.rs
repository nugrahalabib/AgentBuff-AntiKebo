//! Bagian khusus Windows (docs/09 §5 sampai §7): volume dan bisu semua perangkat keluaran,
//! `SetThreadExecutionState`, menyalakan layar, status baterai, aksi tutup laptop (`powercfg`),
//! dan suara bawaan Windows untuk cadangan omelan. Di luar Windows semuanya diam (pengembangan).

use antikebo_inti::daya::AksiTutup;
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::time::Duration;

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct StatusDaya {
    /// None = PC tanpa baterai (PC meja) atau tidak diketahui.
    pub dicas: Option<bool>,
    pub baterai: Option<f32>,
}

#[cfg(windows)]
mod win {
    use super::*;
    use std::os::windows::process::CommandExt;
    use windows::core::HSTRING;
    use windows::Media::SpeechSynthesis::SpeechSynthesizer;
    use windows::Storage::Streams::DataReader;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eRender, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
    use windows::Win32::System::Power::{
        GetSystemPowerStatus, SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED, SYSTEM_POWER_STATUS,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_MOVE, MOUSEINPUT};

    const TANPA_JENDELA: u32 = 0x0800_0000;

    pub fn siapkan_com() {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
    }

    pub fn paksa_volume() -> windows::core::Result<()> {
        unsafe {
            let e: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let semua = e.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
            for i in 0..semua.GetCount()? {
                let Ok(d) = semua.Item(i) else { continue };
                let Ok(v) = d.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) else { continue };
                let _ = v.SetMute(false, std::ptr::null());
                let _ = v.SetMasterVolumeLevelScalar(1.0, std::ptr::null());
            }
        }
        Ok(())
    }

    pub fn atur_eksekusi(siaga: bool, berbunyi: bool) {
        let mut f = ES_CONTINUOUS;
        if siaga || berbunyi {
            f |= ES_SYSTEM_REQUIRED;
        }
        if berbunyi {
            f |= ES_DISPLAY_REQUIRED;
        }
        unsafe {
            SetThreadExecutionState(f);
        }
    }

    pub fn bangunkan_layar() {
        let gerak = |dx: i32| INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 { mi: MOUSEINPUT { dx, dy: 0, mouseData: 0, dwFlags: MOUSEEVENTF_MOVE, time: 0, dwExtraInfo: 0 } },
        };
        unsafe {
            SendInput(&[gerak(1), gerak(-1)], std::mem::size_of::<INPUT>() as i32);
        }
    }

    pub fn status_daya() -> StatusDaya {
        let mut s = SYSTEM_POWER_STATUS::default();
        if unsafe { GetSystemPowerStatus(&mut s) }.is_err() || s.BatteryFlag == 128 || s.BatteryFlag == 255 {
            return StatusDaya::default();
        }
        StatusDaya {
            dicas: (s.ACLineStatus != 255).then_some(s.ACLineStatus == 1),
            baterai: (s.BatteryLifePercent <= 100).then_some(s.BatteryLifePercent as f32),
        }
    }

    fn powercfg(args: &[&str]) -> Option<String> {
        let o = std::process::Command::new("powercfg").args(args).creation_flags(TANPA_JENDELA).output().ok()?;
        o.status.success().then(|| String::from_utf8_lossy(&o.stdout).into_owned())
    }

    pub fn aksi_tutup() -> Option<AksiTutup> {
        antikebo_inti::daya::baca_aksi_tutup(&powercfg(&["/q", "SCHEME_CURRENT", "SUB_BUTTONS", "LIDACTION"])?)
    }

    pub fn perbaiki_tutup() -> bool {
        antikebo_inti::daya::PERBAIKI_TUTUP.iter().all(|a| powercfg(a).is_some())
    }

    pub fn ucapkan(teks: &str, bahasa: &str) -> Option<Vec<u8>> {
        let s = SpeechSynthesizer::new().ok()?;
        let suara = SpeechSynthesizer::AllVoices().ok()?;
        let cocok = (0..suara.Size().ok()?)
            .filter_map(|i| suara.GetAt(i).ok())
            .find(|v| v.Language().map(|l| l.to_string().to_lowercase().starts_with(bahasa)).unwrap_or(false));
        // Tidak ada suara bawaan berbahasa ini: teks saja (docs/10-SUARA.md §5 butir 2).
        s.SetVoice(&cocok?).ok()?;
        if let Ok(o) = s.Options() {
            let _ = o.SetSpeakingRate(1.1);
        }
        let aliran = s.SynthesizeTextToStreamAsync(&HSTRING::from(teks)).ok()?.join().ok()?;
        let ukuran = aliran.Size().ok()? as u32;
        let baca = DataReader::CreateDataReader(&aliran.GetInputStreamAt(0).ok()?).ok()?;
        baca.LoadAsync(ukuran).ok()?.join().ok()?;
        let mut isi = vec![0u8; ukuran as usize];
        baca.ReadBytes(&mut isi).ok()?;
        Some(isi)
    }
}

#[cfg(windows)]
pub use win::{aksi_tutup, bangunkan_layar, perbaiki_tutup, siapkan_com, status_daya, ucapkan};

#[cfg(not(windows))]
mod lain {
    use super::*;
    pub fn siapkan_com() {}
    pub fn bangunkan_layar() {}
    pub fn status_daya() -> StatusDaya {
        StatusDaya::default()
    }
    pub fn aksi_tutup() -> Option<AksiTutup> {
        None
    }
    pub fn perbaiki_tutup() -> bool {
        false
    }
    pub fn ucapkan(_teks: &str, _bahasa: &str) -> Option<Vec<u8>> {
        None
    }
}

#[cfg(not(windows))]
pub use lain::{aksi_tutup, bangunkan_layar, perbaiki_tutup, siapkan_com, status_daya, ucapkan};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct KeadaanDaya {
    pub siaga: bool,
    pub berbunyi: bool,
}

/// Utas daya: `SetThreadExecutionState` berlaku per utas, jadi dipegang satu utas yang hidup
/// terus. Selama berbunyi, volume semua keluaran dipaksa 100% dan tidak bisu tiap 2 detik.
#[derive(Clone)]
pub struct Daya {
    kirim: Sender<KeadaanDaya>,
}

impl Daya {
    pub fn nyalakan() -> Self {
        let (kirim, terima) = channel::<KeadaanDaya>();
        std::thread::Builder::new()
            .name("antikebo-daya".into())
            .spawn(move || {
                siapkan_com();
                let mut k = KeadaanDaya::default();
                loop {
                    match terima.recv_timeout(Duration::from_secs(2)) {
                        Ok(baru) => {
                            if baru.berbunyi && !k.berbunyi {
                                bangunkan_layar();
                            }
                            k = baru;
                        }
                        Err(RecvTimeoutError::Timeout) => {}
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                    #[cfg(windows)]
                    {
                        win::atur_eksekusi(k.siaga, k.berbunyi);
                        if k.berbunyi {
                            let _ = win::paksa_volume();
                        }
                    }
                }
            })
            .expect("utas daya");
        Self { kirim }
    }

    pub fn atur(&self, k: KeadaanDaya) {
        let _ = self.kirim.send(k);
    }
}
