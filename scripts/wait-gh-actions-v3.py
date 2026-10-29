#!/usr/bin/env python3
"""Poll GH Actions run 40759163790"""
import subprocess, json, time, sys
GH_TOKEN = "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"
REPO = "akuobara/akuosplash"
RUN_ID = "40759163790"
def get_run():
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: token {GH_TOKEN}",
                       f"https://api.github.com/repos/{REPO}/actions/runs/{RUN_ID}"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}
start = time.time()
last = None
while time.time() - start < 1800:
    d = get_run()
    s = d.get('status'); c = d.get('conclusion')
    if (s, c) != last:
        print(f"[{int(time.time()-start)}s] status={s} conclusion={c}", flush=True)
        last = (s, c)
    if s == 'completed':
        print(f"\n=== FINAL: {c} ===", flush=True)
        if c == 'failure':
            # Download logs
            subprocess.run(["curl", "-sSL", "-o", "/tmp/gh-logs-v3.zip", "-H", f"Authorization: token {GH_TOKEN}",
                           f"https://api.github.com/repos/{REPO}/actions/runs/{RUN_ID}/logs"], capture_output=True)
            subprocess.run(["bash", "-c", "cd /tmp && rm -rf gh-logs-v3 && mkdir gh-logs-v3 && unzip -q gh-logs-v3.zip -d gh-logs-v3 2>/dev/null"], capture_output=True)
            print("\n=== Last 80 log lines (across all files) ===", flush=True)
            subprocess.run(["bash", "-c", "cat /tmp/gh-logs-v3/*.txt /tmp/gh-logs-v3/**/*.txt 2>/dev/null | tail -80"], capture_output=False)
        break
    time.sleep(15)
d = get_run()
print(f"\nhtml_url: {d.get('html_url')}", flush=True)
