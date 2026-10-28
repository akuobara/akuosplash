#!/usr/bin/env python3
"""Poll deployment 10c36d0e"""
import subprocess, json, time

TOKEN = "cfut_8CjLnfA7cDyDvx844zQzg76mEunFrBIQaETyAcpV2c659dc0"
ACCOUNT_ID = "e52792b0c5a1a025f63775d4103b8928"
PROJECT = "akuosplash"
DEPLOY_ID = "10c36d0e-..."  # need full ID

def get_deploys():
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                       f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last = None
while time.time() - start < 1500:  # 25 min max
    d = get_deploys()
    for dep in d.get('result', []):
        if dep.get('short_id') == '10c36d0e':
            ls = dep.get('latest_stage', {})
            name = ls.get('name')
            status = ls.get('status')
            if status != last:
                print(f"[{int(time.time()-start)}s] stage={name} status={status}", flush=True)
                last = status
            if status in ('success', 'failure'):
                print(f"\n=== FINAL: {status} ===", flush=True)
                for s in dep.get('stages', []):
                    print(f"  {s.get('name'):15s} | {s.get('status')}", flush=True)
                # Fetch logs if failed
                if status == 'failure':
                    full_id = dep.get('id')
                    lr = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments/{full_id}/history/logs"],
                        capture_output=True, text=True)
                    try:
                        ld = json.loads(lr.stdout)
                        data = ld.get('result', {}).get('data', [])
                        print(f"\n=== Last 80 log lines ===", flush=True)
                        for e in data[-80:]:
                            line = e.get('line', '').rstrip()
                            if line:
                                print(line, flush=True)
                    except Exception as e:
                        print(f"log fetch error: {e}", flush=True)
                print(f"\nurl: {dep.get('url')}", flush=True)
                sys.exit(0)
            break
    time.sleep(20)

print("\nTimeout 25min.", flush=True)
