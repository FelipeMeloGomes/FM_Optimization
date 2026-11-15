#!/usr/bin/env python3
"""
Memory calibration script for FM Optimize.
Starts the app, monitors memory of all processes, reports peak heap.
"""
import psutil
import time
import subprocess
import sys
import os

APP_PATH = r"C:\Programacao\FM_Optimization\dist\win-unpacked\fm-optimize.exe"
MONITOR_DURATION = 30  # seconds
SAMPLE_INTERVAL = 0.5  # seconds

def get_fm_optimize_processes():
    """Return list of psutil.Process for all fm-optimize.exe processes."""
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'exe']):
        try:
            if p.info['name'] and 'fm-optimize' in p.info['name'].lower():
                procs.append(p)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return procs

def get_memory_info(proc):
    """Get memory info for a process."""
    try:
        mem = proc.memory_info()
        return {
            'pid': proc.pid,
            'rss_mb': mem.rss / 1024 / 1024,
            'vms_mb': mem.vms / 1024 / 1024,
        }
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None

def main():
    print(f"Starting {APP_PATH}...")
    if not os.path.exists(APP_PATH):
        print(f"ERROR: App not found at {APP_PATH}")
        sys.exit(1)

    # Start the app
    proc = subprocess.Popen([APP_PATH], 
                           creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    
    print(f"Launched (PID: {proc.pid}), waiting 3s for startup...")
    time.sleep(3)

    # Monitor memory
    print(f"\nMonitoring memory for {MONITOR_DURATION}s (interval: {SAMPLE_INTERVAL}s)...")
    print("-" * 80)
    
    peak_rss = {}
    start_time = time.time()
    
    try:
        while time.time() - start_time < MONITOR_DURATION:
            procs = get_fm_optimize_processes()
            
            for p in procs:
                info = get_memory_info(p)
                if info:
                    pid = info['pid']
                    rss = info['rss_mb']
                    
                    if pid not in peak_rss or rss > peak_rss[pid]['rss_mb']:
                        peak_rss[pid] = info
                    
                    # Print current status
                    print(f"PID {pid:6d} | RSS: {rss:7.1f} MB | Peak: {peak_rss[pid]['rss_mb']:7.1f} MB")
            
            print("-" * 80)
            time.sleep(SAMPLE_INTERVAL)
            
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    finally:
        # Clean up
        print("\nTerminating app...")
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        
        # Kill any remaining fm-optimize processes
        for p in get_fm_optimize_processes():
            try:
                p.terminate()
            except:
                pass

    # Report results
    print("\n" + "=" * 80)
    print("CALIBRATION RESULTS")
    print("=" * 80)
    
    total_peak = sum(p['rss_mb'] for p in peak_rss.values())
    
    for pid, info in sorted(peak_rss.items(), key=lambda x: x[1]['rss_mb'], reverse=True):
        print(f"PID {pid:6d} | Peak RSS: {info['rss_mb']:7.1f} MB")
    
    print("-" * 80)
    print(f"Total Peak RSS (all processes): {total_peak:.1f} MB")
    
    # Find renderer process (usually the largest non-main, non-gpu)
    # Heuristic: renderer typically has --type=renderer in cmdline
    renderer_peak = 0
    for pid, info in peak_rss.items():
        try:
            p = psutil.Process(pid)
            cmdline = ' '.join(p.cmdline())
            if '--type=renderer' in cmdline:
                renderer_peak = info['rss_mb']
                print(f"Renderer process (PID {pid}): Peak RSS = {renderer_peak:.1f} MB")
                break
        except:
            pass
    
    if renderer_peak == 0 and peak_rss:
        # Fallback: assume largest process is renderer
        max_pid = max(peak_rss.items(), key=lambda x: x[1]['rss_mb'])[0]
        renderer_peak = peak_rss[max_pid]['rss_mb']
        print(f"Assumed renderer (PID {max_pid}): Peak RSS = {renderer_peak:.1f} MB")
    
    # Calculate recommended limit
    recommended = int(renderer_peak * 1.2 / 64) * 64  # round to 64MB
    print(f"\nRecommended --max-old-space-size: {recommended} MB (peak × 1.2, rounded to 64MB)")
    
    return recommended

if __name__ == '__main__':
    main()