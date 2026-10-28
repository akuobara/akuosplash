import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/vueltas/activa — devuelve la vuelta activa del transportista
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Buscar vuelta activa del transportista (no cerrada)
  const vuelta = await akuosplashDb.akuoVuelta.findFirst({
    where: {
      transportistaId: user.id,
      activa: true,
      cerradaEn: null,
    },
    orderBy: { iniciadaEn: "desc" },
    include: {
      vehiculo: { select: { id: true, patente: true, capacidadLitros: true, marca: true, modelo: true } },
      _count: { select: { entregas: true } },
    },
  });

  // Calcular litros y ventas de la vuelta
  let litros = 0;
  let ventas = 0;
  let efectivo = 0;
  let transferencia = 0;
  let entregasList: any[] = [];
  if (vuelta) {
    entregasList = await akuosplashDb.akuoEntrega.findMany({
      where: { vueltaId: vuelta.id },
      select: {
        id: true,
        creadoEn: true,
        litros: true,
        total: true,
        montoEfectivo: true,
        montoTransferencia: true,
        montoRecibido: true,
        clienteId: true,
        clienteNombre: true,
        clienteDireccion: true,
        clienteZona: true,
        clienteTelefono: true,
        clienteLat: true,
        clienteLng: true,
        metodoPago: true,
        estadoPago: true,
        fotoMedidorUrl: true,
      },
      orderBy: { creadoEn: "asc" },
    });
    litros = entregasList.reduce((s, e) => s + e.litros, 0);
    ventas = entregasList.reduce((s, e) => s + e.total, 0);
    efectivo = entregasList.reduce((s, e) => s + (e.montoEfectivo || 0), 0);
    transferencia = entregasList.reduce((s, e) => s + (e.montoTransferencia || 0), 0);
  }

  return NextResponse.json({
    vuelta: vuelta ? {
      id: vuelta.id,
      numero: vuelta.numero,
      iniciadaEn: vuelta.iniciadaEn,
      cerradaEn: vuelta.cerradaEn,
      nota: vuelta.nota,
      vehiculo: vuelta.vehiculo ? {
        id: vuelta.vehiculo.id,
        nombre: `${vuelta.vehiculo.marca || ""} ${vuelta.vehiculo.modelo || ""}`.trim() || vuelta.vehiculo.patente,
        patente: vuelta.vehiculo.patente,
        capacidadLitros: vuelta.vehiculo.capacidadLitros,
      } : null,
      litros,
      ventas,
      efectivo,
      transferencia,
      cantidadEntregas: entregasList.length,
      entregas: entregasList,
    } : null,
  });
}
