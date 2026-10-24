#!/usr/bin/env bash
# Build .env for the new AkuoSplash project using real secrets from .vercel.env.production
# Where Vercel marked values as "[SENSITIVE]", use a sensible fallback or local file.

set -euo pipefail

SRC_ENV="/home/z/my-project/.vercel.env.production"
DST="/home/z/my-project-akuosplash"
DST_ENV="$DST/.env"

# Helper: read var from Vercel env file (returns the value WITHOUT surrounding quotes)
get_var() {
  local val
  val=$(grep "^$1=" "$SRC_ENV" 2>/dev/null | head -1 | cut -d= -f2-)
  # Strip surrounding double-quotes if present
  val="${val#\"}"
  val="${val%\"}"
  echo "$val"
}

# Si el valor es [SENSITIVE] o está vacío, devolver string vacío
get_or_empty() {
  local v
  v=$(get_var "$1")
  if [ "$v" = "[SENSITIVE]" ] || [ -z "$v" ]; then
    echo ""
  else
    echo "$v"
  fi
}

# Generar cron secret nuevo (no estaba en Vercel)
CRON=$(openssl rand -base64 32 2>/dev/null || echo "cambiar-cron-manual")

# DB: usar SQLite local porque el DATABASE_URL real está marcado como [SENSITIVE]
# y no podemos leerlo. El usuario lo puede cambiar después por su Turso.
mkdir -p "$DST/db"
AKUO_DB_URL="file:/home/z/my-project-akuosplash/db/akuosplash.db"

cat > "$DST_ENV" <<EOF
# ============================================================
# AkuoSplash — Variables de entorno
# Generado desde .vercel.env.production de AljibeApp (valores reales)
# + secrets nuevos generados con openssl donde faltaban.
# En Vercel del nuevo proyecto, cargar las mismas vars.
# ============================================================

# --- Base de datos ---
# SQLite local para dev. En producción usar: libsql://<turso-db> (cambiar en Vercel)
AKUOSPLASH_DATABASE_URL=$AKUO_DB_URL
DATABASE_URL=$AKUO_DB_URL
DATABASE_AUTH_TOKEN=

# --- JWT ---
# Usamos el mismo que en producción para que tokens ya emitidos sigan funcionando
AKUOSPLASH_JWT_SECRET=$(get_or_empty "AKUOSPLASH_JWT_SECRET")
JWT_SECRET=$(get_or_empty "AKUOSPLASH_JWT_SECRET")

# --- App URL (placeholder; en Vercel usar https://<dominio-akuosplash>) ---
NEXT_PUBLIC_APP_URL=http://localhost:3001

# --- MercadoPago (cuenta principal) ---
AKUO_MP_ACCESS_TOKEN=$(get_or_empty "AKUO_MP_ACCESS_TOKEN")
AKUO_MP_PUBLIC_KEY=$(get_or_empty "AKUO_MP_PUBLIC_KEY")
AKUO_MP_CLIENT_ID=$(get_or_empty "AKUO_MP_CLIENT_ID")
AKUO_MP_CLIENT_SECRET=$(get_or_empty "AKUO_MP_CLIENT_SECRET")
AKUO_MP_USER_ID=$(get_or_empty "AKUO_MP_USER_ID")
AKUO_MP_SANDBOX=$(get_or_empty "AKUO_MP_SANDBOX")
NEXT_PUBLIC_AKUO_MP_PUBLIC_KEY=$(get_or_empty "AKUO_MP_PUBLIC_KEY")

# --- Cuentas split/sub de MP (si las tenés configuradas en Vercel, copialas acá) ---
AKUO_MP_SPLIT_ACCESS_TOKEN=$(get_or_empty "AKUO_MP_SPLIT_ACCESS_TOKEN")
AKUO_MP_SPLIT_PUBLIC_KEY=$(get_or_empty "AKUO_MP_SPLIT_PUBLIC_KEY")
AKUO_MP_SPLIT_USER_ID=$(get_or_empty "AKUO_MP_SPLIT_USER_ID")
AKUO_MP_SUB_ACCESS_TOKEN=$(get_or_empty "AKUO_MP_SUB_ACCESS_TOKEN")
AKUO_MP_SUB_PUBLIC_KEY=$(get_or_empty "AKUO_MP_SUB_PUBLIC_KEY")

# --- Transbank (sensitive en Vercel, copialos a mano desde tu cuenta de Transbank) ---
TRANSBANK_ENVIRONMENT=$(get_or_empty "TRANSBANK_ENVIRONMENT")
TRANSBANK_COMMERCE_CODE=$(get_or_empty "TRANSBANK_COMMERCE_CODE")
TRANSBANK_API_KEY=$(get_or_empty "TRANSBANK_API_KEY")

# --- Google OAuth ---
AKUO_GOOGLE_CLIENT_ID=$(get_or_empty "AKUO_GOOGLE_CLIENT_ID")
AKUO_GOOGLE_CLIENT_SECRET=$(get_or_empty "AKUO_GOOGLE_CLIENT_SECRET")

# --- Facebook OAuth ---
AKUO_FACEBOOK_APP_ID=$(get_or_empty "AKUO_FACEBOOK_APP_ID")
AKUO_FACEBOOK_APP_SECRET=$(get_or_empty "AKUO_FACEBOOK_APP_SECRET")

# --- Google Maps ---
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$(get_or_empty "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")

# --- Cron secret (nuevo, generar uno propio; para Vercel Cron Jobs) ---
AKUO_CRON_SECRET=$CRON
EOF

chmod 600 "$DST_ENV"

echo "✅ .env generado en: $DST_ENV"
echo ""
TOTAL=$(grep -E "^[A-Z_]+=" "$DST_ENV" | wc -l)
VACIOS=$(grep -E "^[A-Z_]+=$" "$DST_ENV" | wc -l)
echo "Total vars: $TOTAL"
echo "Vacías:     $VACIOS"
echo ""
if [ "$VACIOS" -gt 0 ]; then
  echo "Vars con valor pendiente (copiar a mano desde Vercel o cuentas externas):"
  grep -E "^[A-Z_]+=$" "$DST_ENV" | cut -d= -f1 | sed 's/^/  - /'
fi
