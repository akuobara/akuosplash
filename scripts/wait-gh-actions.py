#!/usr/bin/env python3
"""Poll GitHub Actions run until done."""
import subprocess, json, time, sys

GH_TOKEN = "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"
REPO = "akuobara/akuosplash"
RUN_ID = "40758416039"

def get_run():
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: token {GH_TOKEN}",
                       f"https://api.github.com/repos/{REPO}/actions/runs/{RUN_ID}"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last = None
while time.time() - start < 1800:  # 30 min max
    d = get_run()
    status = d.get('status')
    conclusion = d.get('conclusion')
    if (status, conclusion) != last:
        print(f"[{int(time.time()-start)}s] status={status} conclusion={conclusion}", flush=True)
        last = (status, conclusion)
    if status == 'completed':
        print(f"\n=== FINAL: {conclusion} ===", flush=True)
        # Get job info
        jr = subprocess.run(["curl", "-sS", "-H", f"Authorization: token {GH_TOKEN}",
                            f"https://api.github.com/repos/{REPO}/actions/runs/{RUN_ID}/jobs"],
                           capture_output=True, text=True)
        jobs = json.loads(jr.stdout).get('jobs', [])
        for job in jobs:
            print(f"\nJob: {job.get('name')} | conclusion: {job.get('conclusion')}", flush=True)
            for step in job.get('steps', []):
                mark = '✓' if step.get('conclusion') == 'success' else '✗' if step.get('conclusion') == 'failure' else '○'
                print(f"  {mark} {step.get('name')} ({step.get('conclusion')})", flush=True)
        break
    time.sleep(15)

# If failed, fetch logs
d = get_run()
if d.get('conclusion') == 'failure':
    print("\n=== Fetching build logs ===", flush=True)
    lr = subprocess.run(["curl", "-sSL", "-o", "/tmp/gh-logs-v2.zip", "-H", f"Authorization: token {GH_TOKEN}",
                       f"https://api.github.com/repos/{REPO}/actions/runs/{RUN_ID}/logs"],
                      capture_output=True, text=True)
    subprocess.run(["bash", "-c", "cd /tmp && rm -rf gh-logs-v2 && mkdir gh-logs-v2 && unzip -q gh-logs-v2.zip -d gh-logs-v2 2>/dev/null"], capture_output=True)
    print("Last 100 lines of all logs:", flush=True)
    subprocess.run(["bash", "-c", "cat /tmp/gh-logs-v2/*.txt /tmp/gh-logs-v2/**/*.txt 2>/dev/null | tail -100"], capture_output=False)

# Final run status
d = get_run()
print(f"\n=== Final run state ===", flush=True)
print(f"  status: {d.get('status')}", flush=True)
print(f"  conclusion: {d.get('conclusion')}", flush=True)
print(f"  html_url: {d.get('html_url')}", flush=True)
