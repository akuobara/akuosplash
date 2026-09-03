#!/usr/bin/env bash
# Instala un cron job que sincroniza el repo cada N minutos (default 30).
# Uso: ./install-cron.sh [intervalo-minutos]
set -euo pipefail

INTERVAL="${1:-30}"
CRON_LINE="*/${INTERVAL} * * * * /home/z/my-project/scripts/github-sync/sync-now.sh >> /home/z/my-project/scripts/github-sync/cron.log 2>&1"

# Remover entradas previas
TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v "github-sync/sync-now.sh" > "$TMP" || true
echo "$CRON_LINE" >> "$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "==> Cron instalado:"
echo "    $CRON_LINE"
echo ""
echo "==> Estado actual de crontab:"
crontab -l 2>&1
echo ""
echo "Logs en: /home/z/my-project/scripts/github-sync/cron.log"
echo "Logs de sync en: /home/z/my-project/scripts/github-sync/sync.log"
