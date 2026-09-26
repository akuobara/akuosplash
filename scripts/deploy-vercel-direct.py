#!/usr/bin/env python3
"""
Deploy the project to Vercel directly without GitHub.
Uses the Vercel v13 deployments API with file upload.

Flow:
1. Collect all project files (skip node_modules, .git, db, etc.)
2. Compute SHA1 for each file (git blob format: "blob SIZE\0CONTENT")
3. POST the list of {file, sha, size} to Vercel to create the deployment
4. Vercel returns a list of missing SHAs (files it doesn't have cached)
5. Upload those files to the S3 URLs Vercel provides
6. Poll the deployment until it's READY
"""

import os
import sys
import json
import hashlib
import urllib.request
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

PROJECT_ROOT = "/home/z/my-project"
PROJECT_ID = "prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5"
TEAM_ID = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
TOKEN = open(f"{PROJECT_ROOT}/.vercel-token").read().strip()

SKIP_DIRS = {
    ".git", "node_modules", ".next", "db", "download",
    "tool-results", "agent-ctx", "scripts", "examples", "mini-services",
    "skills", ".turbo", "coverage",
}
# Estos solo se saltan al nivel TOP-LEVEL (directamente bajo /home/z/my-project)
# No se aplican a subdirectorios (ej: src/app/api/upload/ NO se debe saltar)
SKIP_TOP_LEVEL_DIRS = {"upload"}
SKIP_FILES = {
    ".vercel-token", ".git-credentials", ".env", ".env.local", ".env.production",
    "package-lock.json", "bun.lock", ".DS_Store",
}
SKIP_PREFIXES = (".bash", ".cache")


def ensure_critical_files():
    """Ensure critical files exist before deploy. Some files get deleted by
    the sandbox reset between sessions. Recreate them if missing."""
    critical_files = {
        "src/app/api/upload/route.ts": '''import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Archivo muy pesado" }, { status: 400 });
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(file.type)) return NextResponse.json({ error: "Tipo no permitido" }, { status: 400 });
    const ext = file.name.split(".").pop() || "jpg";
    const safeName = "aljibe/" + duenoId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    try {
      const blob = await put(safeName, file, { access: "public", addRandomSuffix: false });
      return NextResponse.json({ url: blob.url, size: file.size, type: file.type });
    } catch (blobError) {
      console.error("Blob upload failed, falling back to base64:", blobError);
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = "data:" + file.type + ";base64," + base64;
      return NextResponse.json({ url: dataUrl, size: file.size, type: file.type, fallback: "base64" });
    }
  } catch (e) {
    console.error("Error en /api/upload:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "No se pudo subir: " + msg }, { status: 500 });
  }
}
''',
    }
    for relpath, content in critical_files.items():
        fullpath = os.path.join(PROJECT_ROOT, relpath)
        dirname = os.path.dirname(fullpath)
        if not os.path.exists(fullpath):
            os.makedirs(dirname, exist_ok=True)
            with open(fullpath, "w") as f:
                f.write(content)
            print(f"  ✓ Recreated missing file: {relpath}")


def collect_files():
    """Walk the project, return list of {file, sha, size, content}."""
    files = []
    for root, dirs, fnames in os.walk(PROJECT_ROOT, topdown=True):
        # Filter dirs in place:
        # - SKIP_DIRS se aplica en cualquier nivel (node_modules, .git, etc.)
        # - SKIP_TOP_LEVEL_DIRS solo al nivel raíz (ej: upload/ para screenshots)
        rel_root = os.path.relpath(root, PROJECT_ROOT)
        is_top_level = rel_root == "."
        dirs[:] = [d for d in dirs
                   if d not in SKIP_DIRS
                   and not d.startswith(".git")
                   and not (is_top_level and d in SKIP_TOP_LEVEL_DIRS)]
        for fname in fnames:
            if fname in SKIP_FILES:
                continue
            if any(fname.startswith(p) for p in SKIP_PREFIXES):
                continue
            fullpath = os.path.join(root, fname)
            try:
                with open(fullpath, "rb") as f:
                    content = f.read()
                # Vercel expects raw SHA1 of the content (NOT git blob format)
                sha = hashlib.sha1(content).hexdigest()
                relpath = os.path.relpath(fullpath, PROJECT_ROOT)
                # Normalize for Windows-style (just in case)
                relpath = relpath.replace("\\", "/")
                files.append({
                    "file": relpath,
                    "sha": sha,
                    "size": len(content),
                    "content": content,
                })
            except Exception as e:
                print(f"WARN: skipping {fullpath}: {e}", file=sys.stderr)
    return files


