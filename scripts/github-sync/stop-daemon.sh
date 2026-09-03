#!/usr/bin/env bash
# Detiene el daemon de sincronización.
set -euo pipefail
DIR=/home/z/my-project/scripts/github-sync
PID_FILE="$DIR/sync-daemon.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No hay daemon corriendo (PID file no existe)."
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  sleep 1
  if kill -0 "$PID" 2>/dev/null; then
    echo "Daemon no terminó, enviando SIGKILL."
    kill -9 "$PID"
  fi
  echo "Daemon detenido (PID=$PID)."
else
  echo "Proceso $PID no encontrado. Limpiando PID file."
fi
rm -f "$PID_FILE"
