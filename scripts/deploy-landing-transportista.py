#!/usr/bin/env python3
"""
Deploy de la landing page nueva a Vercel (project "akuosplash").

Estrategia:
1. Recrear /home/z/my-project-akuosplash/ como copia limpia de /home/z/my-project/
   PERO excluyendo rutas/componentes específicos de AljibeApp (bolson, cliente, camiones,
   super-admin, admin-*, suscripcion, src/components/app/*).
2. Agregar src/app/page.tsx que hace redirect a /akuosplash (sin exponer el dashboard Aljibe).
3. Agregar .vercel/project.json link al project existente (prj_vVnmGI87GQM4wBszNZq8tw7kdPRo).
4. Reusar node_modules desde /home/z/my-project via symlink (skip 934-package npm install).
5. Deploy con `vercel deploy --prod --token`.
"""
import os, shutil, subprocess, sys, json, time

SRC = "/home/z/my-project"
DST = "/home/z/my-project-akuosplash"
VERCEL_TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"
ORG_ID = "team_BcC6nLGDaPF8NFDXQ6q97JsX"

# Directorios/archivos a excluir del copy (AljibeApp-specific)
EXCLUDE_DIRS = {
    # AljibeApp routes
    "src/app/bolson",
    "src/app/camiones",
    "src/app/cliente",
    "src/app/super-admin",
    "src/app/suscripcion",
    "src/app/admin-activar-pedidos-choferes",
    "src/app/admin-demo-setup",
    "src/app/admin-fix-estanques",
    "src/app/admin-migrate-audit",
    "src/app/admin-migrate-db",
    "src/app/mapa-clientes",
    # AljibeApp components (NO excluir src/components/ui, src/components/akuosplash)
    "src/components/app",
    "src/components/aljibe-app",
    "src/components/aljibe-*",
    # Otros
    "node_modules",
    ".next",
    ".git",
    ".vercel",
    "scripts",
    "agent-ctx",
    "download",
    "worklog.md",
    ".env",
    ".env.local",
    ".env.production",
    ".vercel.env.production",
    "db",
}

def run(cmd, cwd=None, env=None, check=True):
    print(f"$ {cmd}", flush=True)
    result = subprocess.run(cmd, shell=True, cwd=cwd, env=env, capture_output=False)
    if check and result.returncode != 0:
        print(f"FAILED: {cmd} (exit {result.returncode})", flush=True)
        sys.exit(1)
    return result.returncode

def rm_dst():
    if os.path.exists(DST):
        print(f"[1/6] Eliminando {DST} ...", flush=True)
        shutil.rmtree(DST)
    os.makedirs(DST, exist_ok=True)

def copy_files():
    print(f"[2/6] Copiando archivos de {SRC} a {DST} (excluyendo AljibeApp)...", flush=True)
    # rsync con excludes
    excludes_arg = " ".join(f"--exclude={d}" for d in EXCLUDE_DIRS)
    run(f"rsync -a {excludes_arg} {SRC}/ {DST}/")

def write_redirect_root():
    print("[3/6] Escribiendo root page.tsx que redirige a /akuosplash ...", flush=True)
    page_path = os.path.join(DST, "src/app/page.tsx")
    with open(page_path, "w") as f:
        f.write(
            "import { redirect } from \"next/navigation\";\n"
            "export default function RootPage() {\n"
            "  redirect(\"/akuosplash\");\n"
            "}\n"
        )

def write_env():
    print("[4/6] Escribiendo .env con credenciales ...", flush=True)
    env_path = os.path.join(DST, ".env")
    # El .env DEBE tener los valores reales para que el build/runtime los use
    env_content = """# AkuoSplash deploy env
DATABASE_URL="libsql://aljibeapp-akuobara.aws-us-west-2.turso.io"
DATABASE_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
AKUOSPLASH_JWT_SECRET="akuosplash-jwt-secret-prod-2026-secure-random-x9k2m"
AKUO_FACEBOOK_APP_ID="2095394961067992"
AKUO_FACEBOOK_APP_SECRET="5c3e50ecf3087d4f498a8bee1e853055"
AKUO_GOOGLE_CLIENT_ID="109876197648-nkqitom82d4gqmu4ramisb2n5v7ejcg1.apps.googleusercontent.com"
AKUO_GOOGLE_CLIENT_SECRET="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"
AKUO_MP_ACCESS_TOKEN="APP_USR-2731961034891399-100523-9a2ea0da114449c3d67fe3255fffdce3-3738974993"
AKUO_MP_CLIENT_ID="2731961034891399"
AKUO_MP_PUBLIC_KEY="APP_USR-01c8fba9-52cb-4fc9-92f3-0ee8cbf73c0b"
AKUO_MP_SANDBOX="true"
AKUO_MP_USER_ID="3738974993"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyBuZ4DbUyF2lmX-0tmcdoiptbwodKZJxFM"
NEXT_PUBLIC_APP_URL="https://akuosplash.vercel.app"
AKUO_CRON_SECRET=""
"""
    with open(env_path, "w") as f:
        f.write(env_content)

