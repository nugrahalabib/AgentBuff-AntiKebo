---
name: shila-wake
description: |
  Smart alarm system with wake modes (gentle/normal/nuclear), smart home device control, 
  and notification actions (voice, WhatsApp, Telegram). 
  
  ALARM: set alarm, bangunin, reminder, buatkan alarm, hapus alarm, edit alarm, list alarm.
  
  ROUTINE (preset/template untuk alarm): bikin routine, buat preset, edit routine, hapus routine,
  list routine, run routine, aktifkan preset, routine apa saja, ada routine apa.
  
  Keywords: alarm, bangun, bangunin, wake, reminder, ingatkan, jadwal, routine, preset, template.
metadata:
  openclaw:
    emoji: "⏰"
---

# Shila Wake - Alarm Management

Use `wake_system.py` to manage alarms with smart home integration.

## Script Location
```
~/.openclaw/workspace/skills/shila-wake/scripts/wake_system.py
```

Run with: `python wake_system.py <command> [args]`

---

## 🚀 Auto-Start Hook

> [!IMPORTANT]
> **Web server auto-starts with OpenClaw!**
> The `shila-wake-server` hook automatically starts the dashboard on `gateway:startup`.

### Dashboard URL
- **Main Dashboard**: http://localhost:3000
- **Alarms Page**: http://localhost:3000/alarms
- **Active Alarm**: http://localhost:3000/alarm-active (saat alarm trigger)

### Manual Start (if needed)
```powershell
cd ~/.openclaw/workspace/skills/shila-wake/scripts
python web_server.py
```

### Check if Running
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/status" -Method GET
```

---

## Add Alarm

```python
import sys
sys.path.insert(0, str(Path.home() / ".openclaw" / "workspace" / "skills" / "shila-wake" / "scripts"))
from wake_system import add_alarm

add_alarm(
    time_str="07:00",                    # REQUIRED: HH:MM format
    mode="normal",                       # REQUIRED: gentle | normal | nuclear
    label="Morning Routine",             # Optional: descriptive label
    repeat="once",                       # Optional: once | daily | weekdays | weekends
    date="2026-02-01",                   # Optional: YYYY-MM-DD (default: today)
    sound="Birds.mp3",                   # Optional: sound file (see list below)
    devices=[...],                       # Optional: smart home devices
    actions=[...]                        # Optional: notification actions
)
```

---

## Wake Modes

| Mode | Description | Recommended Sounds |
|------|-------------|-------------------|
| `gentle` | Gradual lights 30→100%, soft sound, gentle TTS | Gentle category sounds |
| `normal` | Lights ON 100%, alarm sound, normal TTS | Normal category sounds |
| `nuclear` | ALL lights MAX, loud alarm 5x, urgent TTS, no snooze | Nuclear category sounds |

---

## Available Sounds (32 files)

> [!CAUTION]
> **STRICT RULES untuk pemilihan sound:**
> 1. Sound filename harus **EXACT** (case-sensitive) - contoh: `Birds.mp3` BUKAN `birds.mp3`
> 2. Sound **WAJIB** dipilih dari kategori yang sesuai dengan mode alarm

### Sound Selection by Mode

| Mode | Kategori Sound | Default Sound | Keywords User |
|------|---------------|---------------|---------------|
| `gentle` | GENTLE | `Birds.mp3` | lembut, pelan, santai, soft, calm, nature |
| `normal` | NORMAL | `Bells.mp3` | biasa, standar, normal, regular |
| `nuclear` | NUCLEAR | `School.mp3` | keras, brutal, kencang, loud, urgent, extreme |

### 🌿 GENTLE Mode Sounds ONLY (8 sounds)
| Filename | Description |
|----------|-------------|
| `Birds.mp3` | Bird chirping - nature ambience |
| `Piano.mp3` | Calm piano melody |
| `Harp.mp3` | Gentle harp melody |
| `Flute.mp3` | Peaceful flute melody |
| `MusicBox.mp3` | Delicate music box |
| `Windchimes.mp3` | Wind chimes - peaceful |
| `Glow.mp3` | Soft ambient glow |
| `ParadiseIsland.mp3` | Tropical ambience |

### ⏰ NORMAL Mode Sounds ONLY (12 sounds)
| Filename | Description |
|----------|-------------|
| `Bells.mp3` - `Bells7.mp3` | Bell chime variants |
| `Xylophone.mp3` | Xylophone melody |
| `Happy.mp3` | Upbeat happy melody |
| `Childhood.mp3` | Cheerful melody |
| `Christmas.mp3` | Festive melody |
| `Guitar.mp3` | Guitar melody |
| `Twinkle.mp3` | Twinkling melody |
| `Pizzicato.mp3` | Pizzicato strings |

### ☢️ NUCLEAR Mode Sounds ONLY (7 sounds)
| Filename | Description |
|----------|-------------|
| `Alarm.mp3` | Standard alarm beep |
| `Electricity.mp3` | Electronic urgent beep |
| `Classic.mp3` - `Classic3.mp3` | Classic alarm variants |
| `School.mp3` | Loud school bell |
| `Rooster.mp3` | Loud rooster crow |
| `Cuckoo.mp3` | Loud cuckoo clock |
| `Pipe.mp3` | Loud pipe organ |

---

## Smart Home Devices

### Check Available Devices
```bash
python ~/.openclaw/workspace/skills/smarthome-tuya/scripts/tuya_control.py list
```

### All Available Devices (10 devices)

#### 💡 Lights (7 devices)
| Device Name | Type | Supports |
|-------------|------|----------|
| `lampu meja` | light | on/off, brightness, color |
| `lampu strip dinding` | light | on/off, brightness, color |
| `lampu strip meja` | light | on/off, brightness, color |
| `soft box 1` | light | on/off, brightness, color |
| `soft box 2` | light | on/off, brightness, color |
| `lampu tidur` | plug | on/off only |
| `monitor` | plug | on/off only |

#### ❄️ AC (1 device)
| Device Name | Type | Supports |
|-------------|------|----------|
| `AC Studio` | ac | on/off, temp (16-30), mode (cool/heat/auto) |

### Device JSON Formats

```json
// Light Device
{"id": "lampu meja", "name": "lampu meja", "type": "light", "action": "on", "brightness": 100, "color": "white"}

