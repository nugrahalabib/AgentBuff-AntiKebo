#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
Shila Wake System - Launcher
Starts the Web Server for the alarm system.
Note: Desktop app has been removed. Use auto-start hook via OpenClaw.
"""
import os
import sys
import subprocess
import threading
import time
import signal
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

processes = []
running = True


def start_web_server():
    """Start the web dashboard server."""
    print("[LAUNCHER] Starting Web Server...")
    
    # Get port from env or use default
    port = os.environ.get("SHILA_WAKE_PORT", "3000")
    
    proc = subprocess.Popen(
        [sys.executable, str(SCRIPT_DIR / "web_server.py")],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ, "SHILA_WAKE_PORT": port}
    )
    processes.append(("Web Server", proc))
    return proc, port


def monitor_process(name, proc):
    """Monitor a process and print its output."""
    try:
        for line in proc.stdout:
            if line.strip():
                print(f"[{name}] {line.strip()}")
    except:
        pass


def cleanup(sig=None, frame=None):
    """Cleanup all processes."""
    global running
    running = False
    
    print("\n[LAUNCHER] Shutting down...")
    
    for name, proc in processes:
        try:
            print(f"[LAUNCHER] Stopping {name}...")
            proc.terminate()
            proc.wait(timeout=5)
        except:
            proc.kill()
    
    print("[LAUNCHER] All processes stopped.")
    sys.exit(0)


def main():
    port = os.environ.get("SHILA_WAKE_PORT", "3000")
    
    print(f"""
================================================================
            SHILA WAKE SYSTEM - LAUNCHER
            
   Starting alarm system...
   
   Components:
   - Web Dashboard  -> http://localhost:{port}
   - Scheduler      -> Background (runs in web server)
   
   Press Ctrl+C to stop
================================================================
    """)
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # Start web server
    web_proc, port = start_web_server()
    time.sleep(2)
    
    # Start monitoring thread
    threading.Thread(target=monitor_process, args=("WEB", web_proc), daemon=True).start()
    
    print("\n[LAUNCHER] Web server started!")
    print(f"[LAUNCHER] Open http://localhost:{port} in your browser")
    print("[LAUNCHER] Press Ctrl+C to stop\n")
    
    # Open browser automatically
    time.sleep(2)
    try:
        import webbrowser
        webbrowser.open(f"http://localhost:{port}")
    except:
        pass
    
    # Keep running
    try:
        while running:
            for name, proc in processes:
                if proc.poll() is not None:
                    print(f"[LAUNCHER] {name} has stopped (exit code: {proc.returncode})")
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
