#!/usr/bin/env python3
"""
Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY on Vercel project (production + preview + development env).

Usage:
    python3 /home/z/my-project/scripts/set-google-maps-env.py "AIzaSy..."

If no argument is given, reads from /home/z/my-project/.env (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
"""
import os
import sys
import json
import urllib.request

PROJECT_ROOT = "/home/z/my-project"
PROJECT_ID = "prj_V2BpfVdfv4FRaE8RXpCWxhRe3Iy5"
TEAM_ID = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
TOKEN = open(f"{PROJECT_ROOT}/.vercel-token").read().strip()
ENV_NAME = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"


def get_key_from_args_or_env():
    if len(sys.argv) >= 2 and sys.argv[1].strip():
        return sys.argv[1].strip()
    # try .env
    env_path = f"{PROJECT_ROOT}/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{ENV_NAME}="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val
    return ""


def fetch_current_envs():
    url = f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env?teamId={TEAM_ID}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"Error al obtener env vars: {e}", file=sys.stderr)
        sys.exit(1)


def delete_env(env_id):
    url = f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env/{env_id}?teamId={TEAM_ID}"
    req = urllib.request.Request(url, method="DELETE", headers={
        "Authorization": f"Bearer {TOKEN}",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status in (200, 204)
    except Exception as e:
        print(f"  WARN: no se pudo borrar {env_id}: {e}", file=sys.stderr)
        return False


def create_env(key_value):
    # Crear en 3 targets: production, preview, development (todas públicas para Next.js)
    targets = ["production", "preview", "development"]
    for target in targets:
        body = json.dumps({
            "key": ENV_NAME,
            "value": key_value,
            "type": "encrypted",
            "target": [target],
        }).encode()
        url = f"https://api.vercel.com/v10/projects/{PROJECT_ID}/env?teamId={TEAM_ID}&upsert=true"
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
                print(f"  ✓ {target}: created/updated (id={data.get('id', '?')})")
        except Exception as e:
            print(f"  FAIL {target}: {e}", file=sys.stderr)


def main():
    key = get_key_from_args_or_env()
    if not key:
        print("ERROR: Necesito la API key.", file=sys.stderr)
        print("Uso: python3 set-google-maps-env.py 'AIzaSy...'", file=sys.stderr)
        print("  O pega el valor en /home/z/my-project/.env después de NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=", file=sys.stderr)
        sys.exit(1)

    print(f"→ Seteando {ENV_NAME} en Vercel (project {PROJECT_ID})...")
    # Borrar las existentes primero
    print("→ Buscando variables existentes para borrarlas...")
    current = fetch_current_envs()
    deleted = 0
    for env in current.get("envs", []):
        if env.get("key") == ENV_NAME:
            ok = delete_env(env["id"])
            if ok:
                deleted += 1
    print(f"  Eliminadas {deleted} vars existentes")
    # Crear nuevas
    print("→ Creando nueva var en 3 targets (production/preview/development)...")
    create_env(key)
    # También actualizar .env local
    env_path = f"{PROJECT_ROOT}/.env"
    lines = []
    found = False
    with open(env_path) as f:
        for line in f:
            if line.startswith(f"{ENV_NAME}="):
                lines.append(f"{ENV_NAME}={key}\n")
                found = True
            else:
                lines.append(line)
    if not found:
        lines.append(f"{ENV_NAME}={key}\n")
    with open(env_path, "w") as f:
        f.writelines(lines)
    print(f"  ✓ .env local actualizado")
    print(f"\n✅ Listo. La próxima vez que se haga deploy, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY estará disponible.")
    print(f"   La variable es pública (NEXT_PUBLIC_) - el browser la necesita para cargar Google Maps.")


if __name__ == "__main__":
    main()
