#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["fastapi>=0.110.0", "uvicorn>=0.27.0", "jinja2>=3.1.0", "schedule>=1.2.0"]
# ///
"""
Shila Wake System - Web Dashboard Server v2.0
FastAPI-based web interface with proper date handling.
"""
import os
import sys
import json
import asyncio
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Setup paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
TEMPLATES_DIR = SKILL_DIR / "templates"
STATIC_DIR = SKILL_DIR / "static"

sys.path.insert(0, str(SCRIPT_DIR))

# Load .env so Tuya credentials are always available
OPENCLAW_ENV = Path.home() / ".openclaw" / ".env"
if OPENCLAW_ENV.exists():
    with open(OPENCLAW_ENV, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                os.environ.setdefault(key.strip(), value.strip())

# Import wake system
from wake_system import (
    load_config, save_config, load_alarms, save_alarms, add_alarm, delete_alarm, toggle_alarm,
    load_reminders, save_reminders, add_reminder, delete_reminder,
    load_routines, save_routines, add_routine, update_routine, delete_routine, toggle_routine, run_routine, get_routine_by_id,
    load_activity, log_activity, get_recent_activity,
    load_analytics, log_wake_event, calculate_weekly_score, get_snooze_heatmap, get_calendar_data,
    execute_wake, routine_morning, routine_work, routine_sleep, routine_movie, execute_tuya_command,
    check_alarms, check_reminders, turn_on_lights, turn_off_ac, speak_tts,
    test_sound, test_lights, test_tts, get_next_alarm, safe_print,
    ALARMS_FILE, REMINDERS_FILE, CONFIG_FILE,
    # Active Alarm functions
    snooze_active_alarm, dismiss_active_alarm, get_active_alarm_status
)

# Import event logger for comprehensive logging
from event_logger import (
    log_event, get_events, get_stats, get_recent_summary, EVENT_TYPES,
    get_optimal_wake_time, generate_ai_insights
)

# Install dependencies if needed
try:
    from fastapi import FastAPI, HTTPException, Request, Form
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import HTMLResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles
    from fastapi.templating import Jinja2Templates
    import uvicorn
except ImportError:
    print("Installing web dependencies...")
    os.system(f"{sys.executable} -m pip install fastapi uvicorn jinja2")
    from fastapi import FastAPI, HTTPException, Request, Form
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import HTMLResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles
    from fastapi.templating import Jinja2Templates
    import uvicorn

try:
    import schedule
except ImportError:
    os.system(f"{sys.executable} -m pip install schedule")
    import schedule


# ===========================================================================
# Scheduler Background Task (Improved)
# ===========================================================================

scheduler_running = False
scheduler_thread = None

def scheduler_loop():
    """Background scheduler loop with error handling."""
    global scheduler_running
    scheduler_running = True
    
    # Clear any existing jobs
    schedule.clear()
    
    # Schedule checks every 5 seconds for near real-time alarms
    schedule.every(5).seconds.do(safe_check_alarms)
    schedule.every().minute.at(":30").do(safe_check_reminders)
    
    safe_print("[SCHEDULER] Background scheduler started")
    
    while scheduler_running:
        try:
            schedule.run_pending()
        except Exception as e:
            safe_print(f"[SCHEDULER] Error in scheduler: {e}")
        time.sleep(1)
    
    safe_print("[SCHEDULER] Background scheduler stopped")


# ===========================================================================
# Gateway Health Check - Exit when gateway dies
# ===========================================================================

gateway_check_running = False
gateway_check_thread = None

def check_gateway_alive():
    """Check if OpenClaw gateway is running on port 18789."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('127.0.0.1', 18789))
        sock.close()
        return result == 0
    except Exception:
        return False

def gateway_health_loop():
    """Monitor gateway and exit if it dies."""
    global gateway_check_running
    gateway_check_running = True
    
    consecutive_failures = 0
    max_failures = 3  # Exit after 3 consecutive failures (30 seconds)
    
    safe_print("[GATEWAY CHECK] Monitoring gateway lifecycle...")
    
    while gateway_check_running:
        try:
            if check_gateway_alive():
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                safe_print(f"[GATEWAY CHECK] Gateway not responding ({consecutive_failures}/{max_failures})")
                
                if consecutive_failures >= max_failures:
                    safe_print("[GATEWAY CHECK] Gateway is down! Shutting down shila-wake...")
                    # Exit the entire process
                    os._exit(0)
        except Exception as e:
            safe_print(f"[GATEWAY CHECK] Error: {e}")
        
        time.sleep(10)  # Check every 10 seconds

def start_gateway_check():
    """Start gateway health check thread."""
    global gateway_check_thread, gateway_check_running
    
    if gateway_check_thread and gateway_check_thread.is_alive():
        return
    
    gateway_check_running = True
    gateway_check_thread = threading.Thread(target=gateway_health_loop, daemon=True)
    gateway_check_thread.start()
    safe_print("[WEB] Gateway health check started")

def stop_gateway_check():
    """Stop gateway health check."""
    global gateway_check_running
    gateway_check_running = False


def safe_check_alarms():
    """Wrapper for check_alarms with error handling."""
    try:
        check_alarms()
    except Exception as e:
        safe_print(f"[SCHEDULER] check_alarms error: {e}")


def safe_check_reminders():
    """Wrapper for check_reminders with error handling."""
    try:
        check_reminders()
    except Exception as e:
        safe_print(f"[SCHEDULER] check_reminders error: {e}")


def start_scheduler():
    """Start the scheduler thread."""
    global scheduler_thread, scheduler_running
    
    if scheduler_thread and scheduler_thread.is_alive():
        safe_print("[SCHEDULER] Already running")
        return
    
    scheduler_running = True
    scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler_thread.start()
    safe_print("[WEB] Scheduler started")


def stop_scheduler():
    """Stop the scheduler thread."""
    global scheduler_running
    scheduler_running = False
    safe_print("[WEB] Scheduler stop requested")


# ===========================================================================
# Lifespan (Modern FastAPI approach)
# ===========================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    start_scheduler()
    start_gateway_check()  # Monitor gateway lifecycle
    yield
    # Shutdown
    stop_scheduler()
    stop_gateway_check()


# ===========================================================================
# FastAPI App
# ===========================================================================

app = FastAPI(
    title="Shila Wake System",
    description="Smart Alarm & Reminder Dashboard v2.0",
    version="2.0.0",
    lifespan=lifespan
)

# CORS - allow all origins so dashboard can call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================================================================
# Auth Middleware — server-side login gate
# ===========================================================================

import hashlib
import secrets
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse, Response

AUTH_FILE = SKILL_DIR / "auth.json"
SESSION_MAX_AGE = 86400  # 24 hours in seconds
COOKIE_NAME = "shila_wake_session"

# In-memory session store: token → created_at (timestamp)
_auth_sessions: dict[str, float] = {}

# Paths that don't need auth
AUTH_PUBLIC_PATHS = {"/login", "/api/auth/login", "/api/auth/logout"}


def _load_auth_creds():
    """Load username + password hash from auth.json."""
    try:
        if AUTH_FILE.exists():
            data = json.loads(AUTH_FILE.read_text("utf-8"))
            if data.get("username") and data.get("passwordHash"):
                return data
    except Exception:
        pass
    return None


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow public paths
        if path in AUTH_PUBLIC_PATHS:
            return await call_next(request)

        # Allow static assets on login page
        if path.startswith("/static/") or path == "/favicon.ico":
            return await call_next(request)

        # Allow internal/localhost API calls (UI-Shila dashboard, scripts, cron jobs)
        if path.startswith("/api/"):
            client_ip = request.client.host if request.client else ""
            xff = request.headers.get("x-forwarded-for", "")
            is_loopback = client_ip in ("127.0.0.1", "::1", "localhost")
            is_loopback_xff = not xff or xff in ("::1", "127.0.0.1") or xff.startswith("::1,")
            has_internal_key = request.headers.get("x-internal-key") == "<KUNCI-DIHAPUS>"
            if (is_loopback and is_loopback_xff) or has_internal_key:
                return await call_next(request)

        # Check if credentials are configured
        creds = _load_auth_creds()
        if not creds:
            return await call_next(request)

        # Check session cookie
        token = request.cookies.get(COOKIE_NAME)
        if token and token in _auth_sessions:
            created_at = _auth_sessions[token]
            if time.time() - created_at < SESSION_MAX_AGE:
                return await call_next(request)
            else:
                del _auth_sessions[token]

        # Not authenticated
        if path.startswith("/api/"):
            return JSONResponse({"error": "Authentication required"}, status_code=401)

        return RedirectResponse(url="/login", status_code=302)


app.add_middleware(AuthMiddleware)

# Create directories
TEMPLATES_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Mount static files
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Mount sounds folder for audio files
SOUNDS_DIR = SKILL_DIR / "sounds"
if SOUNDS_DIR.exists():
    app.mount("/sounds", StaticFiles(directory=str(SOUNDS_DIR)), name="sounds")


# ===========================================================================
# Auth Routes
# ===========================================================================

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Login page."""
    login_path = TEMPLATES_DIR / "login.html"
    if login_path.exists():
        return HTMLResponse(login_path.read_text("utf-8"))
    return HTMLResponse("<h1>Login page not found</h1>", status_code=404)


@app.post("/api/auth/login")
async def api_login(request: Request):
    """Verify credentials and set session cookie."""
    try:
        body = await request.json()
        username = body.get("username", "")
        password = body.get("password", "")
    except Exception:
        return JSONResponse({"ok": False, "error": "Request tidak valid"}, status_code=400)

    creds = _load_auth_creds()
    if not creds:
        return JSONResponse({"ok": False, "error": "Login belum dikonfigurasi"}, status_code=500)

    input_hash = _sha256(password)
    if username == creds["username"] and input_hash == creds["passwordHash"]:
        token = secrets.token_hex(32)
        _auth_sessions[token] = time.time()

        response = JSONResponse({"ok": True})
        is_secure = request.headers.get("x-forwarded-proto") == "https"
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            max_age=SESSION_MAX_AGE,
            httponly=True,
            samesite="strict",
            secure=is_secure,
            path="/",
        )
        return response
    else:
        return JSONResponse({"ok": False, "error": "Username atau password salah"}, status_code=401)


