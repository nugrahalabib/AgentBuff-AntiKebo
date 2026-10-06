"""
Event Logger Module for Shila Wake System

Provides comprehensive event logging with structured data for:
- Analytics tracking
- Shila AI context awareness
- Historical data query

All events are stored in event_logs.json with full metadata.
"""

import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict

# File paths
SKILL_DIR = Path(__file__).parent.parent
EVENT_LOGS_FILE = SKILL_DIR / "event_logs.json"

# Event categories and types
EVENT_TYPES = {
    # Alarm events
    "alarm_created": {"category": "alarm", "icon": "⏰"},
    "alarm_updated": {"category": "alarm", "icon": "✏️"},
    "alarm_deleted": {"category": "alarm", "icon": "🗑️"},
    "alarm_triggered": {"category": "alarm", "icon": "🔔"},
    "alarm_snoozed": {"category": "alarm", "icon": "😴"},
    "alarm_dismissed": {"category": "alarm", "icon": "✅"},
    "alarm_missed": {"category": "alarm", "icon": "❌"},
    
    # Routine events
    "routine_created": {"category": "routine", "icon": "➕"},
    "routine_updated": {"category": "routine", "icon": "✏️"},
    "routine_deleted": {"category": "routine", "icon": "🗑️"},
    "routine_run": {"category": "routine", "icon": "▶️"},
    
    # Device events
    "device_activated": {"category": "device", "icon": "💡"},
    "device_failed": {"category": "device", "icon": "⚠️"},
    
    # Action events
    "action_executed": {"category": "action", "icon": "⚡"},
    "tts_speak": {"category": "action", "icon": "🔊"},
    "spam_started": {"category": "action", "icon": "🚨"},
    "spam_stopped": {"category": "action", "icon": "🛑"},
    
    # System events
    "system_start": {"category": "system", "icon": "🚀"},
    "system_stop": {"category": "system", "icon": "🔴"},
    "config_updated": {"category": "system", "icon": "⚙️"},
    "error": {"category": "system", "icon": "❗"},
}


