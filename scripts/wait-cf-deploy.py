#!/usr/bin/env python3
"""Poll the Cloudflare Pages deployment until it's done, then report status."""
import subprocess, json, time

TOKEN = "cfut_8CjLnfA7cDyDvx844zQzg76mEunFrBIQaETyAcpV2c659dc0"
ACCOUNT_ID = "e52792b0c5a1a025f63775d4103b8928"
PROJECT = "akuosplash"
DEPLOY_ID = "ec40c78d-53ac-4794-bd31-21f1defeed41"

def get_deploy():
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                       f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments/{DEPLOY_ID}"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last = None
while time.time() - start < 900:  # 15 min max
    d = get_deploy()
    r = d.get('result', {})
    latest_stage = r.get('latest_stage', {})
    name = latest_stage.get('name')
    status = latest_stage.get('status')
    if status != last:
        print(f"[{int(time.time()-start)}s] stage={name} status={status}", flush=True)
        last = status
    if status in ('success', 'failure'):
        print(f"\n=== FINAL: {status} ===", flush=True)
        stages = r.get('stages', [])
        for s in stages:
            print(f"  {s.get('name'):15s} | {s.get('status')}", flush=True)
        # Print build log if failed
        if status == 'failure':
            print("\n=== Fetching build logs ===", flush=True)
            log_r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                                   f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments/{DEPLOY_ID}/history/logs"],
                                  capture_output=True, text=True)
            try:
                log_data = json.loads(log_r.stdout)
                logs = log_data.get('result', {}).get('data', [])
                print(f"\nTotal log lines: {len(logs)}", flush=True)
                print("=== Last 100 lines ===", flush=True)
                for entry in logs[-100:]:
                    line = entry.get('message', '').strip()
                    if line:
                        print(line, flush=True)
            except Exception as e:
                print(f"log parse error: {e}", flush=True)
                print(f"raw: {log_r.stdout[:500]}", flush=True)
        break
    time.sleep(15)

# Final URL
d = get_deploy()
r = d.get('result', {})
print(f"\n=== Deployment info ===", flush=True)
print(f"  url: {r.get('url')}", flush=True)
print(f"  environment: {r.get('environment')}", flush=True)
print(f"  aliases: {r.get('aliases')}", flush=True)
