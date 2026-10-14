import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns, getPlanActivo } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/transportista/pedidos
// Lista pedidos disponibles (pendientes) y los pedidos asignados al transportista.
// Incluye el snapshot del precio dinámico (si aplica) + comisión de la plataforma
// para que el frontend pueda calcular el desglose: bruto / neto / IVA / comisión / ganancia.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Asegurar columnas migradas antes de cualquier query
  await ensureAkuoConfigColumns();

  // Comisión: si el usuario es superadmin en preview, usar la del plan que está probando;
  // si no, usar la del plan activo del transportista.
  let comisionPct = 0;
  try {
    // Si es superadmin con previewPlan en URL, el /me ya seteó planInfo. Pero acá no tenemos
    // acceso directo a eso — usamos getPlanActivo (devuelve plan real o defaults).
    const planInfo = await getPlanActivo(user.id);
    comisionPct = planInfo.plan.comisionPct ?? 0;
  } catch {}

  // Pedidos disponibles: pendientes y sin transportista asignado
  const disponiblesRaw = await akuosplashDb.akuoPedidoCliente.findMany({
    where: {
      estado: "pendiente",
      transportistaId: null,
    },
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, email: true } },
    },
  });

  // Pedidos asignados a mí: en estado aceptado o en_ruta
  const asignadosRaw = await akuosplashDb.akuoPedidoCliente.findMany({
    where: {
      transportistaId: user.id,
      estado: { in: ["aceptado", "en_ruta"] },
    },
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, email: true, direccion: true, comuna: true, lat: true, lng: true, indicacionesAcceso: true } },
    },
  });

  // Helper para parsear snapshot y agregar el desglose financiero
  const mapPedido = (p: any) => {
    let snapshot: any = null;
    if (p.precioSnapshotJson) {
      try { snapshot = JSON.parse(p.precioSnapshotJson); } catch {}
    }
    const total = p.precioTotal ?? snapshot?.resultado?.total ?? 0;
    const neto = total; // en Chile el total ya es neto sin IVA (el IVA se agrega al total al cliente)
    const iva = Math.round(total * 0.19);
    const totalConIva = total + iva;
    const comision = Math.round((total * comisionPct) / 100);
    const gananciaRepartidor = total - comision;
    return {
      ...p,
      // No exponemos codigoConfirmacion en esta lista
      codigoConfirmacion: undefined,
      // Desglose financiero precalculado para el frontend
      _precio: {
        total: neto,
        iva,
        totalConIva,
        comision,
        comisionPct,
        gananciaRepartidor,
        precioDinamico: p.precioDinamicoHabilitado ?? false,
        precioPorLitroFinal: p.precioPorLitroFinal ?? null,
        snapshot,
      },
    };
  };

  const disponibles = disponiblesRaw.map(mapPedido);
  const asignados = asignadosRaw.map(mapPedido);

  return NextResponse.json({ disponibles, asignados, comisionPct });
}