def create_deployment(files_meta):
    """POST /v13/deployments with file metadata. Returns deployment JSON.
    On 400 with code=missing_files, Vercel returns the list of SHAs it needs
    uploaded. We catch that and return the missing list to the caller."""
    payload = {
        "name": "my-project",
        "project": PROJECT_ID,
        "target": "production",
        "files": files_meta,
    }
    body = json.dumps(payload).encode()
    url = f"https://api.vercel.com/v13/deployments?teamId={TEAM_ID}"
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        # If it's missing_files, that's expected — Vercel wants us to upload them
        # then call /v2/files/upload with the same payload again
        try:
            data = json.loads(body_text)
        except Exception:
            data = {}
        if data.get("error", {}).get("code") == "missing_files":
            return {"missing": data["error"]["missing"]}
        print(f"HTTP {e.code} from Vercel:", file=sys.stderr)
        print(body_text, file=sys.stderr)
        sys.exit(1)


def upload_one(sha, file_obj):
    """Upload one file. Returns (sha, ok, err)."""
    url = f"https://api.vercel.com/v2/files?teamId={TEAM_ID}"
    try:
        r = requests.post(url,
            data=file_obj["content"],
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/octet-stream",
                "x-vercel-digest": sha,
            },
            timeout=60,
        )
        if r.status_code in (200, 201, 202):
            return (sha, True, None)
        return (sha, False, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        return (sha, False, str(e))


def upload_missing_files(missing_shas, files_by_sha):
    """Upload files Vercel doesn't have cached yet, in parallel."""
    if not missing_shas:
        print("✓ All files already cached in Vercel")
        return True
    print(f"⏫ Uploading {len(missing_shas)} new files (parallel)...")
    todo = []
    for sha in missing_shas:
        f = files_by_sha.get(sha)
        if not f:
            print(f"  WARN: no local content for {sha[:12]}", file=sys.stderr)
            continue
        todo.append((sha, f))

    ok = 0
    fail = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(upload_one, sha, f): sha for (sha, f) in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            sha, success, err = fut.result()
            if success:
                ok += 1
            else:
                fail += 1
                print(f"  FAIL: {files_by_sha[sha]['file']} — {err}", file=sys.stderr)
            if i % 50 == 0 or i == len(todo):
                print(f"  [{i}/{len(todo)}] ok={ok} fail={fail}")
    print(f"✓ Upload: {ok} OK, {fail} failed")
    return fail == 0


def wait_for_deployment(deploy_id):
    """Poll /v13/deployments/{id} until state is READY or ERROR."""
    url = f"https://api.vercel.com/v13/deployments/{deploy_id}?teamId={TEAM_ID}"
    import time
    for i in range(40):  # 40 * 5s = 200s max
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read())
            state = data.get("readyState") or data.get("status")
            print(f"  [{i+1}] state={state}")
            if state == "READY":
                return data
            if state in ("ERROR", "CANCELED"):
                print(f"Deployment failed: {state}", file=sys.stderr)
                print(json.dumps(data, indent=2)[:2000], file=sys.stderr)
                sys.exit(1)
        except Exception as e:
            print(f"  WARN: poll error: {e}", file=sys.stderr)
        time.sleep(5)
    print("Timed out waiting for deployment", file=sys.stderr)
    sys.exit(1)


def main():
    print("→ Ensuring critical files exist...")
    ensure_critical_files()
    print("→ Collecting files...")
    files = collect_files()
    print(f"  Found {len(files)} files")

    files_meta = [{"file": f["file"], "sha": f["sha"], "size": f["size"]} for f in files]
    files_by_sha = {f["sha"]: f for f in files}

    print("→ Creating deployment on Vercel...")
    resp = create_deployment(files_meta)

    # If Vercel says missing_files, upload them first then retry the deployment
    missing = resp.get("missing")
    if missing:
        success = upload_missing_files(missing, files_by_sha)
        if not success:
            print("ERROR: some uploads failed, aborting", file=sys.stderr)
            sys.exit(1)
        # Retry deployment now that files are uploaded
        print("→ Retrying deployment creation after upload...")
        resp = create_deployment(files_meta)

    deploy_id = resp.get("id")
    if not deploy_id:
        print("ERROR: Vercel didn't return a deployment id", file=sys.stderr)
        print(json.dumps(resp, indent=2)[:2000], file=sys.stderr)
        sys.exit(1)
    print(f"  Deployment id: {deploy_id}")

    print("→ Waiting for build...")
    final = wait_for_deployment(deploy_id)
    url = final.get("url") or (final.get("alias") or [None])[0]
    print(f"\n✅ READY: https://{url}")

    # === Assign production domain to this deploy ===
    # Without this, my-project-azure-five-82.vercel.app keeps pointing to an old deploy
    production_domain = "my-project-azure-five-82.vercel.app"
    print(f"→ Assigning production domain {production_domain} to deploy {deploy_id}...")
    try:
        alias_resp = requests.post(
            f"https://api.vercel.com/v2/deployments/{deploy_id}/aliases?teamId={TEAM_ID}",
            json={"alias": production_domain},
            headers={"Authorization": f"Bearer {TOKEN}"},
            timeout=30,
        )
        if alias_resp.status_code in (200, 201):
            print(f"  ✓ Production domain assigned to {production_domain}")
        else:
            print(f"  WARN: alias assignment HTTP {alias_resp.status_code}: {alias_resp.text[:200]}", file=sys.stderr)
    except Exception as e:
        print(f"  WARN: couldn't assign alias: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