@app.post("/api/auth/logout")
async def api_logout(request: Request):
    """Clear session cookie."""
    token = request.cookies.get(COOKIE_NAME)
    if token and token in _auth_sessions:
        del _auth_sessions[token]

    response = JSONResponse({"ok": True})
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return response


# ===========================================================================
# API Routes
# ===========================================================================

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Main dashboard page with enriched data."""
    alarms = load_alarms()
    reminders = load_reminders()
    config = load_config()
    
    # Get next alarm info
    next_alarm_info = get_next_alarm()
    
    now = datetime.now()
    
    # Format next alarm for hero card
    next_alarm = None
    if next_alarm_info:
        alarm = next_alarm_info['alarm']
        delta = next_alarm_info['delta']
        hours = int(delta.total_seconds() // 3600)
        mins = int((delta.total_seconds() % 3600) // 60)
        
        # Mode icons
        mode_icons = {"gentle": "🌿", "normal": "⏰", "nuclear": "🔥"}
        
        # Parse target datetime
        target_dt = None
        if alarm.get('target_datetime'):
            try:
                target_dt = datetime.fromisoformat(alarm['target_datetime'])
            except:
                pass
        
        next_alarm = {
            "time": alarm['time'],
            "date_formatted": target_dt.strftime("%A, %d %B") if target_dt else alarm.get('date', 'Today'),
            "datetime_iso": alarm.get('target_datetime', now.isoformat()),
            "mode": alarm.get('mode', 'normal').title(),
            "mode_icon": mode_icons.get(alarm.get('mode', 'normal'), "⏰"),
            "label": alarm.get('label', ''),
            "countdown": f"{hours}h {mins}m"
        }
    
    # Format alarm list
    formatted_alarms = []
    mode_icons = {"gentle": "🌿", "normal": "⏰", "nuclear": "🔥"}
    for a in alarms:
        mode = a.get('mode', 'normal')
        repeat = a.get('repeat', 'once')
        repeat_texts = {
            "once": "Once",
            "daily": "Every day",
            "weekdays": "Mon-Fri",
            "weekends": "Sat-Sun",
            "weekly": "Every week",
            "monthly": "Monthly"
        }
        formatted_alarms.append({
            **a,
            "date_short": a.get('date', 'Today'),
            "mode": mode.title(),
            "mode_icon": mode_icons.get(mode, "⏰"),
            "repeat_text": repeat_texts.get(repeat, repeat)
        })
    
    # Stats - using real analytics data
    active_alarms = [a for a in alarms if a.get('enabled', True)]
    active_reminders = [r for r in reminders if r.get('enabled', True)]
    routines = load_routines()
    
    # Get real analytics
    analytics = load_analytics()
    score_data = calculate_weekly_score()
    
    stats = {
        "alarm_count": len(active_alarms),
        "alarm_sub": f"{len(alarms)} total configured",
        "reminder_count": len(active_reminders),
        "reminder_sub": f"for today and upcoming",
        "avg_sleep": "7.5h",
        "sleep_sub": "based on last 7 days",
        "routine_count": len(routines),
        "weekly_score": score_data.get("score", 0),
        "on_time": score_data.get("on_time", 0),
        "late": score_data.get("late", 0),
        "current_streak": analytics.get("streaks", {}).get("current", 0),
        "longest_streak": analytics.get("streaks", {}).get("longest", 0),
        "wake_status": "Pending"
    }
    
    # Check today's wake status from event logs
    today_str = now.strftime("%Y-%m-%d")
    today_events = get_events(date_from=today_str, date_to=today_str, limit=50)
    for evt in today_events.get("events", []):
        if evt.get("event_type") == "alarm_dismissed":
            stats["wake_status"] = "Dismissed ✓"
            break
        elif evt.get("event_type") == "alarm_snoozed":
            stats["wake_status"] = "Snoozed"
    
    # TODO: Integrate with smarthome-tuya skill to get real device states
    # Use: uv run tuya_control.py status --all
    devices = {
        "lights": False,
        "ac": False,
        "music": False,
        "coffee": False
    }
    
    # TODO: Integrate with weather skill to get real weather
    # Use: curl -s "wttr.in/Bandung?format=j1"
    weather = {
        "icon": "⛅",
        "temp": 28,
        "condition": "Partly Cloudy",
        "humidity": 72,
        "wind": 12,
        "recommendation": "Good morning! Consider opening windows for fresh air."
    }
    
    # TODO: Integrate with Google Calendar API
    # These are placeholder events - can be populated via API
    schedule = []  # Empty by default - will show "No events scheduled"
    
    # Current date formatted
    current_date = now.strftime("%A, %d %B %Y")
    
    # Get real activity feed from event_logger
    recent_events = get_events(limit=6)
    activity_feed = []
    for evt in recent_events.get("events", []):
        activity_feed.append({
            "icon": evt.get("icon", "📝"),
            "text": evt.get("summary", "Event logged"),
            "time": f"{evt.get('date', '')} {evt.get('time', '')[:5]}"
        })
    
    # Get AI insight for dashboard
    event_stats = get_stats()
    ai_insights_list = generate_ai_insights(event_stats)
    ai_insight_text = ai_insights_list[0]["description"] if ai_insights_list else "Keep using Shila Wake to get personalized insights!"
    
    # Get routines for Quick Actions
    routines = load_routines()
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "active_page": "dashboard",
        "next_alarm": next_alarm,
        "alarms": formatted_alarms,
        "stats": stats,
        "routines": routines,
        "current_date": current_date,
        "activity": activity_feed,
        "ai_insight": ai_insight_text,
        "scheduler_running": scheduler_running
    })


@app.get("/alarms", response_class=HTMLResponse)
async def alarms_page(request: Request):
    """Alarms management page."""
    alarms = load_alarms()
    
    # Format alarms
    formatted_alarms = []
    repeat_texts = {
        "once": "Once",
        "daily": "Every day", 
        "weekdays": "Mon-Fri",
        "weekends": "Sat-Sun",
        "weekly": "Every week",
        "monthly": "Monthly"
    }
    
    for a in alarms:
        formatted_alarms.append({
            **a,
            "date_display": a.get('date', 'Today'),
            "mode": a.get('mode', 'normal').title(),
            "repeat_text": repeat_texts.get(a.get('repeat', 'once'), 'Once')
        })
    
    # Sound library - scan actual sounds folder
    sounds = {"gentle": [], "normal": [], "nuclear": []}
    if SOUNDS_DIR.exists():
        # Categorize sounds by type
        gentle_sounds = ["Birds", "Windchimes", "Piano", "Harp", "MusicBox", "Flute", "Glow", "ParadiseIsland"]
        nuclear_sounds = ["Alarm", "Electricity", "Classic", "Classic2", "Classic3", "School", "Rooster", "Cuckoo", "Pipe"]
        
        for f in sorted(SOUNDS_DIR.glob("*.mp3")):
            name = f.stem
            sound_entry = {"name": name, "path": f"/sounds/{f.name}"}
            
            if name in gentle_sounds:
                sounds["gentle"].append(sound_entry)
            elif name in nuclear_sounds:
                sounds["nuclear"].append(sound_entry)
            else:
                sounds["normal"].append(sound_entry)
    
    return templates.TemplateResponse("alarms.html", {
        "request": request,
        "active_page": "alarms",
        "alarms": formatted_alarms,
        "sounds": sounds
    })


@app.get("/routines", response_class=HTMLResponse)
async def routines_page(request: Request):
    """Routines automation page."""
    
    # Sound library - scan actual sounds folder (same as alarms page)
    sounds = {"gentle": [], "normal": [], "nuclear": []}
    if SOUNDS_DIR.exists():
        # Categorize sounds by type
        gentle_sounds = ["Birds", "Windchimes", "Piano", "Harp", "MusicBox", "Flute", "Glow", "ParadiseIsland"]
        nuclear_sounds = ["Alarm", "Electricity", "Classic", "Classic2", "Classic3", "School", "Rooster", "Cuckoo", "Pipe"]
        
        for f in sorted(SOUNDS_DIR.glob("*.mp3")):
            name = f.stem
            sound_entry = {"name": name, "path": f"/sounds/{f.name}"}
            
            if name in gentle_sounds:
                sounds["gentle"].append(sound_entry)
            elif name in nuclear_sounds:
                sounds["nuclear"].append(sound_entry)
            else:
                sounds["normal"].append(sound_entry)
    
    # Load real routines from routines.json
    routines = load_routines()
    
    return templates.TemplateResponse("routines.html", {
        "request": request,
        "active_page": "routines",
        "routines": routines,
        "sounds": sounds
    })

@app.get("/analytics", response_class=HTMLResponse)
async def analytics_page(request: Request):
    """Analytics and insights page with real data from event logs."""
    # Get comprehensive stats from event logger
    event_stats = get_stats()
    
    # Get existing analytics data (legacy)
    analytics = load_analytics()
    legacy_score = calculate_weekly_score()
    heatmap_data = get_snooze_heatmap()
    calendar_data = get_calendar_data()
    
    # Use event_stats weekly data, fallback to legacy
    score_data = {
        "score": event_stats.get("weekly", {}).get("score", legacy_score.get("score", 0)),
        "on_time": event_stats.get("weekly", {}).get("on_time", legacy_score.get("on_time", 0)),
        "late": event_stats.get("weekly", {}).get("late", legacy_score.get("late", 0)),
        "total": event_stats.get("weekly", {}).get("total", legacy_score.get("total", 0))
    }
    
    streaks_data = {
        "current": event_stats.get("streaks", {}).get("current", analytics.get("streaks", {}).get("current", 0)),
        "longest": event_stats.get("streaks", {}).get("longest", analytics.get("streaks", {}).get("longest", 0))
    }
    
    # Mode distribution (percentages)
    mode_dist = event_stats.get("mode_distribution", {"gentle": 0, "normal": 0, "nuclear": 0})
    total_modes = sum(mode_dist.values())
    mode_percentages = {
        "gentle": round((mode_dist.get("gentle", 0) / total_modes * 100) if total_modes > 0 else 0),
        "normal": round((mode_dist.get("normal", 0) / total_modes * 100) if total_modes > 0 else 0),
        "nuclear": round((mode_dist.get("nuclear", 0) / total_modes * 100) if total_modes > 0 else 0)
    }
    
    # Alarm hours - top 5
    alarm_hours = event_stats.get("alarm_hours", {})
    sorted_hours = sorted(alarm_hours.items(), key=lambda x: x[1], reverse=True)[:5]
    max_hour_count = sorted_hours[0][1] if sorted_hours else 1
    alarm_patterns = [
        {
            "time": hour,
            "count": count,
            "percent": round(count / max_hour_count * 100) if max_hour_count > 0 else 0
        }
        for hour, count in sorted_hours
    ]
    
    # Routine runs - get routines and match with run counts
    routines = load_routines()
    routine_runs_data = event_stats.get("routine_runs", {})
    routine_stats = []
    for routine in routines[:3]:  # Top 3
        runs = routine_runs_data.get(routine.get("name", ""), 0)
        routine_stats.append({
            "name": routine.get("name", "Unknown"),
            "icon": routine.get("icon", "🔄"),
            "mode": routine.get("mode", "normal"),
            "runs": runs,
            "success_rate": 100 if runs > 0 else 0  # Placeholder, could calculate from dismissed/snoozed
        })
    
    # Device usage - top 4
    device_usage = event_stats.get("device_usage", {})
    sorted_devices = sorted(device_usage.items(), key=lambda x: x[1], reverse=True)[:4]
    device_stats = [{"name": name, "count": count} for name, count in sorted_devices]
    
    # Totals from event stats
    alarms_data = event_stats.get("alarms", {})
    totals = {
        "total_alarms": alarms_data.get("total_triggered", 0),
        "total_dismissed": alarms_data.get("total_dismissed", 0),
        "total_snoozed": alarms_data.get("total_snoozed", 0),
        "perfect_days": len([d for d, data in event_stats.get("daily_data", {}).items() if data.get("snoozed", 0) == 0 and data.get("triggered", 0) > 0])
    }
    
    # Snooze heatmap from event stats
    snooze_heatmap = event_stats.get("snooze_heatmap", {})
    
    # Find worst day/hour for insight
    max_snooze = 0
    worst_day = "Monday"
    worst_hour = 6
    for day, hours in snooze_heatmap.items():
        for hour, count in hours.items():
            if count > max_snooze:
                max_snooze = count
                worst_day = day
                worst_hour = hour
    
    insight = {
        "worst_day": worst_day,
        "worst_hour": worst_hour,
        "has_data": max_snooze > 0
    }
    
    # Daily data for calendar
    daily_data = event_stats.get("daily_data", {})
    
    # Get optimal wake time data
    optimal_wake = get_optimal_wake_time()
    
    # Generate AI insights
    ai_insights = generate_ai_insights(event_stats)
    
    return templates.TemplateResponse("analytics.html", {
        "request": request,
        "active_page": "analytics",
        "score": score_data,
        "streaks": streaks_data,
        "totals": totals,
        "mode_dist": mode_percentages,
        "alarm_patterns": alarm_patterns,
        "routine_stats": routine_stats,
        "device_stats": device_stats,
        "snooze_heatmap": snooze_heatmap,
        "daily_data": daily_data,
        "insight": insight,
        "optimal_wake": optimal_wake,
        "ai_insights": ai_insights,
        "heatmap": heatmap_data,
        "calendar": calendar_data
    })


@app.get("/logs", response_class=HTMLResponse)
async def logs_page(request: Request):
    """Comprehensive event logs page."""
    # Get filter params from query string
    event_type = request.query_params.get("type", "")
    category = request.query_params.get("category", "")
    date_from = request.query_params.get("from", "")
    date_to = request.query_params.get("to", "")
    search = request.query_params.get("search", "")
    page = int(request.query_params.get("page", 1))
    per_page = 50
    
    # Get filtered events
    result = get_events(
        event_type=event_type if event_type else None,
        category=category if category else None,
        date_from=date_from if date_from else None,
        date_to=date_to if date_to else None,
        search=search if search else None,
        limit=per_page,
        offset=(page - 1) * per_page
    )
    
    # Get stats for summary
    stats = get_stats()
    
    # Calculate pagination
    total_pages = (result["total"] + per_page - 1) // per_page
    
    return templates.TemplateResponse("logs.html", {
        "request": request,
        "active_page": "logs",
        "events": result["events"],
        "total": result["total"],
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
        "has_more": result["has_more"],
        "stats": stats,
        "event_types": list(EVENT_TYPES.keys()),
        "categories": ["alarm", "routine", "device", "action", "system"],
        # Current filters for form
        "filters": {
            "type": event_type,
            "category": category,
            "from": date_from,
            "to": date_to,
            "search": search
        }
    })


# ===========================================================================
# Logs API
# ===========================================================================

@app.get("/api/logs")
async def api_get_logs(
    type: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    ref_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get event logs with filtering.
    
    Query params:
    - type: Filter by event type (e.g., alarm_triggered, routine_run)
    - category: Filter by category (alarm, routine, device, action, system)
    - date_from: Start date (YYYY-MM-DD)
    - date_to: End date (YYYY-MM-DD)
    - ref_id: Filter by reference ID
    - search: Text search in summary
    - limit: Max results (default 100)
    - offset: Pagination offset
    """
    return get_events(
        event_type=type,
        category=category,
        date_from=date_from,
        date_to=date_to,
        ref_id=ref_id,
        search=search,
        limit=limit,
        offset=offset
    )


