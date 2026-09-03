#!/usr/bin/env bash
# Desinstala el cron job de sincronización.
set -euo pipefail
TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v "github-sync/sync-now.sh" > "$TMP" || true
crontab "$TMP"
rm -f "$TMP"
echo "==> Cron desinstalado."
crontab -l 2>&1 || echo "(crontab vacío)"
