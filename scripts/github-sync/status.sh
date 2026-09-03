#!/usr/bin/env bash
# Muestra el estado del daemon y de la última sincronización.
set -euo pipefail
DIR=/home/z/my-project/scripts/github-sync
PID_FILE="$DIR/sync-daemon.pid"

echo "=== ESTADO SYNC GITHUB ==="
echo ""

# Daemon
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "✅ Daemon corriendo (PID=$PID)"
    ps -p "$PID" -o pid,etime,cmd 2>&1 | head -2
  else
    echo "❌ Daemon NO corriendo (PID file stale: $PID)"
  fi
else
  echo "❌ Daemon NO corriendo (sin PID file)"
fi
echo ""

# Remote
cd /home/z/my-project
if git remote get-url origin >/dev/null 2>&1; then
  echo "✅ Remote 'origin' configurado: $(git remote get-url origin)"
  echo "   Último commit: $(git log -1 --oneline --date=format:'%Y-%m-%d %H:%M' --format='%h | %ad | %s')"
  echo "   Cambios sin commitear: $(git status --short | wc -l) archivos"
else
  echo "❌ No hay remote 'origin' configurado."
fi
echo ""

# Últimas 10 líneas del log
if [[ -f "$DIR/sync.log" ]]; then
  echo "=== Últimas 10 líneas de sync.log ==="
  tail -10 "$DIR/sync.log"
else
  echo "No hay sync.log todavía (el daemon no ha corrido aún)."
fi