@app.get("/api/stats")
async def api_get_stats():
    """Get aggregated statistics for analytics."""
    return get_stats()


@app.get("/api/logs/summary")
async def api_get_logs_summary(days: int = 7):
    """Get text summary of recent events for Shila context."""
    return {"summary": get_recent_summary(days)}


@app.get("/api/status")

async def get_status():
    """Get system status."""
    alarms = load_alarms()
    reminders = load_reminders()
    
    active_alarms = [a for a in alarms if a.get('enabled', True)]
    active_reminders = [r for r in reminders if r.get('enabled', True)]
    
    next_alarm_info = get_next_alarm()
    
    return {
        "status": "running",
        "scheduler": scheduler_running,
        "alarms": {
            "total": len(alarms),
            "active": len(active_alarms)
        },
        "reminders": {
            "total": len(reminders),
            "active": len(active_reminders)
        },
        "next_alarm": {
            "time": next_alarm_info['alarm']['time'] if next_alarm_info else None,
            "date": next_alarm_info['alarm'].get('date') if next_alarm_info else None,
            "label": next_alarm_info['alarm'].get('label') if next_alarm_info else None,
            "seconds_until": int(next_alarm_info['delta_seconds']) if next_alarm_info else None
        } if next_alarm_info else None,
        "time": datetime.now().isoformat()
    }