// AC Device
{"id": "AC Studio", "name": "AC Studio", "type": "ac", "action": "on", "temperature": 24, "ac_mode": "cool"}
```

### Available Colors
`white`, `warm`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`

---

## Additional Actions

| Action ID | Required Fields | Description |
|-----------|-----------------|-------------|
| `voice` | `message` | TTS announcement via Gemini |
| `whatsapp` | `recipient`, `message` | Send WhatsApp (via Shila) |
| `telegram` | `message` | Send Telegram (via Shila) |
| `weather` | - | Fetch & announce real weather |
| `quote` | - | Random motivational quote TTS |
| `spam` | `message` | **INFINITE LOOP** notifications until dismissed |

### Spam Mode (INFINITE LOOP!)
```json
{
  "id": "spam",
  "message": "BANGUN SEKARANG!",
  "channels": ["tts", "telegram", "whatsapp"]
}
```
> [!CAUTION]
> **SPAM = INFINITE LOOP setiap 15 detik sampai alarm di-dismiss!**
> Messages sent via OpenClaw Gateway to Shila for Telegram/WhatsApp.

---

## Active Alarm System ⏰🔔

Saat alarm trigger, Active Alarm System akan aktif:

| Fitur | Deskripsi |
|-------|-----------|
| **Auto Open Browser** | Browser otomatis terbuka ke `/alarm-active` |
| **Max Volume** | Volume PC di-set ke 100% |
| **Sound Loop** | Alarm sound loop terus sampai dismiss |
| **Snooze Options** | 5, 10, atau 15 menit |
| **Math Dismiss** | Wajib jawab soal matematika untuk matikan alarm |
| **Browser Watchdog** | Jika browser ditutup, otomatis dibuka lagi |
| **Spam Forever** | Jika ada action spam, loop terus sampai dismiss |

### Active Alarm URL
http://localhost:3000/alarm-active

### API Endpoints
```
GET  /api/alarm/active/status   - Cek status alarm aktif
POST /api/alarm/active/snooze   - Snooze alarm (body: {"minutes": 5|10|15})
POST /api/alarm/active/dismiss  - Dismiss dengan jawaban (body: {"answer": 42})
```

---

## Complete Example

```python
from pathlib import Path
import sys
sys.path.insert(0, str(Path.home() / ".openclaw" / "workspace" / "skills" / "shila-wake" / "scripts"))
from wake_system import add_alarm

add_alarm(
    time_str="07:00",
    mode="normal",
    label="Morning Wake Up",
    repeat="daily",
    sound="Birds.mp3",
    devices=[
        {"id": "lampu meja", "name": "lampu meja", "type": "light", "action": "on", "brightness": 100, "color": "warm"},
        {"id": "AC Studio", "name": "AC Studio", "type": "ac", "action": "off"}
    ],
    actions=[
        {"id": "weather", "location": "Jakarta"},
        {"id": "voice", "message": "Selamat pagi sayang! Waktunya bangun!"},
        {"id": "quote"}
    ]
)
```

### Nuclear Wake with INFINITE SPAM
```python
add_alarm(
    time_str="06:00",
    mode="nuclear",
    label="BANGUN - NO EXCUSES!",
    sound="School.mp3",
    devices=[
        {"id": "lampu meja", "name": "lampu meja", "type": "light", "action": "on", "brightness": 100},
        {"id": "soft box 1", "name": "soft box 1", "type": "light", "action": "on", "brightness": 100}
    ],
    actions=[
        {"id": "voice", "message": "BANGUN SEKARANG!"},
        {"id": "spam", "message": "BANGUN! Tidak ada waktu untuk tidur!", "channels": ["tts", "telegram", "whatsapp"]}
    ]
)
```

---

## CLI Commands

All commands run from: `~/.openclaw/workspace/skills/shila-wake/scripts`

### Alarm Management
```bash
python wake_system.py alarm add 07:00 --mode normal --label "Wake Up"
python wake_system.py alarm list
python wake_system.py alarm delete <alarm_id>
```

### Routine Management
```bash
python wake_system.py routine list
python wake_system.py routine run <id>
```

### Testing Functions
```bash
python wake_system.py test sound
python wake_system.py test lights
python wake_system.py test tts --text "Hello World"
python wake_system.py test wake --mode normal
```

---

## Web Dashboard

URL: http://localhost:3000

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Overview, quick actions, next alarm |
| Alarms | `/alarms` | Create/edit/delete alarms |
| Routines | `/routines` | Create/edit routine presets |
| Analytics | `/analytics` | Wake stats, streaks, scores |
| Logs | `/logs` | Event history |
| Active Alarm | `/alarm-active` | Fullscreen alarm page |

---

## Messaging Integration

> [!IMPORTANT]
> **Telegram/WhatsApp messaging** delegated to Shila via OpenClaw Gateway.
> Uses `POST /v1/responses` endpoint at `http://127.0.0.1:18789/v1/responses`.

When alarm triggers with spam action:
1. TTS speaks directly using Gemini TTS (via `GEMINI_API_KEY`)
2. Telegram/WhatsApp messages sent via Shila delegation
3. All channels repeat every 15 seconds until alarm dismissed