def load_events() -> List[Dict]:
    """Load all events from file."""
    if EVENT_LOGS_FILE.exists():
        try:
            with open(EVENT_LOGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[EVENT_LOGGER] Error loading events: {e}")
    return []


def save_events(events: List[Dict]):
    """Save events to file."""
    try:
        with open(EVENT_LOGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[EVENT_LOGGER] Error saving events: {e}")


def log_event(
    event_type: str,
    data: Dict[str, Any] = None,
    summary: str = None,
    ref_id: str = None
) -> Dict:
    """
    Log an event with structured data.
    
    Args:
        event_type: Type of event (see EVENT_TYPES)
        data: Event-specific data dictionary
        summary: Human-readable summary
        ref_id: Reference ID (alarm_id, routine_id, etc.)
    
    Returns:
        The created event entry
    """
    now = datetime.now()
    
    # Get event metadata
    event_meta = EVENT_TYPES.get(event_type, {"category": "other", "icon": "📝"})
    
    # Build event entry
    event = {
        "id": f"evt_{int(time.time() * 1000)}",
        "timestamp": now.isoformat(),
        "event_type": event_type,
        "category": event_meta["category"],
        "icon": event_meta["icon"],
        
        # Date/time components for easy filtering
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "day_of_week": now.strftime("%A"),
        "hour": now.hour,
        
        # Event data
        "data": data or {},
        "summary": summary or f"{event_type.replace('_', ' ').title()}",
        "ref_id": ref_id
    }
    
    # Load, append, and save
    events = load_events()
    events.insert(0, event)  # Newest first
    save_events(events)
    
    print(f"[EVENT] {event_meta['icon']} {event['summary']}")
    
    return event


def get_events(
    event_type: str = None,
    category: str = None,
    date_from: str = None,
    date_to: str = None,
    ref_id: str = None,
    limit: int = 100,
    offset: int = 0,
    search: str = None
) -> Dict:
    """
    Query events with filters.
    
    Args:
        event_type: Filter by event type
        category: Filter by category (alarm, routine, device, action, system)
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
        ref_id: Filter by reference ID
        limit: Maximum results
        offset: Pagination offset
        search: Text search in summary
    
    Returns:
        Dict with events list and pagination info
    """
    events = load_events()
    
    # Apply filters
    filtered = []
    for evt in events:
        # Type filter
        if event_type and evt.get("event_type") != event_type:
            continue
        
        # Category filter
        if category and evt.get("category") != category:
            continue
        
        # Date range filter
        evt_date = evt.get("date", "")
        if date_from and evt_date < date_from:
            continue
        if date_to and evt_date > date_to:
            continue
        
        # Reference ID filter
        if ref_id and evt.get("ref_id") != ref_id:
            continue
        
        # Text search
        if search:
            search_lower = search.lower()
            if search_lower not in evt.get("summary", "").lower():
                # Also search in data
                data_str = json.dumps(evt.get("data", {})).lower()
                if search_lower not in data_str:
                    continue
        
        filtered.append(evt)
    
    total = len(filtered)
    
    # Apply pagination
    paginated = filtered[offset:offset + limit]
    
    return {
        "events": paginated,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total
    }


def get_stats() -> Dict:
    """
    Get aggregated statistics for analytics page.
    
    Returns comprehensive stats for:
    - Wake performance
    - Mode distribution
    - Snooze patterns
    - Device usage
    - Alarm time patterns
    """
    events = load_events()
    
    # Initialize stats
    stats = {
        "total_events": len(events),
        
        # Alarm stats
        "alarms": {
            "total_created": 0,
            "total_triggered": 0,
            "total_dismissed": 0,
            "total_snoozed": 0,
            "total_missed": 0,
        },
        
        # Mode distribution
        "mode_distribution": {
            "gentle": 0,
            "normal": 0,
            "nuclear": 0
        },
        
        # Time patterns (hour -> count)
        "alarm_hours": defaultdict(int),
        
        # Snooze heatmap (day -> hour -> count)
        "snooze_heatmap": {
            day: {hour: 0 for hour in range(5, 13)}
            for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        },
        
        # Device usage
        "device_usage": defaultdict(int),
        
        # Routine stats
        "routine_runs": defaultdict(int),
        
        # Daily data for calendar
        "daily_data": defaultdict(lambda: {"triggered": 0, "snoozed": 0, "dismissed": 0}),
        
        # Streaks
        "streaks": {
            "current": 0,
            "longest": 0
        },
        
        # Weekly score (last 7 days)
        "weekly": {
            "on_time": 0,
            "late": 0,
            "total": 0,
            "score": 0
        }
    }
    
    # Get date range for weekly
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    
    # Track consecutive days without snooze for streak
    no_snooze_days = set()
    snooze_days = set()
    
    for evt in events:
        evt_type = evt.get("event_type", "")
        evt_data = evt.get("data", {})
        evt_date = evt.get("date", "")
        evt_day = evt.get("day_of_week", "")
        evt_hour = evt.get("hour", 0)
        
        # Count alarm events
        if evt_type == "alarm_created":
            stats["alarms"]["total_created"] += 1
            mode = evt_data.get("mode", "normal")
            if mode in stats["mode_distribution"]:
                stats["mode_distribution"][mode] += 1
            
            # Track alarm hours
            alarm_time = evt_data.get("time", "")
            if alarm_time:
                try:
                    hour = int(alarm_time.split(":")[0])
                    stats["alarm_hours"][f"{hour:02d}:00"] += 1
                except:
                    pass
        
        elif evt_type == "alarm_triggered":
            stats["alarms"]["total_triggered"] += 1
            stats["daily_data"][evt_date]["triggered"] += 1
            
            # Track devices
            devices = evt_data.get("devices", [])
            for device in devices:
                if isinstance(device, dict):
                    stats["device_usage"][device.get("name", device.get("id", "unknown"))] += 1
                else:
                    stats["device_usage"][str(device)] += 1
        
        elif evt_type == "alarm_snoozed":
            stats["alarms"]["total_snoozed"] += 1
            stats["daily_data"][evt_date]["snoozed"] += 1
            snooze_days.add(evt_date)
            
            # Snooze heatmap
            if evt_day in stats["snooze_heatmap"] and 5 <= evt_hour <= 12:
                stats["snooze_heatmap"][evt_day][evt_hour] += 1
        
        elif evt_type == "alarm_dismissed":
            stats["alarms"]["total_dismissed"] += 1
            stats["daily_data"][evt_date]["dismissed"] += 1
            
            # Check if on-time (within weekly period)
            try:
                evt_date_obj = datetime.strptime(evt_date, "%Y-%m-%d").date()
                if evt_date_obj >= week_ago:
                    snooze_count = evt_data.get("snooze_count", 0)
                    stats["weekly"]["total"] += 1
                    if snooze_count == 0:
                        stats["weekly"]["on_time"] += 1
                        no_snooze_days.add(evt_date)
                    else:
                        stats["weekly"]["late"] += 1
            except:
                pass
        
        elif evt_type == "alarm_missed":
            stats["alarms"]["total_missed"] += 1
        
        elif evt_type == "routine_run":
            routine_name = evt_data.get("routine_name", "Unknown")
            stats["routine_runs"][routine_name] += 1
        
        elif evt_type == "device_activated":
            device_name = evt_data.get("device_name", evt_data.get("device_id", "unknown"))
            stats["device_usage"][device_name] += 1
    
    # Calculate weekly score
    if stats["weekly"]["total"] > 0:
        stats["weekly"]["score"] = round(
            (stats["weekly"]["on_time"] / stats["weekly"]["total"]) * 100
        )
    
    # Calculate streaks (simplified)
    if no_snooze_days:
        sorted_dates = sorted(no_snooze_days, reverse=True)
        current_streak = 0
        longest_streak = 0
        streak = 0
        prev_date = None
        
        for date_str in sorted_dates:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                if prev_date is None:
                    streak = 1
                elif (prev_date - date_obj).days == 1:
                    streak += 1
                else:
                    if streak > longest_streak:
                        longest_streak = streak
                    streak = 1
                prev_date = date_obj
            except:
                continue
        
        if streak > longest_streak:
            longest_streak = streak
        
        # Current streak is the first consecutive sequence from today
        current_streak = 0
        check_date = today
        for _ in range(30):  # Check up to 30 days
            if check_date.strftime("%Y-%m-%d") in no_snooze_days:
                current_streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        
        stats["streaks"]["current"] = current_streak
        stats["streaks"]["longest"] = longest_streak
    
    # Convert defaultdicts to regular dicts for JSON serialization
    stats["alarm_hours"] = dict(stats["alarm_hours"])
    stats["device_usage"] = dict(stats["device_usage"])
    stats["routine_runs"] = dict(stats["routine_runs"])
    stats["daily_data"] = dict(stats["daily_data"])
    
    return stats


def get_optimal_wake_time() -> Dict:
    """
    Calculate optimal wake time based on snooze patterns.
    
    Algorithm:
    1. Group alarms by wake time (hour:minute)
    2. Calculate average snooze count for each time
    3. Find time with lowest snooze rate
    4. Generate scatter plot data points
    
    Returns:
        Dict with optimal_time, scatter_points, and analysis data
    """
    events = load_events()
    
    # Group by alarm time - collect triggered/snoozed/dismissed data
    time_stats = defaultdict(lambda: {"triggered": 0, "snoozed": 0, "dismissed": 0, "snooze_counts": []})
    
    # Track snooze counts per alarm instance
    alarm_sessions = {}  # alarm_id -> {time, snooze_count}
    
    for event in events:
        event_type = event.get("event_type", "")
        data = event.get("data", {})
        
        if event_type == "alarm_triggered":
            alarm_time = data.get("alarm_time", "")
            alarm_id = data.get("alarm_id", "")
            if alarm_time and alarm_id:
                time_stats[alarm_time]["triggered"] += 1
                alarm_sessions[alarm_id] = {"time": alarm_time, "snooze_count": 0}
                
        elif event_type == "alarm_snoozed":
            alarm_id = data.get("alarm_id", event.get("ref_id", ""))
            if alarm_id in alarm_sessions:
                alarm_sessions[alarm_id]["snooze_count"] += 1
                
        elif event_type == "alarm_dismissed":
            alarm_id = data.get("alarm_id", event.get("ref_id", ""))
            if alarm_id in alarm_sessions:
                session = alarm_sessions[alarm_id]
                alarm_time = session["time"]
                time_stats[alarm_time]["dismissed"] += 1
                time_stats[alarm_time]["snooze_counts"].append(session["snooze_count"])
                del alarm_sessions[alarm_id]
    
    # Calculate average snooze per time
    time_analysis = []
    for alarm_time, stats in time_stats.items():
        if stats["snooze_counts"]:
            avg_snooze = sum(stats["snooze_counts"]) / len(stats["snooze_counts"])
        else:
            avg_snooze = 0
        
        time_analysis.append({
            "time": alarm_time,
            "triggered": stats["triggered"],
            "dismissed": stats["dismissed"],
            "avg_snooze": round(avg_snooze, 2),
            "snooze_rate": round(sum(stats["snooze_counts"]) / max(stats["triggered"], 1), 2)
        })
    
    # Sort by time for scatter plot
    time_analysis.sort(key=lambda x: x["time"])
    
    # Find optimal time (lowest avg snooze with at least 2 data points)
    optimal = None
    min_snooze = float('inf')
    for t in time_analysis:
        if t["triggered"] >= 2 and t["avg_snooze"] < min_snooze:
            min_snooze = t["avg_snooze"]
            optimal = t
    
    # Generate scatter points for chart (normalize positions)
    scatter_points = []
    if time_analysis:
        max_snooze = max(t["avg_snooze"] for t in time_analysis) or 5
        
        for i, t in enumerate(time_analysis[:8]):  # Max 8 points
            # X position based on time (5:00-10:00 range)
            try:
                hour, minute = t["time"].split(":")
                x_val = int(hour) + int(minute) / 60
                x_percent = max(5, min(95, (x_val - 5) * 100 / 5))  # Map 5:00-10:00 to 5%-95%
            except:
                x_percent = (i + 1) * 12
            
            # Y position based on snooze (bottom to top)
            y_percent = min(95, (t["avg_snooze"] / max(max_snooze, 1)) * 90 + 5)
            
            # Determine color class
            if t["avg_snooze"] <= 1:
                color_class = "low"
            elif t["avg_snooze"] <= 2.5:
                color_class = "medium"
            else:
                color_class = "high"
            
            # Mark optimal
            is_optimal = optimal and t["time"] == optimal["time"]
            
            scatter_points.append({
                "time": t["time"],
                "x": round(x_percent),
                "y": round(y_percent),
                "snooze": t["avg_snooze"],
                "triggered": t["triggered"],
                "class": "optimal" if is_optimal else color_class
            })
    
    return {
        "optimal_time": optimal["time"] if optimal else None,
        "optimal_snooze": optimal["avg_snooze"] if optimal else None,
        "scatter_points": scatter_points,
        "time_analysis": time_analysis,
        "has_data": len(time_analysis) > 0
    }


def generate_ai_insights(stats: Dict = None) -> List[Dict]:
    """
    Generate dynamic AI insights based on actual data patterns.
    
    Analyzes:
    - Snooze patterns (worst day/time)
    - Mode effectiveness
    - Routine usage
    - Wake time optimization
    
    Returns:
        List of insight cards with type, title, description, action
    """
    if stats is None:
        stats = get_stats()
    
    insights = []
    
    # 1. Snooze Pattern Insight
    snooze_heatmap = stats.get("snooze_heatmap", {})
    max_snooze = 0
    worst_day = None
    worst_hour = None
    for day, hours in snooze_heatmap.items():
        for hour, count in hours.items():
            if count > max_snooze:
                max_snooze = count
                worst_day = day
                worst_hour = hour
    
    if worst_day and max_snooze > 0:
        insights.append({
            "type": "adjust",
            "icon": "⏰",
            "category": "Alarm",
            "title": f"Difficult Wake Time: {worst_day}",
            "description": f"You snooze most often on {worst_day} around {worst_hour}:00. Consider using Nuclear mode or setting alarm 15 minutes earlier on this day.",
            "action": "Adjust Alarm",
            "action_type": "settings"
        })
    
    # 2. Mode Distribution Insight
    mode_dist = stats.get("mode_distribution", {})
    total_modes = sum(mode_dist.values())
    if total_modes > 0:
        # Check if using mostly gentle mode but having snooze issues
        gentle_pct = mode_dist.get("gentle", 0) / total_modes * 100
        alarms = stats.get("alarms", {})
        snooze_rate = alarms.get("total_snoozed", 0) / max(alarms.get("total_triggered", 1), 1) * 100
        
        if gentle_pct > 50 and snooze_rate > 30:
            insights.append({
                "type": "optimize",
                "icon": "🔥",
                "category": "Mode",
                "title": "Try Stronger Wake Modes",
                "description": f"You use Gentle mode {round(gentle_pct)}% of the time but snooze {round(snooze_rate)}% of alarms. Consider Normal or Nuclear mode for better results.",
                "action": "View Modes",
                "action_type": "settings"
            })
        elif mode_dist.get("nuclear", 0) > mode_dist.get("gentle", 0) + mode_dist.get("normal", 0):
            # Using mostly nuclear - might be able to relax
            if snooze_rate < 15:
                insights.append({
                    "type": "optimize",
                    "icon": "🌅",
                    "category": "Mode",
                    "title": "Great Wake Discipline!",
                    "description": f"With only {round(snooze_rate)}% snooze rate, you might try Gentle mode for a more pleasant wake experience.",
                    "action": "Try Gentle",
                    "action_type": "suggestion"
                })
    
    # 3. Streak Insight
    streaks = stats.get("streaks", {})
    current_streak = streaks.get("current", 0)
    longest_streak = streaks.get("longest", 0)
    
    if current_streak >= 3:
        insights.append({
            "type": "achievement",
            "icon": "🏆",
            "category": "Streak",
            "title": f"Amazing {current_streak}-Day Streak!",
            "description": f"You haven't snoozed in {current_streak} days! {'You broke your record!' if current_streak >= longest_streak else f'Your record is {longest_streak} days - keep going!'}",
            "action": "Keep Going",
            "action_type": "motivation"
        })
    elif current_streak == 0 and longest_streak > 0:
        insights.append({
            "type": "limit",
            "icon": "💪",
            "category": "Challenge",
            "title": "Start a New Streak",
            "description": f"Your best streak was {longest_streak} days. Wake up without snoozing tomorrow to start building a new streak!",
            "action": "Accept Challenge",
            "action_type": "motivation"
        })
    
    # 4. Device Usage Insight
    device_usage = stats.get("device_usage", {})
    if device_usage:
        most_used = max(device_usage.items(), key=lambda x: x[1]) if device_usage else None
        if most_used and most_used[1] > 5:
            insights.append({
                "type": "info",
                "icon": "💡",
                "category": "Devices",
                "title": f"Favorite Wake Device: {most_used[0]}",
                "description": f"'{most_used[0]}' has been activated {most_used[1]} times. Make sure it's always ready for optimal wake experience.",
                "action": "Check Device",
                "action_type": "info"
            })
    
    # 5. Weekly Performance Insight
    weekly = stats.get("weekly", {})
    weekly_score = weekly.get("score", 0)
    if weekly_score > 0:
        if weekly_score >= 80:
            insights.append({
                "type": "achievement",
                "icon": "⭐",
                "category": "Performance",
                "title": f"Excellent Week: {weekly_score}% On-Time!",
                "description": "You're waking up like a champion! Keep up the great work and maintain your routine.",
                "action": "View Stats",
                "action_type": "stats"
            })
        elif weekly_score < 50:
            insights.append({
                "type": "limit",
                "icon": "📉",
                "category": "Performance",
                "title": f"Room for Improvement: {weekly_score}%",
                "description": "This week's wake performance needs attention. Try going to bed 30 minutes earlier tonight.",
                "action": "Sleep Tips",
                "action_type": "suggestion"
            })
    
    # If no insights generated, provide a default
    if not insights:
        insights.append({
            "type": "info",
            "icon": "📊",
            "category": "Getting Started",
            "title": "Building Your Profile",
            "description": "Keep using Shila Wake for a few more days to get personalized insights based on your patterns!",
            "action": "Got It",
            "action_type": "info"
        })
    
    # Limit to 3 most relevant insights
    return insights[:3]


def get_recent_summary(days: int = 7) -> str:
    """
    Get a text summary of recent events for Shila context.
    
    Args:
        days: Number of days to summarize
    
    Returns:
        Human-readable summary text
    """
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    result = get_events(date_from=cutoff, limit=500)
    events = result["events"]
    
    if not events:
        return f"No events in the last {days} days."
    
    # Count by category
    by_category = defaultdict(list)
    for evt in events:
        by_category[evt.get("category", "other")].append(evt)
    
    lines = [f"## Shila Wake Events (Last {days} Days)", ""]
    
    if "alarm" in by_category:
        alarm_events = by_category["alarm"]
        triggered = sum(1 for e in alarm_events if e["event_type"] == "alarm_triggered")
        dismissed = sum(1 for e in alarm_events if e["event_type"] == "alarm_dismissed")
        snoozed = sum(1 for e in alarm_events if e["event_type"] == "alarm_snoozed")
        lines.append(f"**Alarms**: {triggered} triggered, {dismissed} dismissed, {snoozed} snoozed")
    
    if "routine" in by_category:
        routine_runs = sum(1 for e in by_category["routine"] if e["event_type"] == "routine_run")
        lines.append(f"**Routines**: {routine_runs} executed")
    
    if "device" in by_category:
        device_activations = len(by_category["device"])
        lines.append(f"**Devices**: {device_activations} activations")
    
    lines.append("")
    lines.append("### Recent Activity")
    for evt in events[:10]:
        lines.append(f"- {evt['icon']} {evt['summary']} ({evt['date']} {evt['time'][:5]})")
    
    return "\n".join(lines)


# Initialize: log system start if file is new
if not EVENT_LOGS_FILE.exists():
    log_event(
        "system_start",
        data={"version": "1.0.0"},
        summary="Shila Wake Event Logger initialized"
    )