@app.get("/api/next-alarm")
async def get_next_alarm_api():
    """Get next alarm info for countdown."""
    next_alarm_info = get_next_alarm()
    
    if not next_alarm_info:
        return {"next_alarm": None}
    
    alarm = next_alarm_info['alarm']
    delta = next_alarm_info['delta']
    
    return {
        "next_alarm": {
            "id": alarm['id'],
            "time": alarm['time'],
            "date": alarm.get('date'),
            "mode": alarm['mode'],
            "label": alarm.get('label', ''),
            "target_datetime": alarm.get('target_datetime'),
            "seconds_until": int(next_alarm_info['delta_seconds']),
            "formatted": f"{int(delta.total_seconds() // 3600)}h {int((delta.total_seconds() % 3600) // 60)}m {int(delta.total_seconds() % 60)}s"
        }
    }


# Alarm API
@app.get("/api/alarms")
async def get_alarms():
    """Get all alarms."""
    return load_alarms()


@app.get("/api/sounds")
async def list_sounds():
    """Get all available alarm sounds."""
    sounds = []
    if SOUNDS_DIR.exists():
        for f in sorted(SOUNDS_DIR.glob("*.mp3")):
            name = f.stem  # filename without extension
            sounds.append({
                "id": f.name,
                "name": name,
                "url": f"/sounds/{f.name}"
            })
    return sounds


