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
