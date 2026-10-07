//! Jendela (docs/09 §3, §6 butir 5): pengaturan kecil, jendela alarm yang terkunci, dan lapisan
//! gelap di monitor tambahan. Jendela alarm: layar penuh, selalu di atas, tanpa bingkai, tidak
//! bisa diminimalkan; tutup (tombol, Alt+F4) dicegat; fokus direbut kembali tiap 1 detik. Hanya
//! proses utama yang menutupnya (`destroy`), sesudah server atau soal luring berkata selesai.

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent};

pub const UTAMA: &str = "utama";
pub const ALARM: &str = "alarm";
const LAPISAN: &str = "lapisan-";

pub fn tampilkan_utama(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(UTAMA) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, UTAMA, WebviewUrl::App("index.html".into()))
        .title("AntiKebo")
        .inner_size(440.0, 760.0)
        .min_inner_size(380.0, 560.0)
        .maximizable(false)
        .center()
        .build();
}

/// Tombol tutup dan Alt+F4: jendela pengaturan disembunyikan ke baki; jendela alarm dan lapisan
/// tidak pernah bisa ditutup pengguna.
pub fn peristiwa_jendela(w: &Window, e: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = e {
        api.prevent_close();
        if w.label() == UTAMA {
            let _ = w.hide();
        }
    }
}

fn atur_alarm(w: &WebviewWindow) {
    let _ = w.unminimize();
    let _ = w.show();
    let _ = w.set_always_on_top(true);
    if !w.is_fullscreen().unwrap_or(false) {
        let _ = w.set_fullscreen(true);
    }
    if !w.is_focused().unwrap_or(false) {
        let _ = w.set_focus();
    }
}

/// Buka (atau kunci ulang) jendela alarm di monitor utama + lapisan di monitor lain.
pub fn buka_alarm(app: &AppHandle) {
    let utama = app.primary_monitor().ok().flatten();
    if let Some(w) = app.get_webview_window(ALARM) {
        atur_alarm(&w);
        buka_lapisan(app, utama.as_ref());
        return;
    }
    let Ok(w) = WebviewWindowBuilder::new(app, ALARM, WebviewUrl::App("alarm.html".into()))
        .title("AntiKebo")
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .closable(false)
        .focused(true)
        .visible(false)
        .build()
    else {
        return;
    };
    // Posisi + ukuran monitor dulu: tetap menutupi layar walau permintaan layar penuh diabaikan.
    if let Some(m) = &utama {
        let _ = w.set_position(*m.position());
        let _ = w.set_size(*m.size());
    }
    atur_alarm(&w);
    buka_lapisan(app, utama.as_ref());
}

/// Lapisan gelap "Lihat layar utama" di setiap monitor tambahan.
fn buka_lapisan(app: &AppHandle, utama: Option<&tauri::Monitor>) {
    if let Ok(semua) = app.available_monitors() {
        for (i, m) in semua.iter().enumerate() {
            if utama.is_some_and(|u| u.position() == m.position()) {
                continue;
            }
            let label = format!("{LAPISAN}{i}");
            if app.get_webview_window(&label).is_some() {
                continue;
            }
            if let Ok(l) = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("lapisan.html".into()))
                .title("AntiKebo")
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .minimizable(false)
                .closable(false)
                .focused(false)
                .visible(false)
                .build()
            {
                let p: PhysicalPosition<i32> = *m.position();
                let _ = l.set_position(p);
                let _ = l.set_size(*m.size());
                let _ = l.set_fullscreen(true);
                let _ = l.show();
            }
        }
    }
}

/// Tiap detik selama berbunyi: jendela tetap di depan, layar penuh, tidak diminimalkan.
pub fn kunci_alarm(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(ALARM) {
        atur_alarm(&w);
    }
}

pub fn ada_alarm(app: &AppHandle) -> bool {
    app.get_webview_window(ALARM).is_some()
}

/// Bunyi berhenti: layar Selamat pagi tetap ada sampai ditutup, tapi tidak lagi menghalangi
/// jendela lain, dan lapisan monitor tambahan dibuang.
pub fn lepas_alarm(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(ALARM) {
        let _ = w.set_always_on_top(false);
    }
    for (label, w) in app.webview_windows() {
        if label.starts_with(LAPISAN) {
            let _ = w.destroy();
        }
    }
}

pub fn tutup_alarm(app: &AppHandle) {
    for (label, w) in app.webview_windows() {
        if label == ALARM || label.starts_with(LAPISAN) {
            let _ = w.destroy();
        }
    }
}