# Tuya devices cache path - OpenClaw workspace
TUYA_SKILL_DIR = Path.home() / ".openclaw" / "workspace" / "skills" / "smarthome-tuya"
TUYA_DEVICES_CACHE = TUYA_SKILL_DIR / "devices_cache.json"

@app.get("/api/devices")
async def list_devices():
    """Get all available Tuya devices from cache."""
    devices = {"lights": [], "ac": [], "plugs": [], "other": []}
    
    if not TUYA_DEVICES_CACHE.exists():
        return devices
    
    try:
        with open(TUYA_DEVICES_CACHE, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        
        for device in cache.get("devices", []):
            device_info = {
                "id": device.get("id", ""),
                "name": device.get("name", "Unknown"),
                "online": device.get("online", False),
                "category": device.get("category", ""),
                "supports_brightness": device.get("supports_brightness", False),
                "supports_color": device.get("supports_color", False),
            }
            
            category = device.get("category", "")
            
            # Categorize devices
            if category in ["dj", "dd"]:  # Lights and LED strips
                device_info["icon"] = "💡"
                device_info["type"] = "light"
                devices["lights"].append(device_info)
            elif category in ["infrared_ac", "kt"]:  # AC
                device_info["icon"] = "❄️"
                device_info["type"] = "ac"
                devices["ac"].append(device_info)
            elif category in ["cz", "pc"]:  # Smart plugs
                device_info["icon"] = "🔌"
                device_info["type"] = "plug"
                devices["plugs"].append(device_info)
            else:
                device_info["icon"] = "📱"
                device_info["type"] = "other"
                devices["other"].append(device_info)
        
        return devices
    except Exception as e:
        safe_print(f"[ERROR] Loading Tuya devices: {e}")
        return devices


@app.post("/api/alarms")
async def create_alarm(request: Request):
    """
    Create new alarm with devices and actions support.
    
    Request Body:
    {
        "time": "07:00",
        "date": "2026-02-01",
        "mode": "normal",
        "label": "Morning wake",
        "sound": "gentle_alarm.wav",
        "repeat": "weekdays",
        "days": ["mon", "tue", "wed", "thu", "fri"],
        "devices": [...],
        "actions": [...]
    }
    """
    data = await request.json()
    
    # Validate required fields
    time_str = data.get("time")
    if not time_str:
        raise HTTPException(status_code=400, detail="Time is required")
    
    try:
        datetime.strptime(time_str, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")
    
    # Optional date validation
    date_str = data.get("date")
    if date_str:
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Create alarm with all fields
    alarm = add_alarm(
        time_str=time_str,
        mode=data.get("mode", "normal"),
        label=data.get("label", ""),
        repeat=data.get("repeat", "once"),
        date_str=date_str,
        sound=data.get("sound"),
        days=data.get("days", []),
        devices=data.get("devices", []),
        actions=data.get("actions", [])
    )
    
    if not alarm:
        raise HTTPException(status_code=400, detail="Failed to create alarm")
    
    # Log event for comprehensive logging
    log_event(
        "alarm_created",
        data={
            "alarm_id": alarm.get("id"),
            "time": alarm.get("time"),
            "mode": alarm.get("mode"),
            "label": alarm.get("label"),
            "repeat": alarm.get("repeat"),
            "sound": alarm.get("sound"),
            "devices": [d.get("name", d.get("id")) for d in alarm.get("devices", [])],
            "actions": [a.get("id") for a in alarm.get("actions", [])]
        },
        summary=f"Alarm created: {alarm.get('time')} ({alarm.get('mode')} mode) - {alarm.get('label') or 'No label'}",
        ref_id=alarm.get("id")
    )
    
    return {"success": True, "alarm": alarm}


@app.post("/api/alarms/skip")
async def skip_next_alarm():
    """Skip the next upcoming alarm."""
    next_alarm_info = get_next_alarm()
    
    if not next_alarm_info:
        return {"success": False, "error": "No upcoming alarm to skip"}
    
    alarm_id = next_alarm_info["alarm"]["id"]
    alarms = load_alarms()
    
    for alarm in alarms:
        if alarm["id"] == alarm_id:
            alarm["enabled"] = False
            break
    
    save_alarms(alarms)
    
    return {
        "success": True, 
        "skipped_id": alarm_id,
        "message": f"Skipped alarm at {next_alarm_info['alarm']['time']}"
    }


@app.get("/api/alarms/{alarm_id}")
async def get_single_alarm(alarm_id: str):
    """Get single alarm by ID."""
    alarms = load_alarms()
    for alarm in alarms:
        if alarm["id"] == alarm_id:
            return alarm
    raise HTTPException(status_code=404, detail="Alarm not found")


@app.delete("/api/alarms/{alarm_id}")
async def remove_alarm(alarm_id: str):
    """Delete alarm."""
    success = delete_alarm(alarm_id)
    
    if success:
        log_event(
            "alarm_deleted",
            data={"alarm_id": alarm_id},
            summary=f"Alarm deleted: {alarm_id}",
            ref_id=alarm_id
        )
    
    return {"success": success}


@app.post("/api/alarms/{alarm_id}/toggle")
async def toggle_alarm_status(alarm_id: str):
    """Toggle alarm enabled/disabled."""
    success = toggle_alarm(alarm_id)
    
    if success:
        # Get current state after toggle
        alarms = load_alarms()
        alarm = next((a for a in alarms if a["id"] == alarm_id), None)
        if alarm:
            state = "enabled" if alarm.get("enabled", True) else "disabled"
            log_event(
                "alarm_updated",
                data={"alarm_id": alarm_id, "enabled": alarm.get("enabled", True)},
                summary=f"Alarm {state}: {alarm.get('time')} - {alarm.get('label') or 'No label'}",
                ref_id=alarm_id
            )
    
    return {"success": success}


# ===========================================================================
# Active Alarm API (Snooze/Dismiss)
# ===========================================================================

@app.get("/alarm-active", response_class=HTMLResponse)
async def active_alarm_page(request: Request):
    """Active alarm page with snooze/dismiss controls."""
    status = get_active_alarm_status()
    
    return templates.TemplateResponse("alarm_active.html", {
        "request": request,
        "alarm_status": status,
        "current_time": datetime.now().strftime("%H:%M:%S"),
        "current_date": datetime.now().strftime("%A, %d %B %Y")
    })


@app.get("/api/alarm/active/status")
async def get_alarm_active_status():
    """Get current active alarm status."""
    return get_active_alarm_status()


@app.post("/api/alarm/active/snooze")
async def snooze_alarm_api(request: Request):
    """Snooze the active alarm for X minutes."""
    try:
        data = await request.json()
        minutes = int(data.get("minutes", 5))
        
        if minutes not in [5, 10, 15]:
            raise HTTPException(status_code=400, detail="Invalid snooze duration")
        
        result = snooze_active_alarm(minutes)
        
        if result.get("success"):
            log_event(
                "alarm_snoozed",
                data={
                    "snooze_minutes": minutes,
                    "snooze_count": result.get("snooze_count", 1)
                },
                summary=f"Alarm snoozed for {minutes} minutes (snooze #{result.get('snooze_count', 1)})"
            )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/alarm/active/dismiss")
async def dismiss_alarm_api(request: Request):
    """Dismiss the active alarm by answering math problem."""
    try:
        data = await request.json()
        answer = int(data.get("answer", 0))
        
        result = dismiss_active_alarm(answer)
        
        if result.get("success"):
            log_event(
                "alarm_dismissed",
                data={
                    "snooze_count": result.get("snooze_count", 0),
                    "math_answer": answer
                },
                summary=f"Alarm dismissed successfully (after {result.get('snooze_count', 0)} snoozes)"
            )
        
        return result
    except ValueError:
        return {"success": False, "error": "Invalid answer format"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Reminder API
@app.get("/api/reminders")
async def get_reminders():
    """Get all reminders."""
    return load_reminders()


@app.post("/api/reminders")
async def create_reminder(
    message: str = Form(...),
    time: str = Form(...),
    date: str = Form(None),
    priority: str = Form("normal")
):
    """Create new reminder."""
    try:
        datetime.strptime(time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")
    
    reminder = add_reminder(message, time, date, priority=priority)
    return {"success": True, "reminder": reminder}


@app.delete("/api/reminders/{reminder_id}")
async def remove_reminder(reminder_id: str):
    """Delete reminder."""
    success = delete_reminder(reminder_id)
    return {"success": success}


# Routine API (Full CRUD)
@app.get("/api/routines")
async def list_routines_api():
    """Get all routines."""
    return load_routines()


@app.get("/api/routines/{routine_id}")
async def get_routine_api(routine_id: str):
    """Get single routine by ID."""
    routine = get_routine_by_id(routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


@app.post("/api/routines")
async def create_routine_api(request: Request):
    """Create new routine."""
    data = await request.json()
    
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="Name is required")
    
    routine = add_routine(data)
    
    log_event(
        "routine_created",
        data={
            "routine_id": routine.get("id"),
            "name": routine.get("name"),
            "mode": routine.get("mode"),
            "time": routine.get("time"),
            "repeat": routine.get("repeat")
        },
        summary=f"Routine created: {routine.get('name')}",
        ref_id=routine.get("id")
    )
    
    return {"success": True, "routine": routine}


@app.put("/api/routines/{routine_id}")
async def update_routine_api(routine_id: str, request: Request):
    """Update routine."""
    data = await request.json()
    routine = update_routine(routine_id, data)
    
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    return {"success": True, "routine": routine}


@app.delete("/api/routines/{routine_id}")
async def delete_routine_api(routine_id: str):
    """Delete routine."""
    # Get routine name before deleting for the log
    routine = get_routine_by_id(routine_id)
    routine_name = routine.get("name") if routine else "Unknown"
    
    success = delete_routine(routine_id)
    
    if success:
        log_event(
            "routine_deleted",
            data={"routine_id": routine_id, "name": routine_name},
            summary=f"Routine deleted: {routine_name}",
            ref_id=routine_id
        )
    
    return {"success": success}


@app.post("/api/routines/{routine_id}/toggle")
async def toggle_routine_api(routine_id: str):
    """Toggle routine enabled/disabled."""
    routine = toggle_routine(routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    return {"success": True, "enabled": routine["enabled"]}


@app.post("/api/routines/{routine_id}/run")
async def run_routine_api(routine_id: str):
    """Schedule routine as a future alarm."""
    routine = get_routine_by_id(routine_id)
    routine_name = routine.get("name") if routine else "Unknown"
    
    def execute():
        run_routine(routine_id)
    
    thread = threading.Thread(target=execute, daemon=True)
    thread.start()
    
    log_event(
        "routine_run",
        data={
            "routine_id": routine_id,
            "routine_name": routine_name,
            "mode": routine.get("mode") if routine else "unknown"
        },
        summary=f"Routine scheduled: {routine_name}",
        ref_id=routine_id
    )
    
    return {"success": True, "message": "Routine scheduled as alarm"}


@app.post("/api/routines/{routine_id}/execute")
async def execute_routine_now(routine_id: str):
    """Execute routine IMMEDIATELY - runs all devices and actions right now."""
    routine = get_routine_by_id(routine_id)
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    routine_name = routine.get("name", "Unknown")
    
    def execute():
        try:
            safe_print(f"\n{'='*50}")
            safe_print(f"  EXECUTING ROUTINE: {routine_name}")
            safe_print(f"  Mode: {routine.get('mode', 'normal')}")
            safe_print(f"  Devices: {len(routine.get('devices', []))}")
            safe_print(f"  Actions: {len(routine.get('actions', []))}")
            safe_print(f"{'='*50}\n")
            
            # Execute all device commands
            for device in routine.get("devices", []):
                dev_name = device.get("name") or device.get("id", "")
                dev_type = device.get("type", "")
                action = device.get("action", "on")
                
                try:
                    if dev_type == "ac":
                        # AC control
                        if action == "off":
                            execute_tuya_command("ac", f'"{ dev_name }"', "--power", "off")
                        else:
                            temp = str(device.get("temperature", 24))
                            mode = device.get("ac_mode", "cool")
                            execute_tuya_command("ac", f'"{ dev_name }"', "--power", "on", "--temp", temp, "--mode", mode)
                    elif dev_type == "light":
                        # Light control
                        if action == "off":
                            execute_tuya_command("off", dev_name)
                        else:
                            execute_tuya_command("on", dev_name)
                            time.sleep(0.3)
                            brightness = device.get("brightness", 100)
                            execute_tuya_command("brightness", dev_name, str(brightness))
                            time.sleep(0.2)
                            color = device.get("color", "white")
                            execute_tuya_command("color", dev_name, color)
                    else:
                        # Generic on/off
                        execute_tuya_command(action, dev_name)
                    
                    time.sleep(0.3)
                    safe_print(f"[DEVICE] {dev_name}: {action} OK")
                except Exception as e:
                    safe_print(f"[DEVICE] {dev_name}: ERROR - {e}")
            
            # Execute actions (voice/TTS)
            for act in routine.get("actions", []):
                act_id = act.get("id", "")
                try:
                    if act_id == "voice" and act.get("message"):
                        speak_tts(act["message"])
                        safe_print(f"[ACTION] TTS: {act['message'][:50]}...")
                    elif act_id == "spam":
                        msg = act.get("message", "BANGUN!")
                        speak_tts(msg)
                        safe_print(f"[ACTION] Spam TTS: {msg[:50]}...")
                except Exception as e:
                    safe_print(f"[ACTION] {act_id}: ERROR - {e}")
            
            safe_print(f"\n[ROUTINE] {routine_name} - DONE!")
            
            # Update routine stats
            routines = load_routines()
            for r in routines:
                if r["id"] == routine_id:
                    r["run_count"] = r.get("run_count", 0) + 1
                    r["last_triggered"] = datetime.now().isoformat()
                    break
            save_routines(routines)
            
        except Exception as e:
            safe_print(f"[ROUTINE] Execute error: {e}")
    
    thread = threading.Thread(target=execute, daemon=True)
    thread.start()
    
    log_event(
        "routine_run",
        data={
            "routine_id": routine_id,
            "routine_name": routine_name,
            "mode": routine.get("mode", "unknown"),
            "immediate": True
        },
        summary=f"Routine executed NOW: {routine_name}",
        ref_id=routine_id
    )
    
    return {"success": True, "message": f"Routine '{routine_name}' executing now", "routine": routine_name}


# Legacy routine activation (for backward compatibility)
@app.post("/api/routines/activate/{routine_name}")
async def activate_routine_legacy(routine_name: str):
    """Activate a routine by name (legacy endpoint)."""
    routines = {
        "morning": routine_morning,
        "work": routine_work,
        "sleep": routine_sleep,
        "movie": routine_movie
    }
    
    if routine_name not in routines:
        raise HTTPException(status_code=404, detail="Routine not found")
    
    def run_legacy():
        try:
            routines[routine_name]()
        except Exception as e:
            safe_print(f"[ROUTINE] Error: {e}")
    
    thread = threading.Thread(target=run_legacy, daemon=True)
    thread.start()
    
    return {"success": True, "routine": routine_name}


# Activity API
@app.get("/api/activity")
async def get_activity(limit: int = 10):
    """Get recent activity with formatted timestamps."""
    return get_recent_activity(limit)


@app.get("/api/activity/raw")
async def get_raw_activity(limit: int = 50):
    """Get raw activity log entries."""
    activities = load_activity()
    return activities[:limit]


# Analytics API
@app.get("/api/analytics")
async def get_analytics():
    """Get all analytics data."""
    return load_analytics()


@app.get("/api/analytics/score")
async def get_weekly_score():
    """Get weekly performance score."""
    return calculate_weekly_score()


@app.get("/api/analytics/heatmap")
async def get_heatmap():
    """Get snooze heatmap data by day and hour."""
    return get_snooze_heatmap()


@app.get("/api/analytics/calendar")
async def get_calendar():
    """Get historical calendar data for year view."""
    return get_calendar_data()


# Test API
@app.post("/api/test/{test_type}")
async def run_test(test_type: str, mode: str = "normal", text: str = "Test dari Shila Wake"):
    """Run test functions."""
    def run_in_thread():
        try:
            if test_type == "sound":
                test_sound()
            elif test_type == "lights":
                test_lights()
            elif test_type == "tts":
                test_tts(text)
            elif test_type == "wake":
                execute_wake(mode)
        except Exception as e:
            safe_print(f"[TEST] Error: {e}")
    
    thread = threading.Thread(target=run_in_thread, daemon=True)
    thread.start()
    
    return {"success": True, "test": test_type}


# Config API
@app.get("/api/config")
async def get_config():
    """Get configuration."""
    return load_config()


@app.post("/api/config")
async def update_config(request: Request):
    """Update configuration."""
    data = await request.json()
    config = load_config()
    config.update(data)
    save_config(config)
    return {"success": True, "config": config}


# Smart Home Quick Actions
@app.post("/api/lights/{action}")
async def control_lights(action: str, brightness: int = 100, color: str = "white"):
    """Quick light control — synchronous with per-device results."""
    def run():
        from wake_system import get_tuya_controller
        import time as _time
        
        controller = get_tuya_controller()
        if not controller:
            return {"success": False, "error": "No TuyaController", "results": [], "devices_ok": 0, "devices_total": 0}
        
        # Get all light devices
        light_categories = ['dj', 'dd', 'dsd', 'fwd', 'xdd', 'dc', 'tgq']
        light_devices = [
            d for d in controller.devices.values()
            if d.get('category', '').lower() in light_categories
        ]
        
        if not light_devices:
            return {"success": False, "error": "No light devices", "results": [], "devices_ok": 0, "devices_total": 0}
        
        total = len(light_devices)
        results = []
        ok_count = 0
        
        safe_print(f"[LIGHTS] {action.upper()} {total} device(s) | color={color} brightness={brightness}")
        
        for device in light_devices:
            name = device['name']
            try:
                if action == "off":
                    controller.turn_off(name)
                    results.append({"name": name, "status": "ok"})
                    ok_count += 1
                    safe_print(f"[LIGHTS] {name}: OFF OK")
                elif action == "on":
                    if color.lower() == "white":
                        controller.set_brightness(name, brightness, ensure_on=True)
                        _time.sleep(0.2)
                        controller.set_color(name, "white", ensure_on=False)
                        results.append({"name": name, "status": "ok"})
                        ok_count += 1
                        safe_print(f"[LIGHTS] {name}: WHITE {brightness}% OK")
                    else:
                        controller.set_color(name, color, ensure_on=True)
                        results.append({"name": name, "status": "ok"})
                        ok_count += 1
                        safe_print(f"[LIGHTS] {name}: {color.upper()} OK")
                _time.sleep(0.15)
            except Exception as e:
                results.append({"name": name, "status": "error", "error": str(e)})
                safe_print(f"[LIGHTS] {name}: ERROR - {e}")
        
        return {
            "success": ok_count > 0,
            "action": action,
            "color": color,
            "devices_ok": ok_count,
            "devices_total": total,
            "results": results
        }
    
    result = await asyncio.to_thread(run)
    return result


@app.post("/api/ac/{action}")
async def control_ac(action: str, temp: int = 24):
    """Quick AC control — synchronous with result feedback."""
    def run():
        from wake_system import get_tuya_controller, load_config
        
        controller = get_tuya_controller()
        if not controller:
            return {"success": False, "error": "No TuyaController"}
        
        config = load_config()
        ac_device = config.get('tuya', {}).get('ac_device', 'AC Studio')
        
        try:
            if action == "on":
                result = controller.control_ac(ac_device, power=True, temperature=temp)
                safe_print(f"[AC] ON {temp}°C: {result}")
                return {"success": result.get('success', False), "action": "on", "temp": temp, "device": ac_device}
            elif action == "off":
                result = controller.control_ac(ac_device, power=False)
                safe_print(f"[AC] OFF: {result}")
                return {"success": result.get('success', False), "action": "off", "device": ac_device}
            else:
                return {"success": False, "error": f"Unknown action: {action}"}
        except Exception as e:
            safe_print(f"[AC] Error: {e}")
            return {"success": False, "error": str(e)}
    
    result = await asyncio.to_thread(run)
    return result


# Manual check endpoint
@app.post("/api/check")
async def manual_check():
    """Manually trigger alarm/reminder check."""
    def run():
        safe_check_alarms()
        safe_check_reminders()
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    
    return {"success": True, "message": "Check triggered"}


# ===========================================================================
# System Quick Actions (mute, screenshot)
# ===========================================================================

@app.post("/api/system/mute")
async def system_mute():
    """Mute system audio."""
    def run():
        try:
            import subprocess
            # Use PowerShell to set volume to 0
            subprocess.run(
                ["powershell", "-Command",
                 "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"],
                capture_output=True, timeout=5
            )
        except Exception as e:
            safe_print(f"[MUTE] Error: {e}")
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return {"success": True, "action": "mute"}


@app.post("/api/system/unmute")
async def system_unmute():
    """Unmute system audio."""
    def run():
        try:
            import subprocess
            subprocess.run(
                ["powershell", "-Command",
                 "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"],
                capture_output=True, timeout=5
            )
        except Exception as e:
            safe_print(f"[UNMUTE] Error: {e}")
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return {"success": True, "action": "unmute"}


@app.post("/api/system/screenshot")
async def system_screenshot():
    """Take a screenshot and save to Desktop."""
    def run():
        try:
            import subprocess
            desktop = Path.home() / "Desktop"
            filename = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            filepath = desktop / filename
            # Use PowerShell to take screenshot
            ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save('{filepath}')
$graphics.Dispose()
$bitmap.Dispose()
"""
            subprocess.run(
                ["powershell", "-Command", ps_script],
                capture_output=True, timeout=10
            )
            safe_print(f"[SCREENSHOT] Saved to {filepath}")
        except Exception as e:
            safe_print(f"[SCREENSHOT] Error: {e}")
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return {"success": True, "action": "screenshot"}


# ===========================================================================
# Main
# ===========================================================================

def main():
    port = int(os.environ.get("SHILA_WAKE_PORT", 3000))
    
    safe_print(f"""
========================================================
       SHILA WAKE SYSTEM v2.0 - Web Dashboard
       
       Open http://localhost:{port} in browser
       
       Features:
       - Proper date handling
       - Auto date calculation
       - Stable scheduler
========================================================
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
