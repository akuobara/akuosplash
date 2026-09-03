#!/usr/bin/env bash
# Inicia el daemon de sincronización en background.
# Uso: ./start-daemon.sh [intervalo-minutos]
set -euo pipefail

INTERVAL="${1:-30}"
DIR=/home/z/my-project/scripts/github-sync
PID_FILE="$DIR/sync-daemon.pid"

# Si ya está corriendo, no hacer nada
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Daemon ya corriendo (PID=$PID). Nada que hacer."
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# Lanzar en background
nohup node "$DIR/sync-daemon.js" "$INTERVAL" >> "$DIR/daemon.out" 2>&1 &
NEW_PID=$!
sleep 1
echo "Daemon iniciado (PID=$NEW_PID). Intervalo=${INTERVAL} min."
echo "  Logs: $DIR/daemon.log"
echo "  Para detener: kill $NEW_PID  (o ./stop-daemon.sh)"