def link_vercel_project():
    print("[5/6] Linkeando a Vercel project existente (akuosplash) ...", flush=True)
    vercel_dir = os.path.join(DST, ".vercel")
    os.makedirs(vercel_dir, exist_ok=True)
    project_json_path = os.path.join(vercel_dir, "project.json")
    with open(project_json_path, "w") as f:
        json.dump({
            "orgId": ORG_ID,
            "projectId": PROJECT_ID,
        }, f, indent=2)
    # También escribir .vercel/project.json para que vercel CLI no pida input interactivo
    print(f"  → {project_json_path}", flush=True)

def symlink_node_modules():
    print("[6/6] Symlinking node_modules desde AljibeApp (skip npm install) ...", flush=True)
    nm_dst = os.path.join(DST, "node_modules")
    nm_src = os.path.join(SRC, "node_modules")
    if os.path.exists(nm_dst) and os.path.islink(nm_dst):
        os.unlink(nm_dst)
    elif os.path.exists(nm_dst):
        shutil.rmtree(nm_dst)
    if os.path.isdir(nm_src):
        os.symlink(nm_src, nm_dst)
        print(f"  → {nm_dst} → {nm_src}", flush=True)
    else:
        print("  ! node_modules no existe en SRC — corriendo npm install ...", flush=True)
        run("npm install --omit=dev", cwd=DST)

def deploy():
    print("\n=== DEPLOY ===", flush=True)
    env = os.environ.copy()
    env["VERCEL_TOKEN"] = VERCEL_TOKEN
    # --yes = skip prompts
    # --prod = deploy to production
    # --token = use token from env
    cmd = f"cd {DST} && npx vercel deploy --yes --prod --token=$VERCEL_TOKEN 2>&1"
    print(f"$ {cmd.replace(VERCEL_TOKEN, '***')}", flush=True)
    result = subprocess.run(["bash", "-c", cmd], env=env, capture_output=True, text=True)
    print(result.stdout, flush=True)
    if result.stderr:
        print("STDERR:", result.stderr, flush=True)
    if result.returncode != 0:
        print(f"FAILED deploy (exit {result.returncode})", flush=True)
        sys.exit(1)
    # Extraer URL del output (última línea tipo https://akuosplash-xxx.vercel.app o akuosplash.vercel.app)
    url = None
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.startswith("https://") and "vercel.app" in line:
            url = line.split()[0]
    if url:
        print(f"\n✓ DEPLOYED: {url}", flush=True)
    return url

def smoke_test(url):
    print(f"\n=== SMOKE TEST {url} ===", flush=True)
    tests = [
        ("/", "307 redirect a /akuosplash"),
        ("/akuosplash", "200"),
        ("/akuosplash/quiero-repartir", "200 — la landing nueva"),
        ("/akuosplash/transportista", "200 — dashboard"),
        ("/api/akuosplash/auth/me", "200 — API DB ok"),
    ]
    for path, desc in tests:
        full = url.rstrip("/") + path
        # Usar -sS y capturar http_code
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", full],
                          capture_output=True, text=True)
        code = r.stdout.strip()
        print(f"  {code:4s} {full}  [{desc}]", flush=True)

def main():
    rm_dst()
    copy_files()
    write_redirect_root()
    write_env()
    link_vercel_project()
    symlink_node_modules()
    url = deploy()
    if url:
        smoke_test(url)
        print(f"\n=== LISTO ===\nLanding nueva: {url}/akuosplash/quiero-repartir", flush=True)

if __name__ == "__main__":
    main()
