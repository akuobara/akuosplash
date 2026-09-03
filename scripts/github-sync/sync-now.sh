#!/usr/bin/env bash
# Sincroniza el código local con GitHub.
# - Hace commit automático de cambios sin commitear (mensaje con timestamp)
# - Hace push a origin/main
# Diseñado para correr manualmente o vía cron.
set -euo pipefail

cd /home/z/my-project

LOG=/home/z/my-project/scripts/github-sync/sync.log
TS=$(date '+%Y-%m-%d %H:%M:%S %Z')
echo "[$TS] === sync start ===" >> "$LOG"

# 1. Verificar remote
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[$TS] ERROR: no hay remote 'origin'. Correr setup-github-remote.sh primero" >> "$LOG"
  exit 1
fi

# 2. Verificar credenciales
if [[ ! -f /home/z/my-project/.git-credentials ]]; then
  echo "[$TS] ERROR: falta .git-credentials. Correr setup-github-remote.sh" >> "$LOG"
  exit 1
fi

# 3. Stage cambios (respetando .gitignore)
git add -A

# 3b. PROTECCIÓN: nunca commitear archivos sensibles (aunque estén staged)
SENSITIVE_PATTERNS=(
  '.git-credentials'
  '.env'
  '.env.local'
  '.env.*.local'
  '.vercel-token'
  'db/*.db'
  'db/*.db-journal'
  '*.pem'
  '*.key'
  'upload/'
  'public/uploads/'
  'tool-results/'
  'download/*.zip'
)
for pat in "${SENSITIVE_PATTERNS[@]}"; do
  if git ls-files --cached -- "$pat" | grep -q .; then
    echo "[$TS] WARN: removiendo del stage archivo sensible: $pat" >> "$LOG"
    git ls-files --cached -- "$pat" | xargs -r git reset -q HEAD --
  fi
done

# 3c. Verificación final: abortar si todavía quedan staged archivos sensibles
STAGED_SENSITIVE=$(git diff --cached --name-only | grep -E '^(\.git-credentials|\.env|\.vercel-token|.*\.pem|.*\.key)$' || true)
if [[ -n "$STAGED_SENSITIVE" ]]; then
  echo "[$TS] ABORT: archivos sensibles quedaron staged: $STAGED_SENSITIVE" >> "$LOG"
  exit 2
fi

# 4. Si hay cambios, commit
if ! git diff --cached --quiet; then
  MSG="auto-sync ${TS}"
  git -c user.name="auto-sync" -c user.email="auto-sync@aljibe.local" \
      commit -m "$MSG" >> "$LOG" 2>&1
  echo "[$TS] commit: $MSG" >> "$LOG"
else
  echo "[$TS] sin cambios para commitear" >> "$LOG"
fi

# 5. Push
echo "[$TS] pushing..." >> "$LOG"
if git push origin main >> "$LOG" 2>&1; then
  echo "[$TS] push OK" >> "$LOG"
else
  echo "[$TS] ERROR en push" >> "$LOG"
  exit 1
fi

echo "[$TS] === sync done ===" >> "$LOG"
