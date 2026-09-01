import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/pool — lista de pedidos en pool disponibles para el chofer/admin actual
// Reglas:
//   - Solo admins/choferes con plan Premium o Pro (accesoPool = true)
//   - Solo pedidos en estado "en_pool" (no preferido_notificado)
//   - Solo pedidos en la misma zona que el admin (por ahora: todas las zonas, hasta que se defina zona del admin)
//   - Expira pedidos con > 3 horas en pool que nadie tomó (los marca como expirados)
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar que el admin tenga plan con accesoPool
  const config = await db.configuracion.findUnique({
    where: { duenoId },
    select: { planId: true },
  });
  const planId = config?.planId || "free";
  const plan = await db.plan.findUnique({
    where: { id: planId },
    select: { accesoPool: true },
  });
  if (!plan || !plan.accesoPool) {
    return NextResponse.json({
      error: "Tu plan no incluye acceso al pool de pedidos. Actualizá a Premium o Pro.",
      planActual: planId,
    }, { status: 403 });
  }

  // Marcar como expirados los pedidos en pool con > 3 horas
  const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
  await db.pedidoApp.updateMany({
    where: {
      estado: { in: ["en_pool", "preferido_notificado"] },
      creadoEn: { lt: tresHorasAtras },
    },
    data: {
      estado: "expirado",
      canceladoEn: new Date(),
      canceladoPor: "sistema",
      motivoCancelacion: "Expirado: nadie tomó el pedido en 3 horas",
    },
  });

  // También, mover al pool los pedidos "preferido_notificado" cuyo plazo ya venció
  const ahora = new Date();
  await db.pedidoApp.updateMany({
    where: {
      estado: "preferido_notificado",
      plazoAceptacionPreferido: { lt: ahora },
    },
    data: {
      estado: "en_pool",
      proveedorPreferidoNotificadoEn: null,
      plazoAceptacionPreferido: null,
    },
  });

  // Listar pedidos en pool
  const pedidos = await db.pedidoApp.findMany({
    where: { estado: "en_pool" },
    orderBy: { creadoEn: "asc" }, // los más antiguos primero
    select: {
      id: true,
      creadoEn: true,
      litros: true,
      monto: true,
      metodoPago: true,
      direccion: true,
      lat: true,
      lng: true,
      indicacionesAcceso: true,
      nota: true,
      zona: { select: { id: true, nombre: true, precioPorLitro: true } },
      cliente: {
        select: {
          id: true,
          nombre: true,
          telefono: true,
          requiereIngresoPropiedad: true,
          entregaDesdeAfuera: true,
          conexionExterna: true,
          requiereClientePresente: true,
        },
      },
    },
  });

  return NextResponse.json({
    pedidos,
    cantidad: pedidos.length,
  });
}
