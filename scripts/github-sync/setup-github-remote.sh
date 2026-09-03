#!/usr/bin/env bash
# Setup inicial: crea el repo en GitHub y configura el remote.
# Uso:
#   GH_TOKEN=xxxx ./setup-github-remote.sh <repo-name> <visibility> <owner>
#   visibility: "private" o "public"
#   owner: usuario u organización de GitHub (ej: akuobara)
set -euo pipefail

REPO_NAME="${1:-aljibe-app}"
VISIBILITY="${2:-private}"
OWNER="${3:-}"
TOKEN="${GH_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Falta GH_TOKEN (Personal Access Token de GitHub)"
  exit 1
fi
if [[ -z "$OWNER" ]]; then
  # Detectar owner desde el API /user
  OWNER=$(curl -fsSL -H "Authorization: Bearer $TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/user | grep -oE '"login": *"[^"]+"' | head -1 | cut -d'"' -f4)
  if [[ -z "$OWNER" ]]; then
    echo "ERROR: no se pudo detectar el owner. Pásalo como 3er argumento."
    exit 1
  fi
fi

PRIVATE_FLAG="true"
[[ "$VISIBILITY" == "public" ]] && PRIVATE_FLAG="false"

echo "==> Owner:      $OWNER"
echo "==> Repo name:  $REPO_NAME"
echo "==> Visibility: $VISIBILITY"
echo ""

# 1. Crear repo (si no existe)
echo "==> Creando repo $OWNER/$REPO_NAME (si no existe)..."
HTTP_CODE=$(curl -s -o /tmp/gh-create.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"private\":$PRIVATE_FLAG,\"description\":\"Aljibe App — Registro de entregas de agua, pagos, gastos y liquidación\"}")

if [[ "$HTTP_CODE" == "201" ]]; then
  echo "   Repo creado."
elif [[ "$HTTP_CODE" == "422" ]]; then
  echo "   El repo ya existe, continuamos."
else
  echo "ERROR creando repo (HTTP $HTTP_CODE):"
  cat /tmp/gh-create.json
  exit 1
fi

# 2. Configurar remote con token embebido (para que los push no pidan password)
cd /home/z/my-project
REMOTE_URL="https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO_NAME}.git"

# Quitar remote previo si existe
if git remote get-url origin >/dev/null 2>&1; then
  git remote remove origin
fi
git remote add origin "$REMOTE_URL"
# Guardar URL sin token para no filtrarlo en logs
git config remote.origin.url "https://github.com/${OWNER}/${REPO_NAME}.git"
# Pero configurar credential helper con el token embebido
git config credential.helper "store --file=/home/z/my-project/.git-credentials"
echo "https://x-access-token:${TOKEN}@github.com" > /home/z/my-project/.git-credentials
chmod 600 /home/z/my-project/.git-credentials

echo ""
echo "==> Remote configurado:"
git remote -v

# 3. Asegurar .gitignore para no subir cosas pesadas
if [[ ! -f .gitignore ]] || ! grep -q "node_modules" .gitignore; then
  cat >> .gitignore <<'EOF'

# GitHub sync — excluir artefactos pesados
node_modules/
.next/
.vercel/
*.log
.env.local
.env.*.local
db/*.db-journal
upload/
public/uploads/
tool-results/
.zscripts/
EOF
fi

# 4. Branch por defecto
git symbolic-ref HEAD refs/heads/main 2>/dev/null || true

echo ""
echo "==> Listo. Ahora corre: ./scripts/github-sync/sync-now.sh"
