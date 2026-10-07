#!/bin/bash
# Copia todos los componentes de Aljibe (src/components/app/) a AkuoSplash (src/components/akuosplash/)
# con find-replace de: BD, auth, API paths, model names, brand
# NO toca los archivos originales de Aljibe

SRC="/home/z/my-project/src/components/app"
DST="/home/z/my-project/src/components/akuosplash"

for f in $SRC/*.tsx; do
  base=$(basename "$f")
  # No sobrescribir archivos que ya creamos específicamente para AkuoSplash
  if [ "$base" = "stat-card.tsx" ] || [ "$base" = "akuosplash-cliente.tsx" ] || [ "$base" = "akuosplash-transportista.tsx" ] || [ "$base" = "akuosplash-chofer-dashboard.tsx" ] || [ "$base" = "akuosplash-utils.ts" ] || [ "$base" = "akuosplash-perfil-cliente.tsx" ] || [ "$base" = "akuosplash-mensajes-cliente.tsx" ] || [ "$base" = "akuosplash-historial-cliente.tsx" ] || [ "$base" = "akuosplash-admin-usuarios.tsx" ] || [ "$base" = "akuosplash-admin-pedidos.tsx" ] || [ "$base" = "akuosplash-api-client.tsx" ] || [ "$base" = "akuosplash-helpers.tsx" ]; then
    echo "SKIP $base (ya existe)"
    continue
  fi

  echo "COPY $base"
  sed \
    -e 's|from "@/lib/db"|from "@/lib/akuosplash-db"|g' \
    -e 's|from "@/lib/auth"|from "@/lib/akuosplash-auth"|g' \
    -e 's|from "@/lib/api-client"|from "@/components/akuosplash/akuosplash-api-client"|g' \
    -e 's|from "@/lib/helpers"|from "@/components/akuosplash/akuosplash-helpers"|g' \
    -e 's|from "@/lib/offline-photos"|from "@/lib/akuosplash-offline-photos"|g' \
    -e 's|from "@/lib/periodo-cerrado"|from "@/lib/akuosplash-periodo-cerrado"|g' \
    -e 's/\bdb\./akuosplashDb./g' \
    -e 's/akuosplashDb\.usuario/akuosplashDb.akuoUsuario/g' \
    -e 's/akuosplashDb\.cliente/akuosplashDb.akuoCliente/g' \
    -e 's/akuosplashDb\.pedidoRecurrente/akuosplashDb.akuoPedidoRecurrente/g' \
    -e 's/akuosplashDb\.pedido/akuosplashDb.akuoPedido/g' \
    -e 's/akuosplashDb\.camionChofer/akuosplashDb.akuoCamionChofer/g' \
    -e 's/akuosplashDb\.camion/akuosplashDb.akuoVehiculo/g' \
    -e 's/akuosplashDb\.vuelta/akuosplashDb.akuoVuelta/g' \
    -e 's/akuosplashDb\.entrega/akuosplashDb.akuoEntrega/g' \
    -e 's/akuosplashDb\.gasto/akuosplashDb.akuoGasto/g' \
    -e 's/akuosplashDb\.configuracion/akuosplashDb.akuoConfig/g' \
    -e 's/akuosplashDb\.pago/akuosplashDb.akuoPago/g' \
    -e 's/akuosplashDb\.zona/akuosplashDb.akuoZona/g' \
    -e 's/akuosplashDb\.suscripcion/akuosplashDb.akuoSuscripcion/g' \
    -e 's/akuosplashDb\.valoracion/akuosplashDb.akuoValoracion/g' \
    -e 's/akuosplashDb\.notificacion/akuosplashDb.akuoNotificacion/g' \
    -e 's/akuosplashDb\.auditLog/akuosplashDb.akuoAuditLog/g' \
    -e 's/akuosplashDb\.sesion/akuosplashDb.akuoSesion/g' \
    -e 's/akuosplashDb\.conversacion/akuosplashDb.akuoConversacion/g' \
    -e 's/akuosplashDb\.mensaje/akuosplashDb.akuoMensaje/g' \
    -e 's/duenoId/transportistaId/g' \
    -e 's|"/api/auth/|"/api/akuosplash/auth/|g' \
    -e 's|"/api/entregas|"/api/akuosplash/entregas|g' \
    -e 's|"/api/gastos|"/api/akuosplash/gastos|g' \
    -e 's|"/api/vueltas|"/api/akuosplash/vueltas|g' \
    -e 's|"/api/pedidos|"/api/akuosplash/pedidos|g' \
    -e 's|"/api/clientes|"/api/akuosplash/clientes|g' \
    -e 's|"/api/camiones|"/api/akuosplash/vehiculos|g' \
    -e 's|"/api/reportes|"/api/akuosplash/reportes|g' \
    -e 's|"/api/pagos|"/api/akuosplash/pagos|g' \
    -e 's|"/api/config|"/api/akuosplash/config|g' \
    -e 's|"/api/upload|"/api/akuosplash/upload|g' \
    -e 's|"/api/usuarios|"/api/akuosplash/usuarios|g' \
    -e 's|"/api/super-admin|"/api/akuosplash/superadmin|g' \
    -e 's|`/api/|`/api/akuosplash/|g' \
    -e 's/Aljibe/AkuoSplash/g' \
    -e 's|/logo\.png|/akuosplash/logo.png|g' \
    -e 's|/logo\.svg|/akuosplash/logo.png|g' \
    "$f" > "$DST/$base"
done

echo "DONE"
